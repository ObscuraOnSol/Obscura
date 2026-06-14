import { Router } from "express";
import { z } from "zod";
import { execSync } from "child_process";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { computeCommitHash, commitMatches } from "../lib/commit.ts";
import type { SessionRequest } from "../lib/session.ts";
import { env } from "../lib/env.ts";
import { verifyUsdcTransfer, verifyUsdcSplitTransfer } from "../lib/solana.ts";
import { buildSplitTransferTx, buildSingleTransferTx } from "../lib/tx-builder.ts";

/**
 * Browser/session order API for wallet-connected users (as opposed to the
 * X-API-Key agent API). When the caller presents a valid SIWS session token the
 * wallet comes from that verified token; otherwise it falls back to the body
 * wallet (the connected address) for read-style flows.
 *
 * Privacy note: price/qty are NEVER persisted. At reveal we verify the preimage
 * against the stored commit hash and then discard it; matching the actual values
 * happens in the (out-of-scope) batch matching engine. The orders table stays
 * public-safe.
 */
export const sessionRouter = Router();

const wallet = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address");
const commitHash = z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, "expected a 32-byte keccak hash");

async function ensureUser(w: string): Promise<void> {
  await query(
    `INSERT INTO users (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING`,
    [w],
  );
}

// POST /api/session/orders — commit phase.
const commitSchema = z.object({
  wallet,
  gpuType: z.string().min(1).max(64),
  commitHash,
});
sessionRouter.post(
  "/session/orders",
  asyncHandler(async (req, res) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    const { gpuType, commitHash: hash } = parsed.data;
    await ensureUser(w);
    const { rows } = await query<{ id: string; ts: Date }>(
      `INSERT INTO orders (wallet, gpu_type, commit_hash, status)
       VALUES ($1, $2, $3, 'committed') RETURNING id, ts`,
      [w, gpuType, hash.replace(/^0x/, "")],
    );
    res.status(201).json({
      id: rows[0].id,
      status: "committed",
      phase: "COMMITTED",
      ts: rows[0].ts,
    });
  }),
);

// POST /api/session/orders/:id/reveal — reveal phase.
const revealSchema = z.object({
  wallet,
  priceMicro: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  secret: z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, "secret must be 32 bytes"),
});
sessionRouter.post(
  "/session/orders/:id/reveal",
  asyncHandler(async (req, res) => {
    const parsed = revealSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    const { priceMicro, qty, secret } = parsed.data;

    const id = String(req.params.id);
    const { rows } = await query<{
      commit_hash: string;
      status: string;
      gpu_type: string;
    }>(
      `SELECT commit_hash, status, gpu_type FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }
    if (rows[0].status !== "committed") {
      res.status(409).json({ error: `cannot reveal an order in status '${rows[0].status}'` });
      return;
    }

    // Enforce the commit-reveal invariant: the preimage must hash to the commit.
    const expected = computeCommitHash(BigInt(priceMicro), BigInt(qty), secret);
    if (!commitMatches(expected, rows[0].commit_hash)) {
      res.status(400).json({ error: "reveal does not match committed hash" });
      return;
    }

    // Mark revealed and record an EPHEMERAL matching intent. price/qty live in
    // order_intents only for the batch window; the matching engine deletes them
    // on settlement, so they never persist in a public-safe table.
    await query(
      `UPDATE orders SET revealed = TRUE, status = 'revealed' WHERE id = $1 AND wallet = $2`,
      [id, w],
    );
    await query(
      `INSERT INTO order_intents (order_id, wallet, gpu_type, price_micro, qty)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO UPDATE
         SET price_micro = EXCLUDED.price_micro, qty = EXCLUDED.qty`,
      [id, w, rows[0].gpu_type, priceMicro, qty],
    );
    res.json({ id, status: "revealed", phase: "REVEALED" });
  }),
);

// POST /api/session/orders/:id/build-settle-tx — build serialized settlement tx
sessionRouter.post(
  "/session/orders/:id/build-settle-tx",
  asyncHandler(async (req, res) => {
    const w = (req as SessionRequest).sessionWallet ?? req.body.wallet;
    if (!w) {
      res.status(400).json({ error: "missing wallet" });
      return;
    }

    const id = String(req.params.id);
    const { rows } = await query<{
      status: string;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
    }>(
      `SELECT status, assigned_provider_wallet, clearing_price, hours 
       FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }

    const order = rows[0];
    if (order.status !== "matched") {
      res.status(400).json({ error: `cannot settle order in status '${order.status}'` });
      return;
    }

    if (!order.assigned_provider_wallet || !order.clearing_price || !order.hours) {
      res.status(400).json({ error: "order assignment details missing" });
      return;
    }

    const price = parseFloat(order.clearing_price);
    const totalAmount = price * order.hours;
    const feeAmount = totalAmount * 0.005;
    const combinedAmount = totalAmount + feeAmount;

    try {
      const serializedTx = await buildSingleTransferTx(
        w,
        env.obscuraServiceWallet,
        combinedAmount
      );
      res.json({ serializedTx });
    } catch (e) {
      console.error("[solana-tx-builder] Failed to build settlement tx:", e);
      res.status(500).json({
        error: "tx_build_failed",
        message: e instanceof Error ? e.message : "failed to build transaction"
      });
    }
  })
);

// POST /api/session/orders/:id/settle — settle/pay phase
const settleSchema = z.object({
  wallet,
  txSig: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,88}$/, "invalid transaction signature"),
});

sessionRouter.post(
  "/session/orders/:id/settle",
  asyncHandler(async (req, res) => {
    const parsed = settleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    const { txSig } = parsed.data;

    const id = String(req.params.id);
    const { rows } = await query<{
      status: string;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
    }>(
      `SELECT status, assigned_provider_wallet, clearing_price, hours 
       FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }

    const order = rows[0];
    if (order.status !== "matched") {
      res.status(400).json({ error: `cannot settle order in status '${order.status}'` });
      return;
    }

    if (!order.assigned_provider_wallet || !order.clearing_price || !order.hours) {
      res.status(400).json({ error: "order assignment details missing" });
      return;
    }

    // Verify buyer's payment of lease cost + protocol fee to the service wallet acting as escrow
    const price = parseFloat(order.clearing_price);
    const totalAmount = price * order.hours;
    const feeAmount = totalAmount * 0.005;
    const combinedAmount = totalAmount + feeAmount;

    const ok = await verifyUsdcTransfer(
      txSig,
      w,
      env.obscuraServiceWallet,
      combinedAmount,
    );

    if (!ok) {
      res.status(400).json({
        error: "payment_verification_failed",
        message: `Unable to verify the lease payment of ${combinedAmount.toFixed(4)} USDC on-chain. Please ensure the transaction signature is correct and has successfully processed on Solana.`,
      });
      return;
    }

    // Success! Update status to settled and initialize escrow payout tracking
    await query(
      `UPDATE orders 
       SET status = 'settled', 
           lease_started_at = now(), 
           last_payout_at = now(),
           payouts_completed = 0 
       WHERE id = $1`,
      [id]
    );

    res.json({ id, status: "settled", phase: "SETTLED" });
  }),
);

// POST /api/session/orders/:id/cancel
sessionRouter.post(
  "/session/orders/:id/cancel",
  asyncHandler(async (req, res) => {
    const bodyW = wallet.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    if (!w) {
      res.status(400).json({ error: "valid wallet required" });
      return;
    }
    const { rowCount } = await query(
      `UPDATE orders SET status = 'cancelled'
       WHERE id = $1 AND wallet = $2 AND status IN ('committed','revealed')`,
      [String(req.params.id), w],
    );
    if (!rowCount) {
      res.status(404).json({ error: "order not found or not cancellable" });
      return;
    }
    res.json({ id: String(req.params.id), status: "cancelled" });
  }),
);

// GET /api/session/orders?wallet=...
sessionRouter.get(
  "/session/orders",
  asyncHandler(async (req, res) => {
    const w = wallet.safeParse(req.query.wallet);
    if (!w.success) {
      res.status(400).json({ error: "valid ?wallet= required" });
      return;
    }
    const { rows } = await query<{
      id: string;
      gpu_type: string;
      commit_hash: string;
      revealed: boolean;
      status: string;
      ts: Date;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
    }>(
      `SELECT id, gpu_type, commit_hash, revealed, status, ts, assigned_provider_wallet, clearing_price, hours
       FROM orders WHERE wallet = $1 ORDER BY ts DESC LIMIT 100`,
      [w.data],
    );
    res.json({
      orders: rows.map((r) => ({
        id: r.id,
        gpuType: r.gpu_type,
        commitHash: r.commit_hash,
        revealed: r.revealed,
        status: r.status,
        ts: r.ts,
        assignedProviderWallet: r.assigned_provider_wallet,
        clearingPrice: r.clearing_price ? Number(r.clearing_price) : null,
        hours: r.hours,
      })),
    });
  }),
);

interface ConnectionDetails {
  host: string;
  port: string;
  username: string;
  password?: string;
  webCliUrl: string;
}

function getDynamicMockConnection(id: string, hostname: string): ConnectionDetails {
  const shortId = id.slice(0, 6);
  // Generate a realistic random port between 10000 and 45000 based on the order ID
  let portHash = 0;
  for (let i = 0; i < id.length; i++) {
    portHash = id.charCodeAt(i) + ((portHash << 5) - portHash);
  }
  const port = Math.abs(10000 + (portHash % 35000));

  // Generate a consistent, random-looking password based on the order ID
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    const charIndex = Math.abs((portHash + i * 3) % chars.length);
    password += chars[charIndex];
  }

  return {
    host: hostname,
    port: String(port),
    username: "root",
    password: password,
    webCliUrl: "",
  };
}

// GET /api/session/orders/:id/connection
sessionRouter.get(
  "/session/orders/:id/connection",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows } = await query<{
      id: string;
      status: string;
      assigned_host: string | null;
      assigned_port: string | null;
      assigned_username: string | null;
      assigned_password: string | null;
    }>(
      `SELECT id, status, assigned_host, assigned_port, assigned_username, assigned_password 
       FROM orders WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }

    const order = rows[0];
    if (order.status !== "settled") {
      res.status(400).json({ error: "order is not settled yet" });
      return;
    }

    // Fallback to static environment variable configurations if custom values are configured.
    if (env.sshHost !== "localhost") {
      res.json({
        host: env.sshHost,
        port: env.sshPort,
        username: env.sshUsername,
        password: env.sshPassword,
        webCliUrl: "",
      });
      return;
    }

    if (order.assigned_host) {
      res.json({
        host: order.assigned_host,
        port: order.assigned_port ?? "22",
        username: order.assigned_username ?? "root",
        password: order.assigned_password ?? "",
        webCliUrl: "",
      });
      return;
    }

    // Otherwise, generate a consistent, unique mock credentials for this order pointing to our backend host
    const mockConn = getDynamicMockConnection(id, req.hostname);
    res.json(mockConn);
  }),
);

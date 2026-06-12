import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { computeCommitHash, commitMatches } from "../lib/commit.ts";

/**
 * Browser/session order API for wallet-connected users (as opposed to the
 * X-API-Key agent API). The wallet is currently taken from the request body —
 * once SIWS is fully wired it will come from the verified JWT session instead.
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
    const { wallet: w, gpuType, commitHash: hash } = parsed.data;
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
    const { wallet: w, priceMicro, qty, secret } = parsed.data;

    const { rows } = await query<{ commit_hash: string; status: string }>(
      `SELECT commit_hash, status FROM orders WHERE id = $1 AND wallet = $2`,
      [String(req.params.id), w],
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

    // Mark revealed. price/qty are intentionally NOT stored.
    await query(
      `UPDATE orders SET revealed = TRUE, status = 'revealed' WHERE id = $1 AND wallet = $2`,
      [String(req.params.id), w],
    );
    res.json({ id: String(req.params.id), status: "revealed", phase: "REVEALED" });
  }),
);

// POST /api/session/orders/:id/cancel
sessionRouter.post(
  "/session/orders/:id/cancel",
  asyncHandler(async (req, res) => {
    const w = wallet.safeParse(req.body?.wallet);
    if (!w.success) {
      res.status(400).json({ error: "valid wallet required" });
      return;
    }
    const { rowCount } = await query(
      `UPDATE orders SET status = 'cancelled'
       WHERE id = $1 AND wallet = $2 AND status IN ('committed','revealed')`,
      [String(req.params.id), w.data],
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
    }>(
      `SELECT id, gpu_type, commit_hash, revealed, status, ts
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
      })),
    });
  }),
);

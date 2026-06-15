import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { resolveApiKey, type Tier } from "../lib/apiKey.ts";
import { env } from "../lib/env.ts";
import { verifyUsdcTransfer } from "../lib/solana.ts";
import { buildSingleTransferTx } from "../lib/tx-builder.ts";
import { computeCommitHash, commitMatches } from "../lib/commit.ts";

export const ordersRouter = Router();

// --- Public read API --------------------------------------------------------

// GET /api/orders/metrics — volume, fill rates, GPU breakdown (public).
ordersRouter.get(
  "/orders/metrics",
  asyncHandler(async (_req, res) => {
    // 1. Get 24h orders statistics
    const ordersRes = await query<{
      gpu_type: string;
      total: string;
      revealed: string;
      settled: string;
    }>(`
      SELECT gpu_type,
             COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE revealed)::text AS revealed,
             COUNT(*) FILTER (WHERE status = 'settled')::text AS settled
      FROM orders
      WHERE ts > now() - interval '24 hours'
        AND network = $1
      GROUP BY gpu_type
    `, [env.network]);

    // 2. Get active capacity/depth statistics
    const providersRes = await query<{
      gpu_type: string;
      depth: string;
      cheapest_price: string;
      total_providers: string;
    }>(`
      SELECT gpu_type,
             COALESCE(SUM(capacity), 0)::text AS depth,
             COALESCE(MIN(rate_micro), 0)::text AS cheapest_price,
             COUNT(*)::text AS total_providers
      FROM providers
      WHERE status = 'active'
        AND network = $1
      GROUP BY gpu_type
    `, [env.network]);

    // 3. Get latest clearing prices
    const pricesRes = await query<{
      gpu_type: string;
      clearing_price: string;
    }>(`
      SELECT DISTINCT ON (gpu_type) gpu_type, clearing_price
      FROM market_prices
      WHERE network = $1
      ORDER BY gpu_type, ts DESC
    `, [env.network]);

    // Create a union of all GPU types present in the metrics, providers, or price logs
    const gpus = new Set<string>();
    ordersRes.rows.forEach((r) => gpus.add(r.gpu_type));
    providersRes.rows.forEach((r) => gpus.add(r.gpu_type));
    pricesRes.rows.forEach((r) => gpus.add(r.gpu_type));

    const ordersMap = new Map(ordersRes.rows.map((r) => [r.gpu_type, r]));
    const providersMap = new Map(providersRes.rows.map((r) => [r.gpu_type, r]));
    const pricesMap = new Map(pricesRes.rows.map((r) => [r.gpu_type, r]));

    const breakdown = Array.from(gpus).sort().map((gpu) => {
      const o = ordersMap.get(gpu);
      const p = providersMap.get(gpu);
      const pr = pricesMap.get(gpu);

      const total = o ? Number(o.total) : 0;
      const settled = o ? Number(o.settled) : 0;
      const revealed = o ? Number(o.revealed) : 0;

      return {
        gpuType: gpu,
        total,
        revealed,
        settled,
        fillRate: total > 0 ? settled / total : 0,
        clearingPrice: pr ? Number(pr.clearing_price) : null,
        depth: p ? Number(p.depth) : 0,
        cheapestPrice: p ? Number(p.cheapest_price) / 1_000_000 : null,
        totalProviders: p ? Number(p.total_providers) : 0,
      };
    });

    res.json({
      window: "24h",
      breakdown,
    });
  }),
);

// --- Agent Order API (token-gated via X-API-Key) ----------------------------

interface AuthedRequest extends Request {
  agent?: { ownerWallet: string; tier: Tier };
}

const requireApiKey = asyncHandler(
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const key = req.header("x-api-key");
    const resolved = await resolveApiKey(key ?? undefined);
    if (!resolved) {
      res.status(401).json({ error: "invalid or missing X-API-Key" });
      return;
    }
    req.agent = resolved;
    next();
  },
);

const submitSchema = z.object({
  gpuType: z.string().min(1),
  // Commit-reveal: only the hash is submitted at commit time.
  commitHash: z.string().regex(/^0x?[0-9a-fA-F]{16,128}$/, "expected a hex commit hash"),
});

// POST /api/orders — submit (commit) an order programmatically.
ordersRouter.post(
  "/orders",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const { gpuType, commitHash } = parsed.data;
    const { rows } = await query<{ id: string; ts: Date }>(
      `INSERT INTO orders (wallet, gpu_type, commit_hash, status, network)
       VALUES ($1, $2, $3, 'committed', $4)
       RETURNING id, ts`,
      [req.agent!.ownerWallet, gpuType, commitHash.replace(/^0x/, ""), env.network],
    );
    res.status(201).json({
      id: rows[0].id,
      status: "committed",
      phase: "COMMITTED",
      ts: rows[0].ts,
    });
  }),
);

// GET /api/orders — list the calling agent's orders.
ordersRouter.get(
  "/orders",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{
      id: string;
      gpu_type: string;
      commit_hash: string;
      revealed: boolean;
      status: string;
      ts: Date;
    }>(
      `SELECT id, gpu_type, commit_hash, revealed, status, ts
       FROM orders WHERE wallet = $1 AND network = $2 ORDER BY ts DESC LIMIT 100`,
      [req.agent!.ownerWallet, env.network],
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

// POST /api/orders/:id/cancel — cancel an unsettled order.
ordersRouter.post(
  "/orders/:id/cancel",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rowCount } = await query(
      `UPDATE orders SET status = 'cancelled'
       WHERE id = $1 AND wallet = $2 AND status IN ('committed','revealed')`,
      [String(req.params.id), req.agent!.ownerWallet],
    );
    if (!rowCount) {
      res.status(404).json({ error: "order not found or not cancellable" });
      return;
    }
    await query(
      `DELETE FROM order_intents WHERE order_id = $1`,
      [String(req.params.id)]
    );
    res.json({ id: req.params.id, status: "cancelled" });
  }),
);

// POST /api/orders/:id/reveal — reveal phase.
const revealSchema = z.object({
  priceMicro: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  secret: z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, "secret must be 32 bytes"),
});

ordersRouter.post(
  "/orders/:id/reveal",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = revealSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = req.agent!.ownerWallet;
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

    // Enforce the commit-reveal invariant
    const expected = computeCommitHash(BigInt(priceMicro), BigInt(qty), secret);
    if (!commitMatches(expected, rows[0].commit_hash)) {
      res.status(400).json({ error: "reveal does not match committed hash" });
      return;
    }

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

// POST /api/orders/:id/build-settle-tx — build serialized settlement tx
ordersRouter.post(
  "/orders/:id/build-settle-tx",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const w = req.agent!.ownerWallet;
    const id = String(req.params.id);

    const { rows } = await query<{
      status: string;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
      network: string;
    }>(
      `SELECT status, assigned_provider_wallet, clearing_price, hours, network 
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
        combinedAmount,
        order.network
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

// POST /api/orders/:id/settle — settle/pay phase
const settleSchema = z.object({
  txSig: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,88}$/, "invalid transaction signature"),
});

ordersRouter.post(
  "/orders/:id/settle",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = settleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = req.agent!.ownerWallet;
    const { txSig } = parsed.data;
    const id = String(req.params.id);

    const { rows } = await query<{
      status: string;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
      network: string;
    }>(
      `SELECT status, assigned_provider_wallet, clearing_price, hours, network 
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

    const ok = await verifyUsdcTransfer(
      txSig,
      w,
      env.obscuraServiceWallet,
      combinedAmount,
      order.network,
    );

    if (!ok) {
      res.status(400).json({
        error: "payment_verification_failed",
        message: `Unable to verify the lease payment of ${combinedAmount.toFixed(4)} USDC on-chain. Please ensure the transaction signature is correct and has successfully processed on Solana.`,
      });
      return;
    }

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

interface ConnectionDetails {
  host: string;
  port: string;
  username: string;
  password?: string;
  webCliUrl: string;
}

function getDynamicMockConnection(id: string, hostname: string): ConnectionDetails {
  let portHash = 0;
  for (let i = 0; i < id.length; i++) {
    portHash = id.charCodeAt(i) + ((portHash << 5) - portHash);
  }
  const port = Math.abs(10000 + (portHash % 35000));

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

// GET /api/orders/:id — retrieve order status / connection credentials (X402 Gate)
ordersRouter.get(
  "/orders/:id",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const w = req.agent!.ownerWallet;

    const { rows } = await query<{
      id: string;
      status: string;
      assigned_provider_wallet: string | null;
      clearing_price: string | null;
      hours: number | null;
      assigned_host: string | null;
      assigned_port: string | null;
      assigned_username: string | null;
      assigned_password: string | null;
      lease_started_at: Date | null;
    }>(
      `SELECT id, status, assigned_provider_wallet, clearing_price, hours,
              assigned_host, assigned_port, assigned_username, assigned_password, lease_started_at
       FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "order_not_found", message: "Order not found" });
      return;
    }

    const order = rows[0];

    // If order is matched but unpaid, trigger X402 Gate
    if (order.status === "matched") {
      if (!order.clearing_price || !order.hours) {
        res.status(400).json({ error: "order_details_missing", message: "Order details missing" });
        return;
      }
      const price = parseFloat(order.clearing_price);
      const totalAmount = price * order.hours;
      const feeAmount = totalAmount * 0.005;
      const combinedAmount = totalAmount + feeAmount;

      res.status(402).json({
        error: "payment_required",
        message: `Payment of ${combinedAmount.toFixed(4)} USDC required to access credentials.`,
        amountUsdc: Number(combinedAmount.toFixed(6)),
        escrowWallet: env.obscuraServiceWallet,
        paymentUrl: `/api/orders/${id}/build-settle-tx`
      });
      return;
    }

    // If order is settled, return credentials (or block if expired)
    if (order.status === "settled") {
      // Expiration check
      if (order.lease_started_at && order.hours) {
        const start = new Date(order.lease_started_at).getTime();
        const durationMs = order.hours * 60 * 60 * 1000;
        const isExpired = Date.now() > start + durationMs;
        if (isExpired) {
          res.status(410).json({
            id: order.id,
            status: "expired",
            error: "lease_expired",
            message: "This server lease has expired."
          });
          return;
        }
      }

      let connection: ConnectionDetails;
      if (env.sshHost !== "localhost") {
        connection = {
          host: env.sshHost,
          port: env.sshPort,
          username: env.sshUsername,
          password: env.sshPassword,
          webCliUrl: "",
        };
      } else if (order.assigned_host) {
        connection = {
          host: order.assigned_host,
          port: order.assigned_port ?? "22",
          username: order.assigned_username ?? "root",
          password: order.assigned_password ?? "",
          webCliUrl: "",
        };
      } else {
        connection = getDynamicMockConnection(id, req.hostname);
      }

      res.json({
        id: order.id,
        status: "settled",
        connection
      });
      return;
    }

    // For other statuses (committed, revealed, cancelled), just return status
    res.json({
      id: order.id,
      status: order.status
    });
  })
);

// GET /api/orders/:id/receipt — per-fill receipt
ordersRouter.get(
  "/orders/:id/receipt",
  requireApiKey,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const w = req.agent!.ownerWallet;

    const { rows } = await query<{
      id: string;
      batch_id: string | null;
      gpu_type: string;
      clearing_price: string | null;
      hours: number | null;
      ts: Date;
      status: string;
    }>(
      `SELECT id, batch_id, gpu_type, clearing_price, hours, ts, status 
       FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "order_not_found", message: "Order not found" });
      return;
    }

    const order = rows[0];
    if (!order.batch_id) {
      res.status(400).json({
        error: "order_not_filled",
        message: "Order has not been filled/matched in a batch yet"
      });
      return;
    }

    const price = order.clearing_price ? parseFloat(order.clearing_price) : 0;
    const hours = order.hours ?? 0;

    res.json({
      orderId: order.id,
      batchId: Number(order.batch_id),
      gpuType: order.gpu_type,
      clearingPrice: price,
      hours: hours,
      totalCost: price * hours,
      timestamp: order.ts,
      status: order.status
    });
  })
);



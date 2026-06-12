import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { resolveApiKey, type Tier } from "../lib/apiKey.ts";

export const ordersRouter = Router();

// --- Public read API --------------------------------------------------------

// GET /api/orders/metrics — volume, fill rates, GPU breakdown (public).
ordersRouter.get(
  "/orders/metrics",
  asyncHandler(async (_req, res) => {
    const { rows } = await query<{
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
      GROUP BY gpu_type
      ORDER BY gpu_type
    `);
    res.json({
      window: "24h",
      breakdown: rows.map((r) => {
        const total = Number(r.total);
        const settled = Number(r.settled);
        return {
          gpuType: r.gpu_type,
          total,
          revealed: Number(r.revealed),
          settled,
          fillRate: total > 0 ? settled / total : 0,
        };
      }),
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
      `INSERT INTO orders (wallet, gpu_type, commit_hash, status)
       VALUES ($1, $2, $3, 'committed')
       RETURNING id, ts`,
      [req.agent!.ownerWallet, gpuType, commitHash],
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
       FROM orders WHERE wallet = $1 ORDER BY ts DESC LIMIT 100`,
      [req.agent!.ownerWallet],
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
    res.json({ id: req.params.id, status: "cancelled" });
  }),
);

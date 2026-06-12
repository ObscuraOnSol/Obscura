import { Router } from "express";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";

export const settlementsRouter = Router();

// GET /api/settlements — recent batch settlements (public-safe).
settlementsRouter.get(
  "/settlements",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const { rows } = await query<{
      batch_id: string;
      gpu_type: string;
      clearing_price: string;
      fill_count: number;
      ts: Date;
    }>(
      `SELECT batch_id, gpu_type, clearing_price, fill_count, ts
       FROM settlements
       ORDER BY ts DESC
       LIMIT $1`,
      [limit],
    );
    res.json({
      settlements: rows.map((r) => ({
        batchId: Number(r.batch_id),
        gpuType: r.gpu_type,
        clearingPrice: Number(r.clearing_price),
        fillCount: r.fill_count,
        ts: r.ts,
      })),
    });
  }),
);

import { Router } from "express";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";

export const providersRouter = Router();

// GET /api/providers — GPU provider listings (public-safe).
providersRouter.get(
  "/providers",
  asyncHandler(async (req, res) => {
    const gpuType = typeof req.query.gpuType === "string" ? req.query.gpuType : null;
    const { rows } = await query<{
      gpu_type: string;
      capacity: number;
      provider_count: string;
      total_stake: string;
    }>(
      `SELECT gpu_type,
              SUM(capacity)::int AS capacity,
              COUNT(*)::text AS provider_count,
              COALESCE(SUM(stake_amount),0)::text AS total_stake
       FROM providers
       WHERE status = 'active'
         AND ($1::text IS NULL OR gpu_type = $1)
       GROUP BY gpu_type
       ORDER BY gpu_type`,
      [gpuType],
    );
    res.json({
      providers: rows.map((r) => ({
        gpuType: r.gpu_type,
        capacity: r.capacity,
        providerCount: Number(r.provider_count),
        totalStake: Number(r.total_stake),
      })),
    });
  }),
);

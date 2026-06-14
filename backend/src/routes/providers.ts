import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";

export const providersRouter = Router();

// POST /api/providers — register GPU capacity as a node operator.
const providerSchema = z.object({
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address"),
  gpuType: z.string().min(1).max(64),
  capacity: z.number().int().positive(),
  stakeAmount: z.number().nonnegative().default(0),
  host: z.string().max(256).optional().nullable(),
  port: z.string().max(10).optional().nullable(),
  username: z.string().max(64).optional().nullable(),
  password: z.string().max(256).optional().nullable(),
});
providersRouter.post(
  "/providers",
  asyncHandler(async (req, res) => {
    const parsed = providerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const { wallet, gpuType, capacity, stakeAmount, host, port, username, password } = parsed.data;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO providers (wallet, gpu_type, capacity, stake_amount, status, host, port, username, password)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING id`,
      [
        wallet,
        gpuType,
        capacity,
        stakeAmount,
        host || null,
        port || null,
        username || null,
        password || null,
      ],
    );
    res.status(201).json({ id: rows[0].id, gpuType, capacity, status: "active" });
  }),
);

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

import { Router } from "express";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { env } from "../lib/env.ts";

export const marketRouter = Router();

// GET /api/market/prices — latest clearing price per GPU type.
marketRouter.get(
  "/market/prices",
  asyncHandler(async (_req, res) => {
    const { rows } = await query<{
      gpu_type: string;
      clearing_price: string;
      ts: Date;
    }>(`
      SELECT DISTINCT ON (gpu_type) gpu_type, clearing_price, ts
      FROM market_prices
      WHERE network = $1
      ORDER BY gpu_type, ts DESC
    `, [env.network]);
    res.json({
      prices: rows.map((r) => ({
        gpuType: r.gpu_type,
        clearingPrice: Number(r.clearing_price),
        ts: r.ts,
      })),
    });
  }),
);

// GET /api/market/stats — global market statistics.
marketRouter.get(
  "/market/stats",
  asyncHandler(async (_req, res) => {
    const { rows } = await query<{
      gpu_types: string;
      total_fills: string;
      avg_price: string | null;
    }>(`
      SELECT
        COUNT(DISTINCT gpu_type)::text AS gpu_types,
        COALESCE(SUM(fill_count), 0)::text AS total_fills,
        AVG(clearing_price)::text AS avg_price
      FROM settlements
      WHERE ts > now() - interval '24 hours'
        AND network = $1
    `, [env.network]);
    const r = rows[0];
    res.json({
      window: "24h",
      gpuTypes: Number(r?.gpu_types ?? 0),
      totalFills: Number(r?.total_fills ?? 0),
      avgClearingPrice: r?.avg_price ? Number(r.avg_price) : null,
    });
  }),
);

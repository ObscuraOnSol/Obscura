import { Router } from "express";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";

export const leaderboardRouter = Router();

// GET /api/leaderboard — get the list of top paper traders
leaderboardRouter.get(
  "/leaderboard",
  asyncHandler(async (_req, res) => {
    // Rank paper-trading users by total GPU lease hours and total virtual spend
    const { rows } = await query<{
      wallet: string;
      total_leases: string;
      total_hours: string;
      total_spend: string;
    }>(
      `SELECT 
         u.wallet,
         COUNT(o.id)::text AS total_leases,
         COALESCE(SUM(o.hours), 0)::text AS total_hours,
         COALESCE(SUM(o.clearing_price * o.hours), 0)::text AS total_spend
       FROM users u
       LEFT JOIN orders o ON u.wallet = o.wallet AND o.status = 'settled'
       WHERE u.is_paper = TRUE
       GROUP BY u.wallet
       ORDER BY SUM(o.hours) DESC, SUM(o.clearing_price * o.hours) DESC
       LIMIT 50`
    );

    res.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        wallet: r.wallet,
        totalLeases: Number(r.total_leases),
        totalHours: Number(r.total_hours),
        totalSpend: Number(r.total_spend),
      })),
    });
  })
);

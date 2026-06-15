import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import type { SessionRequest } from "../lib/session.ts";
import { env } from "../lib/env.ts";

export const alertsRouter = Router();

const walletSchema = z.string().regex(/^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "invalid Solana address");
const uuidSchema = z.string().uuid("invalid UUID format");

// POST /api/session/price-alerts — Create a price alert
const createAlertSchema = z.object({
  wallet: walletSchema.optional(),
  gpuType: z.string().min(1).max(64),
  targetPrice: z.number().positive("target price must be greater than zero"),
});

alertsRouter.post(
  "/session/price-alerts",
  asyncHandler(async (req, res) => {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }

    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }

    const { gpuType, targetPrice } = parsed.data;

    // Check if the user exists or insert
    await query(
      `INSERT INTO users (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING`,
      [w]
    );

    const { rows } = await query<{
      id: string;
      wallet: string;
      gpu_type: string;
      target_price: string;
      network: string;
      is_triggered: boolean;
      created_at: Date;
    }>(
      `INSERT INTO price_alerts (wallet, gpu_type, target_price, network, is_triggered)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, wallet, gpu_type, target_price, network, is_triggered, created_at`,
      [w, gpuType, targetPrice, env.network]
    );

    const alert = rows[0];
    res.status(201).json({
      id: alert.id,
      wallet: alert.wallet,
      gpuType: alert.gpu_type,
      targetPrice: Number(alert.target_price),
      network: alert.network,
      isTriggered: alert.is_triggered,
      createdAt: alert.created_at,
    });
  })
);

// GET /api/session/price-alerts — List active and historical price alerts for a wallet
alertsRouter.get(
  "/session/price-alerts",
  asyncHandler(async (req, res) => {
    const queryWallet = walletSchema.safeParse(req.query.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (queryWallet.success ? queryWallet.data : null);

    if (!w) {
      res.status(400).json({ error: "valid ?wallet= or session required" });
      return;
    }

    const { rows } = await query<{
      id: string;
      gpu_type: string;
      target_price: string;
      network: string;
      is_triggered: boolean;
      triggered_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, gpu_type, target_price, network, is_triggered, triggered_at, created_at
       FROM price_alerts
       WHERE wallet = $1 AND network = $2
       ORDER BY created_at DESC`,
      [w, env.network]
    );

    res.json({
      alerts: rows.map((r) => ({
        id: r.id,
        gpuType: r.gpu_type,
        targetPrice: Number(r.target_price),
        network: r.network,
        isTriggered: r.is_triggered,
        triggeredAt: r.triggered_at,
        createdAt: r.created_at,
      })),
    });
  })
);

// DELETE /api/session/price-alerts/:id — Delete/Cancel a price alert
alertsRouter.delete(
  "/session/price-alerts/:id",
  asyncHandler(async (req, res) => {
    const idParam = uuidSchema.safeParse(req.params.id);
    if (!idParam.success) {
      res.status(400).json({ error: "invalid_id", message: "ID must be a valid UUID" });
      return;
    }

    const bodyWallet = walletSchema.safeParse(req.body?.wallet || req.query?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyWallet.success ? bodyWallet.data : null);

    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }

    const { rowCount } = await query(
      `DELETE FROM price_alerts
       WHERE id = $1 AND wallet = $2`,
      [idParam.data, w]
    );

    if (!rowCount) {
      res.status(404).json({ error: "alert_not_found", message: "Price alert not found or unauthorized to delete" });
      return;
    }

    res.json({ id: idParam.data, deleted: true });
  })
);

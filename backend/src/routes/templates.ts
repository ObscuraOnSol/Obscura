import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import type { SessionRequest } from "../lib/session.ts";
import { env } from "../lib/env.ts";

export const templatesRouter = Router();

const walletSchema = z.string().regex(
  /^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/,
  "invalid Solana address",
);
const uuidSchema = z.string().uuid("invalid UUID format");

// POST /api/session/order-templates — save a GPU/price/qty preset
const createSchema = z.object({
  wallet: walletSchema.optional(),
  name: z.string().min(1).max(64),
  gpuType: z.string().min(1).max(64),
  priceMicro: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
});

templatesRouter.post(
  "/session/order-templates",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }

    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }

    const { name, gpuType, priceMicro, qty } = parsed.data;

    await query(
      `INSERT INTO users (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING`,
      [w],
    );

    const { rows } = await query<{
      id: string;
      name: string;
      gpu_type: string;
      price_micro: string;
      qty: number;
      created_at: Date;
    }>(
      `INSERT INTO order_templates (wallet, name, gpu_type, price_micro, qty, network)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, gpu_type, price_micro, qty, created_at`,
      [w, name, gpuType, priceMicro, qty, env.network],
    );

    const t = rows[0];
    res.status(201).json({
      id: t.id,
      name: t.name,
      gpuType: t.gpu_type,
      priceMicro: Number(t.price_micro),
      qty: t.qty,
      createdAt: t.created_at,
    });
  }),
);

// GET /api/session/order-templates?wallet=... — list saved presets
templatesRouter.get(
  "/session/order-templates",
  asyncHandler(async (req, res) => {
    const queryWallet = walletSchema.safeParse(req.query.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (queryWallet.success ? queryWallet.data : null);
    if (!w) {
      res.status(400).json({ error: "valid ?wallet= or session required" });
      return;
    }

    const { rows } = await query<{
      id: string;
      name: string;
      gpu_type: string;
      price_micro: string;
      qty: number;
      created_at: Date;
    }>(
      `SELECT id, name, gpu_type, price_micro, qty, created_at
       FROM order_templates
       WHERE wallet = $1 AND network = $2
       ORDER BY created_at DESC`,
      [w, env.network],
    );

    res.json({
      templates: rows.map((r) => ({
        id: r.id,
        name: r.name,
        gpuType: r.gpu_type,
        priceMicro: Number(r.price_micro),
        qty: r.qty,
        createdAt: r.created_at,
      })),
    });
  }),
);

// DELETE /api/session/order-templates/:id — remove a saved preset
templatesRouter.delete(
  "/session/order-templates/:id",
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
      `DELETE FROM order_templates WHERE id = $1 AND wallet = $2`,
      [idParam.data, w],
    );

    if (!rowCount) {
      res.status(404).json({ error: "template_not_found", message: "Template not found or unauthorized" });
      return;
    }

    res.json({ id: idParam.data, deleted: true });
  }),
);

import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import type { SessionRequest } from "../lib/session.ts";

export const notificationsRouter = Router();

const walletSchema = z.string().regex(/^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "invalid Solana address");

const prefsValidationSchema = z.object({
  wallet: walletSchema.optional(),
  emailEnabled: z.boolean(),
  emailAddress: z.string().email("invalid email address").or(z.literal("")).default(""),
  telegramEnabled: z.boolean(),
  telegramUsername: z.string().default(""),
  priceAlertsEnabled: z.boolean(),
  orderFillsEnabled: z.boolean(),
});

const DEFAULT_PREFS = {
  emailEnabled: false,
  emailAddress: "",
  telegramEnabled: false,
  telegramUsername: "",
  priceAlertsEnabled: true,
  orderFillsEnabled: true,
};

// GET /api/session/notification-prefs — Retrieve notification preferences
notificationsRouter.get(
  "/session/notification-prefs",
  asyncHandler(async (req, res) => {
    const queryWallet = walletSchema.safeParse(req.query.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (queryWallet.success ? queryWallet.data : null);

    if (!w) {
      res.status(400).json({ error: "valid ?wallet= or session required" });
      return;
    }

    const { rows } = await query<{
      notification_prefs: any;
    }>(
      `SELECT notification_prefs FROM users WHERE wallet = $1`,
      [w]
    );

    const prefs = rows.length > 0 && rows[0].notification_prefs 
      ? { ...DEFAULT_PREFS, ...rows[0].notification_prefs }
      : DEFAULT_PREFS;

    res.json(prefs);
  })
);

// PUT /api/session/notification-prefs — Update notification preferences
notificationsRouter.put(
  "/session/notification-prefs",
  asyncHandler(async (req, res) => {
    const parsed = prefsValidationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }

    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }

    const { wallet: _, ...prefsToSave } = parsed.data;

    // Check if the user exists, insert if not
    await query(
      `INSERT INTO users (wallet, notification_prefs) 
       VALUES ($1, $2) 
       ON CONFLICT (wallet) 
       DO UPDATE SET notification_prefs = EXCLUDED.notification_prefs`,
      [w, JSON.stringify(prefsToSave)]
    );

    res.json(prefsToSave);
  })
);

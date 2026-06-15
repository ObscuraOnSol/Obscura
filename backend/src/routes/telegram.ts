import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import type { SessionRequest } from "../lib/session.ts";
import { env } from "../lib/env.ts";
import { telegramConfigured } from "../services/telegram.ts";

export const telegramRouter = Router();

const walletSchema = z.string().regex(
  /^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/,
  "invalid Solana address",
);

function configured(): boolean {
  return telegramConfigured() && !!env.telegramBotUsername;
}

// POST /api/session/telegram/link-code — issue a one-time /start deep link
telegramRouter.post(
  "/session/telegram/link-code",
  asyncHandler(async (req, res) => {
    const bodyW = walletSchema.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }
    if (!configured()) {
      res.status(503).json({
        error: "telegram_not_configured",
        message: "Telegram receipts aren't enabled on this deployment yet.",
      });
      return;
    }

    await query(`INSERT INTO users (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING`, [w]);
    const code = randomBytes(8).toString("hex");
    await query(`UPDATE users SET telegram_link_code = $1 WHERE wallet = $2`, [code, w]);

    res.json({
      code,
      botUsername: env.telegramBotUsername,
      deepLink: `https://t.me/${env.telegramBotUsername}?start=${code}`,
    });
  }),
);

// GET /api/session/telegram/status?wallet=... — linked / configured state
telegramRouter.get(
  "/session/telegram/status",
  asyncHandler(async (req, res) => {
    const qW = walletSchema.safeParse(req.query.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (qW.success ? qW.data : null);
    if (!w) {
      res.status(400).json({ error: "valid ?wallet= or session required" });
      return;
    }
    const { rows } = await query<{ telegram_chat_id: string | null }>(
      `SELECT telegram_chat_id FROM users WHERE wallet = $1`,
      [w],
    );
    res.json({ linked: !!rows[0]?.telegram_chat_id, configured: configured() });
  }),
);

// POST /api/session/telegram/unlink — remove the linked chat
telegramRouter.post(
  "/session/telegram/unlink",
  asyncHandler(async (req, res) => {
    const bodyW = walletSchema.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    if (!w) {
      res.status(401).json({ error: "unauthorized", message: "valid wallet or session required" });
      return;
    }
    await query(
      `UPDATE users SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE wallet = $1`,
      [w],
    );
    res.json({ unlinked: true });
  }),
);

import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { generateApiKey } from "../lib/apiKey.ts";
import type { SessionRequest } from "../lib/session.ts";

/**
 * API-key management for the signed-in wallet. Plaintext is shown exactly once
 * (on create); only the SHA-256 hash is stored. Wallet currently comes from the
 * request (SIWS JWT will replace it).
 */
export const keysRouter = Router();
const wallet = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address");

// POST /api/session/keys — generate a key (plaintext returned once).
keysRouter.post(
  "/session/keys",
  asyncHandler(async (req, res) => {
    const bodyW = wallet.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    if (!w) {
      res.status(400).json({ error: "valid wallet required" });
      return;
    }
    const { plaintext, hash } = generateApiKey();
    await query(
      `INSERT INTO api_keys (key_hash, owner_wallet, tier_cache) VALUES ($1, $2, 'anonymous')`,
      [hash, w],
    );
    res.status(201).json({
      apiKey: plaintext,
      id: hash,
      tier: "anonymous",
      note: "Store this now — it is shown only once.",
    });
  }),
);

// GET /api/session/keys?wallet=... — list keys (no plaintext, ever).
keysRouter.get(
  "/session/keys",
  asyncHandler(async (req, res) => {
    const w = wallet.safeParse(req.query.wallet);
    if (!w.success) {
      res.status(400).json({ error: "valid ?wallet= required" });
      return;
    }
    const { rows } = await query<{
      key_hash: string;
      tier_cache: string;
      created_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT key_hash, tier_cache, created_at, revoked_at
       FROM api_keys WHERE owner_wallet = $1 ORDER BY created_at DESC`,
      [w.data],
    );
    res.json({
      keys: rows.map((r) => ({
        id: r.key_hash,
        masked: `obsc_live_…${r.key_hash.slice(-6)}`,
        tier: r.tier_cache,
        createdAt: r.created_at,
        revokedAt: r.revoked_at,
      })),
    });
  }),
);

// POST /api/session/keys/revoke — revoke a key.
keysRouter.post(
  "/session/keys/revoke",
  asyncHandler(async (req, res) => {
    const bodyW = wallet.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    const id = typeof req.body?.id === "string" ? req.body.id : null;
    if (!w || !id) {
      res.status(400).json({ error: "wallet and id required" });
      return;
    }
    const { rowCount } = await query(
      `UPDATE api_keys SET revoked_at = now()
       WHERE key_hash = $1 AND owner_wallet = $2 AND revoked_at IS NULL`,
      [id, w],
    );
    if (!rowCount) {
      res.status(404).json({ error: "key not found or already revoked" });
      return;
    }
    res.json({ id, revoked: true });
  }),
);

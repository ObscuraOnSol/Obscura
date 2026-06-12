import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";

export const authRouter = Router();

/**
 * Sign-In-With-Solana (SIWS). V1 scaffold:
 *  - POST /api/auth/nonce  -> issue a single-use nonce
 *  - POST /api/auth/verify -> consume nonce + (TODO) verify ed25519 signature
 *
 * Signature verification against the wallet's public key is intentionally
 * stubbed — wire @solana/web3.js / tweetnacl in here, then mint a short-TTL JWT.
 */

// POST /api/auth/nonce
authRouter.post(
  "/auth/nonce",
  asyncHandler(async (_req, res) => {
    const nonce = randomBytes(16).toString("hex");
    await query("INSERT INTO auth_nonces (nonce) VALUES ($1)", [nonce]);
    res.json({
      nonce,
      statement: `Sign in to Obscura — Compute in the dark.\nNonce: ${nonce}`,
    });
  }),
);

const verifySchema = z.object({
  wallet: z.string().min(32),
  nonce: z.string().length(32),
  signature: z.string().min(1),
});

// POST /api/auth/verify
authRouter.post(
  "/auth/verify",
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const { wallet, nonce } = parsed.data;

    // Consume the nonce atomically (single-use).
    const { rowCount } = await query(
      "UPDATE auth_nonces SET consumed = TRUE, wallet = $2 WHERE nonce = $1 AND consumed = FALSE",
      [nonce, wallet],
    );
    if (!rowCount) {
      res.status(401).json({ error: "nonce invalid or already used" });
      return;
    }

    // TODO: verify ed25519 signature of `statement` against `wallet` here.

    await query(
      `INSERT INTO users (wallet, last_signed_in) VALUES ($1, now())
       ON CONFLICT (wallet) DO UPDATE SET last_signed_in = now()`,
      [wallet],
    );

    // TODO: mint short-TTL JWT session token.
    res.json({ wallet, session: "stubbed-jwt", note: "signature verification not yet wired" });
  }),
);

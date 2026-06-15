import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { siwsStatement, verifySiws } from "../lib/siws.ts";
import { signSession } from "../lib/session.ts";

/**
 * Sign-In-With-Solana (SIWS):
 *  - POST /api/auth/nonce  -> issue a single-use nonce + the message to sign
 *  - POST /api/auth/verify -> verify the ed25519 signature, consume the nonce,
 *                             upsert the user, and return a short-TTL session token
 */
export const authRouter = Router();

// POST /api/auth/nonce
authRouter.post(
  "/auth/nonce",
  asyncHandler(async (_req, res) => {
    const nonce = randomBytes(16).toString("hex");
    await query("INSERT INTO auth_nonces (nonce) VALUES ($1)", [nonce]);
    res.json({ nonce, statement: siwsStatement(nonce) });
  }),
);

const verifySchema = z.object({
  wallet: z.string().regex(/^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "invalid Solana address"),
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
    const { wallet, nonce, signature } = parsed.data;

    // Nonce must exist and be unconsumed.
    const { rows } = await query<{ nonce: string }>(
      "SELECT nonce FROM auth_nonces WHERE nonce = $1 AND consumed = FALSE",
      [nonce],
    );
    if (rows.length === 0) {
      res.status(401).json({ error: "nonce invalid or already used" });
      return;
    }

    const isPaper = wallet.startsWith("paper_");

    // Real ed25519 verification of the signed statement, bypassed for paper wallets
    if (!isPaper && !verifySiws(wallet, nonce, signature)) {
      res.status(401).json({ error: "signature verification failed" });
      return;
    }

    // Consume the nonce (single-use) and upsert the user.
    await query(
      "UPDATE auth_nonces SET consumed = TRUE, wallet = $2 WHERE nonce = $1",
      [nonce, wallet],
    );
    await query(
      `INSERT INTO users (wallet, is_paper, last_signed_in) VALUES ($1, $2, now())
       ON CONFLICT (wallet) DO UPDATE SET last_signed_in = now(), is_paper = EXCLUDED.is_paper`,
      [wallet, isPaper],
    );

    res.json({ wallet, session: signSession(wallet) });
  }),
);

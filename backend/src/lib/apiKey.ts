import { createHash, randomBytes } from "node:crypto";

import { query } from "../db/index.ts";

/** Tier rate limits (requests/min) — resolved live from on-chain $OBSC balance. */
export const TIER_LIMITS = {
  anonymous: 60,
  bronze: 300,
  silver: 1200,
  gold: 3000,
} as const;

export type Tier = keyof typeof TIER_LIMITS;

/** Generate a new agent key. Plaintext is returned ONCE; only the hash is stored. */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `obsc_live_${randomBytes(32).toString("hex")}`;
  return { plaintext, hash: sha256(plaintext) };
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Look up an X-API-Key, returning the owner + tier, or null if invalid/revoked. */
export async function resolveApiKey(
  plaintext: string | undefined,
): Promise<{ ownerWallet: string; tier: Tier } | null> {
  if (!plaintext) return null;
  const hash = sha256(plaintext);
  const { rows } = await query<{ owner_wallet: string; tier_cache: string }>(
    "SELECT owner_wallet, tier_cache FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
    [hash],
  );
  if (rows.length === 0) return null;
  const tier = (rows[0].tier_cache as Tier) ?? "anonymous";
  return { ownerWallet: rows[0].owner_wallet, tier };
}

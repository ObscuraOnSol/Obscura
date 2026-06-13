import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/**
 * Client-side commit hashing: identical encoding to the backend
 * (`backend/src/lib/commit.ts`) and the obscura_pool program:
 *
 *   keccak256( price_u64_LE(8) || qty_u64_LE(8) || secret(32) )
 *
 * Price is integer micro-USD (USD * 1e6). The secret never leaves the client
 * until the reveal step.
 */
export function computeCommitHash(
  priceMicro: bigint,
  qty: bigint,
  secretHex: string,
): string {
  const secret = hexToBytes(strip0x(secretHex));
  if (secret.length !== 32) throw new Error("secret must be 32 bytes");
  const buf = new Uint8Array(8 + 8 + 32);
  const dv = new DataView(buf.buffer);
  dv.setBigUint64(0, priceMicro, true);
  dv.setBigUint64(8, qty, true);
  buf.set(secret, 16);
  return bytesToHex(keccak_256(buf));
}

/** Cryptographically-random 32-byte secret as hex. */
export function randomSecretHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

export function usdToMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

function strip0x(s: string): string {
  return s.startsWith("0x") ? s.slice(2) : s;
}

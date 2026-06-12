import { keccak_256 } from "@noble/hashes/sha3";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils";

/**
 * Canonical commit-hash encoding, identical to the obscura_pool program:
 *
 *   keccak256( price_u64_LE(8) || qty_u64_LE(8) || secret(32) )
 *
 * `secretHex` must be 32 bytes (64 hex chars). Returns lowercase hex, no 0x.
 * Price is expressed in integer micro-USD (USD * 1e6) so it fits a u64.
 */
export function computeCommitHash(
  priceMicro: bigint,
  qty: bigint,
  secretHex: string,
): string {
  const secret = hexToBytes(stripHex(secretHex));
  if (secret.length !== 32) {
    throw new Error("secret must be 32 bytes (64 hex chars)");
  }
  const buf = new Uint8Array(8 + 8 + 32);
  const dv = new DataView(buf.buffer);
  dv.setBigUint64(0, priceMicro, true);
  dv.setBigUint64(8, qty, true);
  buf.set(secret, 16);
  return bytesToHex(keccak_256(buf));
}

/** Constant-time-ish equality on two hex strings (lengths must match). */
export function commitMatches(a: string, b: string): boolean {
  const x = stripHex(a).toLowerCase();
  const y = stripHex(b).toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function stripHex(s: string): string {
  return s.startsWith("0x") ? s.slice(2) : s;
}

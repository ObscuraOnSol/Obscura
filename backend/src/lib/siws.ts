import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";

/** The exact message a wallet signs to sign in. Must match on both ends. */
export function siwsStatement(nonce: string): string {
  return `Sign in to Obscura — Compute in the dark.\nNonce: ${nonce}`;
}

/** Verify an ed25519 signature of the SIWS statement against the wallet pubkey. */
export function verifySiws(
  walletBase58: string,
  nonce: string,
  signatureBase58: string,
): boolean {
  try {
    const message = new TextEncoder().encode(siwsStatement(nonce));
    const signature = bs58.decode(signatureBase58);
    const pubkey = bs58.decode(walletBase58);
    if (pubkey.length !== 32 || signature.length !== 64) return false;
    return ed25519.verify(signature, message, pubkey);
  } catch {
    return false;
  }
}

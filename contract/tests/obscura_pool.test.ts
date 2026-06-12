/**
 * obscura_pool smoke tests.
 *
 * Runs against a local validator via `anchor test`. The commit-reveal invariant
 * is the load-bearing behaviour: a reveal that does not hash to the committed
 * value must be rejected.
 *
 * NOTE: this is a scaffold. It requires a built program (`anchor build`) and the
 * generated IDL/types in target/. Until then it is a structural placeholder.
 */
import { describe, it, expect } from "bun:test";
import { keccak_256 } from "@noble/hashes/sha3";

function commitHash(price: bigint, qty: bigint, secret: Uint8Array): Uint8Array {
  const buf = new Uint8Array(8 + 8 + 32);
  new DataView(buf.buffer).setBigUint64(0, price, true);
  new DataView(buf.buffer).setBigUint64(8, qty, true);
  buf.set(secret, 16);
  return keccak_256(buf);
}

describe("obscura_pool / commit-reveal", () => {
  it("a correct reveal reproduces the committed hash", () => {
    const secret = new Uint8Array(32).fill(7);
    const h1 = commitHash(1_860000n, 4n, secret);
    const h2 = commitHash(1_860000n, 4n, secret);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(true);
  });

  it("a tampered reveal does NOT match the committed hash", () => {
    const secret = new Uint8Array(32).fill(7);
    const committed = commitHash(1_860000n, 4n, secret);
    const tampered = commitHash(1_860000n, 5n, secret); // qty changed
    expect(Buffer.from(committed).equals(Buffer.from(tampered))).toBe(false);
  });
});

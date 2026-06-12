"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "obscura:wallet";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Dev wallet stand-in. Generates and persists a base58-shaped address in
 * localStorage so the order flow works end-to-end before real Sign-In-With-
 * Solana / wallet-adapter lands (tech-updates Wave 1 #1).
 */
export function useWallet() {
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    setWallet(localStorage.getItem(KEY));
  }, []);

  const connect = useCallback(() => {
    const existing = localStorage.getItem(KEY);
    if (existing) {
      setWallet(existing);
      return existing;
    }
    let addr = "";
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const b of bytes) addr += B58[b % B58.length];
    addr = addr.slice(0, 44);
    localStorage.setItem(KEY, addr);
    setWallet(addr);
    return addr;
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(KEY);
    setWallet(null);
  }, []);

  return { wallet, connect, disconnect };
}

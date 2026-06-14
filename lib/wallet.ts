"use client";

import { useCallback } from "react";
import { useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

/**
 * Real Solana wallet connection via wallet-adapter (Phantom, Solflare,
 * Backpack, and any Wallet-Standard wallet). `connect` opens the wallet picker;
 * `wallet` is the connected public key in base58, or null.
 */
export function useWallet() {
  const { publicKey, connected, connecting, disconnect, signMessage, sendTransaction } =
    useAdapterWallet();
  const { setVisible } = useWalletModal();

  const wallet = publicKey ? publicKey.toBase58() : null;
  const connect = useCallback(() => setVisible(true), [setVisible]);

  return {
    wallet,
    connected,
    connecting,
    connect,
    disconnect,
    signMessage,
    publicKey,
    sendTransaction,
  };
}

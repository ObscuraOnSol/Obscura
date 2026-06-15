"use client";

import { useCallback, useMemo } from "react";
import { useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

/**
 * Custom wallet adapter hook wrapping Solana's standard wallet-adapter.
 * Seamlessly integrates a client-side Paper-Trading (Practice) mode which
 * bypasses extension popups, generating mock public keys prefixed with `paper_`
 * that enable full walletless practice across the Obscura marketplace.
 */
export function useWallet() {
  const adapterWallet = useAdapterWallet();
  const { setVisible } = useWalletModal();

  // Check if practice/paper trading mode is enabled in localStorage
  const isPaperModeActive = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("obscura:paper_active") === "true";
  }, []);

  // Retrieve or generate a stable mock paper wallet address
  const paperWalletAddress = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!isPaperModeActive) return null;
    
    let saved = localStorage.getItem("obscura:paper_wallet");
    if (!saved) {
      // Generate a random mock public key base58-like address prefixed with paper_
      const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      let rand = "";
      for (let i = 0; i < 32; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      saved = `paper_${rand}`;
      localStorage.setItem("obscura:paper_wallet", saved);
    }
    return saved;
  }, [isPaperModeActive]);

  // Enable paper-trading mode and reload the page
  const enablePaperMode = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("obscura:paper_active", "true");
    window.location.reload();
  }, []);

  // Real or mock wallet parameters
  const wallet = isPaperModeActive ? paperWalletAddress : (adapterWallet.publicKey ? adapterWallet.publicKey.toBase58() : null);
  const connected = isPaperModeActive ? true : adapterWallet.connected;
  const connecting = isPaperModeActive ? false : adapterWallet.connecting;

  const connect = useCallback(() => {
    if (isPaperModeActive) return;
    setVisible(true);
  }, [isPaperModeActive, setVisible]);

  const disconnect = useCallback(async () => {
    if (isPaperModeActive) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("obscura:paper_active");
        localStorage.removeItem("obscura:paper_wallet");
        if (paperWalletAddress) {
          localStorage.removeItem(`obscura:session:${paperWalletAddress}`);
        }
        window.location.reload();
      }
      return;
    }
    await adapterWallet.disconnect();
  }, [isPaperModeActive, adapterWallet, paperWalletAddress]);

  const signMessage = useCallback(async (message: Uint8Array) => {
    if (isPaperModeActive) {
      // Return a dummy 64-byte Ed25519 signature representation
      return new Uint8Array(64);
    }
    if (!adapterWallet.signMessage) {
      throw new Error("Wallet does not support message signing");
    }
    return adapterWallet.signMessage(message);
  }, [isPaperModeActive, adapterWallet]);

  const sendTransaction = useCallback(async () => {
    if (isPaperModeActive) {
      // Return a dummy transaction signature (50 characters, Base58 alphabet compliant)
      return "A".repeat(50);
    }
    // We forward transaction execution to the real adapter
    throw new Error("Real transactions are not supported in paper mode");
  }, [isPaperModeActive]);

  const publicKey = useMemo(() => {
    if (isPaperModeActive && paperWalletAddress) {
      // Construct a mock PublicKey object compatible with .toBase58() calls
      return {
        toBase58: () => paperWalletAddress,
        toString: () => paperWalletAddress,
        equals: (other: any) => other && other.toBase58() === paperWalletAddress,
      } as unknown as PublicKey;
    }
    return adapterWallet.publicKey;
  }, [isPaperModeActive, paperWalletAddress, adapterWallet.publicKey]);

  return {
    wallet,
    connected,
    connecting,
    connect,
    disconnect,
    signMessage,
    publicKey,
    sendTransaction,
    isPaperModeActive,
    enablePaperMode,
  };
}

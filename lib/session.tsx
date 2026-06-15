"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@/lib/wallet";
import bs58 from "bs58";

import { authApi, setAuthToken } from "@/lib/api";

interface SessionState {
  signedIn: boolean;
  signingIn: boolean;
  /** Run the SIWS flow: nonce → sign → verify. Returns true on success. */
  signIn: () => Promise<boolean>;
  signOut: () => void;
}

const Ctx = createContext<SessionState>({
  signedIn: false,
  signingIn: false,
  signIn: async () => false,
  signOut: () => {},
});

export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Keep the API client's token in sync.
  useEffect(() => setAuthToken(token), [token]);

  // Restore a saved session for the connected wallet.
  useEffect(() => {
    if (!publicKey) {
      setToken(null);
      return;
    }
    setToken(localStorage.getItem(`obscura:session:${publicKey.toBase58()}`));
  }, [publicKey]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return false;
    setSigningIn(true);
    try {
      const { nonce, statement } = await authApi.nonce();
      const signature = await signMessage(new TextEncoder().encode(statement));
      const { session } = await authApi.verify(
        publicKey.toBase58(),
        nonce,
        bs58.encode(signature),
      );
      setToken(session);
      localStorage.setItem(`obscura:session:${publicKey.toBase58()}`, session);
      return true;
    } catch {
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(() => {
    if (publicKey) localStorage.removeItem(`obscura:session:${publicKey.toBase58()}`);
    setToken(null);
    void disconnect();
  }, [publicKey, disconnect]);

  return (
    <Ctx.Provider value={{ signedIn: !!token, signingIn, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

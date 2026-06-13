"use client";

import { useCallback, useEffect, useState } from "react";
import { Key, Wallet, Copy, Check, Trash2, Plus, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { DataError } from "@/components/marketplace/marketplace-live";
import { useWallet } from "@/lib/wallet";
import { keysApi, type ApiKey } from "@/lib/api";
import { fmtAgo } from "@/lib/utils";

export function ApiKeys() {
  const { wallet, connect } = useWallet();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (w: string) => {
    try {
      const { keys } = await keysApi.list(w);
      setKeys(keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load keys");
    }
  }, []);

  useEffect(() => {
    if (wallet) void load(wallet);
  }, [wallet, load]);

  async function generate() {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const { apiKey } = await keysApi.create(wallet);
      setFreshKey(apiKey);
      await load(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to generate key");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!wallet) return;
    setBusy(true);
    try {
      await keysApi.revoke(wallet, id);
      await load(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to revoke");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!freshKey) return;
    navigator.clipboard.writeText(freshKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!wallet) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect a wallet to manage API keys.
          </p>
          <Button className="mt-4" onClick={connect}>
            <Wallet className="h-4 w-4" /> Connect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">API keys</h2>
        <Button size="sm" onClick={generate} disabled={busy}>
          <Plus className="h-3.5 w-3.5" /> Generate key
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Token-gate the agent order API with <code className="data">X-API-Key</code>.
        Keys are SHA-256 hashed at rest and shown only once.
      </p>

      {/* One-time plaintext reveal */}
      {freshKey && (
        <FadeIn>
          <div className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-primary">
              <Key className="h-3.5 w-3.5" /> Your new key — copy it now
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="data flex-1 truncate rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-foreground">
                {freshKey}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> This is the only time it will be shown.
            </p>
          </div>
        </FadeIn>
      )}

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {/* Key list */}
      <div className="mt-6 space-y-2">
        {keys && keys.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/20 p-8 text-center text-sm text-muted-foreground">
            No keys yet.
          </div>
        )}
        {(keys ?? []).map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3"
          >
            <div>
              <div className="data text-sm text-foreground">{k.masked}</div>
              <div className="data mt-0.5 text-[11px] text-muted-foreground">
                {k.tier} · created {fmtAgo(k.createdAt)}
                {k.revokedAt ? " · revoked" : ""}
              </div>
            </div>
            {!k.revokedAt && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke(k.id)}
                disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

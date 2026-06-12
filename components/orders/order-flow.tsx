"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Eye, X, Loader2, Wallet, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhaseBadge } from "@/components/ui/badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { useWallet } from "@/lib/wallet";
import { ordersApi, type SessionOrder } from "@/lib/api";
import { computeCommitHash, randomSecretHex, usdToMicro } from "@/lib/commit";
import { cn, fmtUsdHr, shortHash } from "@/lib/utils";

const GPU_TYPES = ["H100 80GB", "A100 80GB", "RTX 4090", "L40S"];
const PHASES = ["committed", "revealed", "matched", "settled"] as const;

interface RevealData {
  secret: string;
  priceMicro: number;
  qty: number;
}

function saveReveal(id: string, data: RevealData) {
  localStorage.setItem(`obscura:reveal:${id}`, JSON.stringify(data));
}
function loadReveal(id: string): RevealData | null {
  const raw = localStorage.getItem(`obscura:reveal:${id}`);
  return raw ? (JSON.parse(raw) as RevealData) : null;
}

export function OrderFlow() {
  const { wallet, connect } = useWallet();
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [gpuType, setGpuType] = useState(GPU_TYPES[0]);
  const [price, setPrice] = useState("1.8000");
  const [qty, setQty] = useState("1");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSecret(randomSecretHex()), []);

  const refresh = useCallback(async (w: string) => {
    try {
      const { orders } = await ordersApi.list(w);
      setOrders(orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load orders");
    }
  }, []);

  useEffect(() => {
    if (wallet) void refresh(wallet);
  }, [wallet, refresh]);

  const priceNum = Number(price);
  const qtyNum = Number(qty);
  const validInputs = priceNum > 0 && Number.isInteger(qtyNum) && qtyNum > 0;

  const previewHash = useMemo(() => {
    if (!secret || !validInputs) return null;
    try {
      return computeCommitHash(usdToMicro(priceNum), BigInt(qtyNum), secret);
    } catch {
      return null;
    }
  }, [secret, validInputs, priceNum, qtyNum]);

  async function handleCommit() {
    setError(null);
    const w = wallet ?? connect();
    if (!validInputs || !previewHash) {
      setError("enter a positive price and a whole-number quantity");
      return;
    }
    setBusy(true);
    try {
      const priceMicro = Number(usdToMicro(priceNum));
      const { id } = await ordersApi.commit(w, gpuType, previewHash);
      saveReveal(id, { secret, priceMicro, qty: qtyNum });
      setSecret(randomSecretHex()); // rotate for the next order
      await refresh(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "commit failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal(order: SessionOrder) {
    if (!wallet) return;
    setError(null);
    const data = loadReveal(order.id);
    if (!data) {
      setError("reveal data for this order isn't on this device — it was committed elsewhere");
      return;
    }
    setBusy(true);
    try {
      await ordersApi.reveal(order.id, wallet, data.priceMicro, data.qty, data.secret);
      await refresh(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "reveal failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(order: SessionOrder) {
    if (!wallet) return;
    setBusy(true);
    try {
      await ordersApi.cancel(order.id, wallet);
      await refresh(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* New order */}
      <FadeIn direction="up">
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New order</h2>
            <WalletChip wallet={wallet} onConnect={connect} />
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gpu">GPU type</Label>
              <select
                id="gpu"
                value={gpuType}
                onChange={(e) => setGpuType(e.target.value)}
                className="data flex h-10 w-full rounded-md border border-border bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {GPU_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price ($/hr)</Label>
                <Input
                  id="price"
                  className="data"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  className="data"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
            </div>

            {/* Commit hash preview — the only thing that hits the chain */}
            <div className="rounded-md border border-dashed border-border bg-background/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                <Lock className="h-3 w-3" /> Commit hash (keccak256)
              </div>
              <div className="data mt-1.5 break-all text-xs text-primary">
                {previewHash ? `0x${previewHash}` : "—"}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                Computed client-side from price · qty · a random secret. Only this
                hash is submitted — your size and price stay private until reveal.
              </p>
            </div>

            <Button onClick={handleCommit} disabled={busy} className="w-full" size="lg">
              {busy ? <Loader2 className="animate-spin" /> : <Lock />}
              Commit order
            </Button>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </FadeIn>

      {/* Order list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your orders</h2>
          <span className="data text-xs text-muted-foreground">
            {orders.length} total
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="flex min-h-[30vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center text-sm text-muted-foreground">
            {wallet
              ? "No orders yet. Commit one to get started."
              : "Connect a wallet, then commit your first order."}
          </div>
        ) : (
          <StaggerContainer className="space-y-3">
            {orders.map((o) => (
              <StaggerItem key={o.id}>
                <OrderRow
                  order={o}
                  busy={busy}
                  onReveal={() => handleReveal(o)}
                  onCancel={() => handleCancel(o)}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  busy,
  onReveal,
  onCancel,
}: {
  order: SessionOrder;
  busy: boolean;
  onReveal: () => void;
  onCancel: () => void;
}) {
  const activeIdx = PHASES.indexOf(order.status as (typeof PHASES)[number]);
  const cancelled = order.status === "cancelled";

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{order.gpuType}</span>
          <PhaseBadge status={order.status} />
        </div>
        <div className="data text-xs text-muted-foreground">
          {shortHash(`0x${order.commitHash}`)}
        </div>
      </div>

      {/* Phase tracker */}
      {!cancelled && (
        <div className="mt-4 flex items-center gap-1">
          {PHASES.map((p, i) => (
            <div key={p} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= activeIdx ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "data text-[9px] uppercase tracking-wider",
                  i <= activeIdx ? "text-primary" : "text-muted-foreground/50",
                )}
              >
                {p.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {order.status === "committed" && (
          <Button size="sm" onClick={onReveal} disabled={busy}>
            <Eye className="h-3.5 w-3.5" /> Reveal
          </Button>
        )}
        {(order.status === "committed" || order.status === "revealed") && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
        {order.status === "revealed" && (
          <span className="data text-xs text-muted-foreground">
            in the next batch auction…
          </span>
        )}
      </div>
    </div>
  );
}

function WalletChip({
  wallet,
  onConnect,
}: {
  wallet: string | null;
  onConnect: () => void;
}) {
  if (!wallet) {
    return (
      <Button size="sm" variant="outline" onClick={onConnect}>
        <Wallet className="h-3.5 w-3.5" /> Connect
      </Button>
    );
  }
  return (
    <span className="data inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {shortHash(wallet, 4, 4)}
    </span>
  );
}

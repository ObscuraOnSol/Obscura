"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Trash2, Plus, Wallet, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { DataError } from "@/components/marketplace/marketplace-live";
import { useWallet } from "@/lib/wallet";
import { alertsApi, type PriceAlert } from "@/lib/api";
import { HARDWARE_LIST } from "@/lib/hardware";
import { fmtAgo } from "@/lib/utils";

// Filter down to GPU hardware models for the dropdown
const POPULAR_GPUS = HARDWARE_LIST.filter(h => h.type === "gpu").map(h => h.name);

export function PriceAlerts() {
  const { wallet, connect } = useWallet();
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  
  // Form state
  const [selectedGpu, setSelectedGpu] = useState(POPULAR_GPUS[0] || "NVIDIA H100 80GB");
  const [targetPrice, setTargetPrice] = useState("1.50");

  const load = useCallback(async (w: string) => {
    try {
      const { alerts } = await alertsApi.list(w);
      setAlerts(alerts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load price alerts");
    }
  }, []);

  useEffect(() => {
    if (wallet) void load(wallet);
  }, [wallet, load]);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid target price greater than 0");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await alertsApi.create(wallet, selectedGpu, price);
      await load(wallet);
      // Reset price input
      setTargetPrice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to create price alert");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAlert(id: string) {
    if (!wallet) return;
    setBusy(true);
    try {
      await alertsApi.delete(id, wallet);
      await load(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to delete alert");
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect a wallet to manage price alerts.
          </p>
          <Button className="mt-4" onClick={connect}>
            <Wallet className="h-4 w-4" /> Connect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mt-12 pt-8 border-t border-border/60">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary animate-pulse" />
        <h2 className="text-lg font-semibold">Price Alerts</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Get real-time notification alerts pushed to the dashboard when a GPU clearing price falls below your target.
      </p>

      {/* Create Alert Form */}
      <form onSubmit={createAlert} className="mt-6 p-4 rounded-xl border border-border bg-card/20 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GPU Model</label>
          <select
            value={selectedGpu}
            onChange={(e) => setSelectedGpu(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {POPULAR_GPUS.map((gpu) => (
              <option key={gpu} value={gpu}>
                {gpu}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-40">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Price ($/hr)</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="1.50"
              required
              className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full sm:w-auto h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Alert
        </Button>
      </form>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {/* Alerts list */}
      <div className="mt-6 space-y-2">
        {alerts && alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/20 p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <BellOff className="h-8 w-8 text-muted-foreground/60" />
            No price alerts active. Create one above to monitor pricing ticks.
          </div>
        )}
        {(alerts ?? []).map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
              alert.isTriggered 
                ? "border-amber-500/30 bg-amber-500/5" 
                : "border-border bg-card/40 hover:border-border-hover"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{alert.gpuType}</span>
                {alert.isTriggered ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <ShieldAlert className="h-2.5 w-2.5" /> Triggered
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Active
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>Target: <span className="font-semibold font-mono text-foreground">${alert.targetPrice.toFixed(2)}/hr</span></span>
                <span>•</span>
                <span>Created {fmtAgo(alert.createdAt)}</span>
                {alert.isTriggered && alert.triggeredAt && (
                  <>
                    <span>•</span>
                    <span className="text-amber-500 font-medium">Fell below target {fmtAgo(alert.triggeredAt)}</span>
                  </>
                )}
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteAlert(alert.id)}
              disabled={busy}
              className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

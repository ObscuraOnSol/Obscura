"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Wallet, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PhaseBadge } from "@/components/ui/badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { DataError } from "@/components/marketplace/marketplace-live";
import { useWallet } from "@/lib/wallet";
import { ordersApi, type SessionOrder } from "@/lib/api";
import { fmtAgo, shortHash } from "@/lib/utils";

export function ActivityFeed() {
  const { wallet, connect } = useWallet();
  const [orders, setOrders] = useState<SessionOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (w: string) => {
    try {
      const { orders } = await ordersApi.list(w);
      setOrders(orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load activity");
    }
  }, []);

  useEffect(() => {
    if (wallet) void load(wallet);
  }, [wallet, load]);

  function exportCsv() {
    if (!orders?.length) return;
    const header = "id,gpuType,status,revealed,commitHash,timestamp";
    const rows = orders.map((o) =>
      [o.id, o.gpuType, o.status, o.revealed, o.commitHash, o.ts].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obscura-activity-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!wallet) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect a wallet to see your activity timeline.
          </p>
          <Button className="mt-4" onClick={connect}>
            <Wallet className="h-4 w-4" /> Connect
          </Button>
        </div>
      </div>
    );
  }

  if (error) return <DataError message={error} />;

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {orders ? `${orders.length} events` : "Loading…"}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => wallet && load(wallet)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={!orders?.length}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {orders && orders.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center text-sm text-muted-foreground">
          No activity yet. Commit an order to get started.
        </div>
      ) : (
        <FadeIn>
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <StaggerContainer staggerDelay={0.04}>
              {(orders ?? []).map((o) => (
                <StaggerItem key={o.id}>
                  <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 last:border-0">
                    <div className="flex items-center gap-4">
                      <PhaseBadge status={o.status} />
                      <div>
                        <div className="text-sm font-medium">{o.gpuType}</div>
                        <div className="data text-xs text-muted-foreground">
                          {shortHash(`0x${o.commitHash}`)}
                        </div>
                      </div>
                    </div>
                    <div className="data text-xs text-muted-foreground">
                      {fmtAgo(o.ts)}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeIn>
      )}
    </>
  );
}

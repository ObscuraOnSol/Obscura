"use client";

import { useEffect, useState } from "react";

import { StatCard } from "@/components/app-frame";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { PhaseBadge } from "@/components/ui/badge";
import { DataError } from "@/components/marketplace/marketplace-live";
import {
  marketApi,
  type MarketStats,
  type Settlement,
  type OrderMetric,
} from "@/lib/api";
import { fmtUsdHr, fmtAgo } from "@/lib/utils";

export function DashboardLive() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [metrics, setMetrics] = useState<OrderMetric[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      marketApi.stats(),
      marketApi.settlements(8),
      marketApi.orderMetrics(),
    ])
      .then(([s, set, m]) => {
        setStats(s);
        setSettlements(set.settlements);
        setMetrics(m.breakdown);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "failed to load dashboard"),
      );
  }, []);

  if (error) return <DataError message={error} />;
  if (!stats || !settlements || !metrics) return <Skeleton />;

  const openOrders = metrics.reduce((n, m) => n + (m.total - m.settled), 0);

  return (
    <>
      <StaggerContainer
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        staggerDelay={0.07}
      >
        <StaggerItem>
          <StatCard label="Fills (24h)" value={String(stats.totalFills)} sub="across all batches" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Avg clearing price"
            value={stats.avgClearingPrice != null ? fmtUsdHr(stats.avgClearingPrice) : "—"}
            sub="24h volume-weighted"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="GPU markets" value={String(stats.gpuTypes)} sub="active types" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Open orders" value={String(openOrders)} sub="committed + revealed" />
        </StaggerItem>
      </StaggerContainer>

      <FadeIn direction="up" delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/40">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">
            Recent batch settlements
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-normal">Batch</th>
                <th className="px-5 py-2.5 font-normal">GPU</th>
                <th className="px-5 py-2.5 font-normal">Phase</th>
                <th className="px-5 py-2.5 font-normal">Fills</th>
                <th className="px-5 py-2.5 text-right font-normal">Clearing</th>
                <th className="px-5 py-2.5 text-right font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s, i) => (
                <tr key={`${s.batchId}-${s.gpuType}-${i}`} className="border-b border-border/60 last:border-0">
                  <td className="data px-5 py-3 text-muted-foreground">#{s.batchId}</td>
                  <td className="px-5 py-3">{s.gpuType}</td>
                  <td className="px-5 py-3">
                    <PhaseBadge status="settled" />
                  </td>
                  <td className="data px-5 py-3">{s.fillCount}</td>
                  <td className="data px-5 py-3 text-right">{fmtUsdHr(s.clearingPrice)}</td>
                  <td className="data px-5 py-3 text-right text-muted-foreground">{fmtAgo(s.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-xl border border-border bg-card/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card/30" />
    </div>
  );
}

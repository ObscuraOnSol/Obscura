"use client";

import { useEffect, useState } from "react";
import { Zap, Coins, Cpu, ScrollText, Clock } from "lucide-react";

import { StatCard } from "@/components/app-frame";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { PhaseBadge } from "@/components/ui/badge";
import { DataError } from "@/components/marketplace/marketplace-live";
import {
  marketApi,
  WS_BASE,
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

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(45);

  useEffect(() => {
    if (!stats?.batchStats) return;

    const nextRun = stats.batchStats.nextRun;
    setIntervalSeconds(stats.batchStats.intervalSeconds || 45);

    const computeTimeLeft = (targetMs: number) => {
      const now = Date.now();
      const diff = Math.ceil((targetMs - now) / 1000);
      return Math.max(0, diff);
    };

    // Set initial value immediately
    setTimeLeft(computeTimeLeft(nextRun));

    const timerId = setInterval(() => {
      setTimeLeft(computeTimeLeft(nextRun));
    }, 1000);

    return () => clearInterval(timerId);
  }, [stats?.batchStats?.nextRun]);

  const formatSeconds = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    // Initial fetch to load page state immediately
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

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let socket: WebSocket | null = null;

    const startPolling = () => {
      if (pollingInterval) return;
      console.log("[ws/polling] starting fallback polling");
      pollingInterval = setInterval(() => {
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
          .catch((e) => console.error("[polling] fallback fetch failed:", e));
      }, 5000); // Poll every 5s
    };

    const stopPolling = () => {
      if (pollingInterval) {
        console.log("[ws/polling] stopping fallback polling");
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const connectWebSocket = () => {
      try {
        socket = new WebSocket(WS_BASE);

        socket.onopen = () => {
          console.log("[ws] connected to dashboard stream");
          stopPolling();
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "settlement") {
              console.log("[ws] received live settlement update", msg.data);
              const { settlements: newSettle, stats: newStats, metrics: newMetrics } = msg.data;
              
              if (newStats) setStats(newStats);
              if (newMetrics) setMetrics(newMetrics);
              if (newSettle && newSettle.length > 0) {
                setSettlements((prev) => {
                  if (!prev) return newSettle;
                  const combined = [...newSettle, ...prev];
                  return combined.slice(0, 8);
                });
              }
            }
          } catch (err) {
            console.error("[ws] failed to parse message:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("[ws] error, falling back to polling:", err);
          startPolling();
        };

        socket.onclose = () => {
          console.log("[ws] disconnected, falling back to polling");
          startPolling();
        };
      } catch (err) {
        console.error("[ws] failed to create WebSocket, falling back to polling:", err);
        startPolling();
      }
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      stopPolling();
    };
  }, []);



  if (error) return <DataError message={error} />;
  if (!stats || !settlements || !metrics) return <Skeleton />;

  const openOrders = metrics.reduce((n, m) => n + (m.total - m.settled), 0);

  return (
    <>
      {stats?.batchStats && (
        <FadeIn direction="down" className="mb-6">
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-card/30 p-5 backdrop-blur-md">
            {/* Background design elements */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <Clock className="h-5 w-5 text-primary animate-pulse" />
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
                    ZK Batch Auction Clearing
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/20">
                      Live
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Orders are ZK-matched and settled in uniform-price batch auctions.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Next auction clear
                    </span>
                    <span className="font-mono text-3xl font-extrabold text-primary tabular-nums mt-0.5 tracking-tight">
                      {formatSeconds(timeLeft)}
                    </span>
                  </div>

                  <div className="h-10 w-px bg-border/60 hidden sm:block" />

                  <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Batch Interval
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground mt-0.5">
                      {intervalSeconds}s
                    </span>
                  </div>
                </div>

                <div className="relative flex-1 sm:flex-none w-full sm:w-48">
                  <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]"
                      style={{
                        width: `${Math.max(0, Math.min(100, (timeLeft / intervalSeconds) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      <StaggerContainer
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        staggerDelay={0.07}
      >
        <StaggerItem>
          <StatCard
            label="Fills (24h)"
            value={String(stats.totalFills)}
            sub="across all batches"
            icon={Zap}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Avg clearing price"
            value={stats.avgClearingPrice != null ? fmtUsdHr(stats.avgClearingPrice) : "-"}
            sub="24h volume-weighted"
            icon={Coins}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="GPU markets"
            value={String(stats.gpuTypes)}
            sub="active types"
            icon={Cpu}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Open orders"
            value={String(openOrders)}
            sub="committed + revealed"
            icon={ScrollText}
          />
        </StaggerItem>
      </StaggerContainer>

      <FadeIn direction="up" delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/40">
          <div className="border-b border-border px-5 py-3 text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
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
                  <td className="px-5 py-3 flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span>{s.gpuType}</span>
                  </td>
                  <td className="px-5 py-3">
                    <PhaseBadge status="settled" />
                  </td>
                  <td className="data px-5 py-3">{s.fillCount}</td>
                  <td className="data px-5 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <img src="/usdc_logo.png" alt="USDC" className="h-3.5 w-3.5 object-contain rounded-full" />
                      <span>{fmtUsdHr(s.clearingPrice)}</span>
                    </div>
                  </td>
                  <td className="data px-5 py-3 text-right text-muted-foreground">
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <Clock className="h-3.5 w-3.5 opacity-60" />
                      <span>{fmtAgo(s.ts)}</span>
                    </div>
                  </td>
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

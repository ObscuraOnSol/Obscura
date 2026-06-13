"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { marketApi, type ProviderRow, type MarketPrice } from "@/lib/api";
import { fmtUsdHr } from "@/lib/utils";

interface Row extends ProviderRow {
  clearingPrice: number | null;
}

export function MarketplaceLive() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([marketApi.providers(), marketApi.prices()])
      .then(([{ providers }, { prices }]) => {
        const priceBy = new Map<string, MarketPrice>(
          prices.map((p) => [p.gpuType, p]),
        );
        setRows(
          providers.map((p) => ({
            ...p,
            clearingPrice: priceBy.get(p.gpuType)?.clearingPrice ?? null,
          })),
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "failed to load marketplace"),
      );
  }, []);

  if (error) return <DataError message={error} />;
  if (!rows) return <SkeletonGrid />;

  return (
    <>
      <StaggerContainer className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
        {rows.map((p) => (
          <StaggerItem key={p.gpuType}>
            <div className="group rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/30">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold">{p.gpuType}</div>
                <div className="data text-xl font-bold text-primary">
                  {p.clearingPrice != null ? fmtUsdHr(p.clearingPrice) : "-"}
                </div>
              </div>
              <div className="data mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>{p.capacity} units available</span>
                <span>{p.providerCount} providers</span>
                <span>{Math.round(p.totalStake).toLocaleString()} $OBSC staked</span>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>

    </>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[104px] animate-pulse rounded-xl border border-border bg-card/30"
        />
      ))}
    </div>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <FadeIn className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-destructive/25 bg-destructive/5 p-8 shadow-xl backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">API Connection Offline</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Obscura was unable to communicate with the compute pool API. The node might be temporarily offline, or your local backend is not active.
        </p>

        <div className="mt-6 border-t border-border/40 pt-4 text-left">
          <details className="group cursor-pointer">
            <summary className="list-none flex items-center justify-between text-xs font-mono text-muted-foreground/80 hover:text-foreground select-none">
              <span>Technical Details</span>
              <span className="transition-transform duration-200 group-open:rotate-180 text-[10px]">▼</span>
            </summary>
            <div className="mt-3 text-[11px] font-mono leading-relaxed text-muted-foreground/60 break-words bg-black/30 rounded-lg p-3 border border-border/30">
              <p className="text-destructive/80 font-semibold mb-1">Error: {message}</p>
              <p className="mt-1">
                Ensure the backend service is running on <code className="text-foreground bg-white/5 px-1 py-0.5 rounded font-bold">NEXT_PUBLIC_API_URL</code>.
              </p>
              <p className="mt-2 text-primary">
                To start it: <code className="text-foreground bg-white/5 px-1 py-0.5 rounded font-bold">cd backend && bun run dev</code>
              </p>
            </div>
          </details>
        </div>
      </div>
    </FadeIn>
  );
}

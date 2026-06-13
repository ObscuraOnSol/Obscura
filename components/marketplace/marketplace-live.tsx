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
    <FadeIn>
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">Couldn&apos;t reach the API</div>
          <p className="mt-1 text-destructive/80">
            {message}. Is the backend running on{" "}
            <code className="data">NEXT_PUBLIC_API_URL</code>? Start it with{" "}
            <code className="data">cd backend &amp;&amp; bun run dev</code>.
          </p>
        </div>
      </div>
    </FadeIn>
  );
}

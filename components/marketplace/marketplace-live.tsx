"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Server,
  Boxes,
  Coins,
  Search,
  PlusCircle,
  Globe,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { marketApi, providersApi, type ProviderRow, type MarketPrice } from "@/lib/api";
import { fmtUsdHr } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";

interface Row extends ProviderRow {
  clearingPrice: number | null;
}

export function MarketplaceLive() {
  const [activeTab, setActiveTab] = useState<"rent" | "provide">("rent");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshList = () => {
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
  };

  useEffect(() => {
    refreshList();
  }, []);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border/40 pb-px">
        <button
          onClick={() => setActiveTab("rent")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative ${
            activeTab === "rent"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Rent GPUs
        </button>
        <button
          onClick={() => setActiveTab("provide")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative ${
            activeTab === "provide"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Provide GPU (Seller)
        </button>
      </div>

      {activeTab === "rent" ? (
        <>
          {/* General Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search GPU models (e.g., H100, RTX 4090)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-card/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground/60 outline-none transition-colors focus:border-primary/50 focus:bg-card/60"
            />
          </div>

          {error ? (
            <DataError message={error} />
          ) : !rows ? (
            <SkeletonGrid />
          ) : rows.filter((p) => p.gpuType.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <FadeIn>
              <div className="flex min-h-[20vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/10 p-8 text-center text-sm text-muted-foreground">
                No GPU models match your search.
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
              {rows
                .filter((p) => p.gpuType.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((p) => (
                  <StaggerItem key={p.gpuType}>
                    <div className="group rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/30">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          {p.gpuType}
                        </div>
                        <div className="data flex items-center gap-1.5 text-xl font-bold text-primary">
                          <img src="/usdc_logo.png" alt="USDC" className="h-4 w-4 object-contain rounded-full" />
                          {p.clearingPrice != null ? fmtUsdHr(p.clearingPrice).replace("$", "") : "-"}
                        </div>
                      </div>
                      <div className="data mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Boxes className="h-3.5 w-3.5 text-muted-foreground/80" />
                          {p.capacity} units available
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Server className="h-3.5 w-3.5 text-muted-foreground/80" />
                          {p.providerCount} providers
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Coins className="h-3.5 w-3.5 text-muted-foreground/80" />
                          {p.totalStake > 0 ? `${p.totalStake.toLocaleString()} $OBSC` : "- $OBSC"} staked
                        </span>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
            </StaggerContainer>
          )}
        </>
      ) : (
        <ProvideGpuForm onRegistered={refreshList} />
      )}
    </div>
  );
}

function ProvideGpuForm({ onRegistered }: { onRegistered: () => void }) {
  const { wallet, connect } = useWallet();
  const [gpuType, setGpuType] = useState("H100 80GB");
  const [customGpu, setCustomGpu] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [stake, setStake] = useState("500");
  
  // Connection details
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      connect();
      return;
    }
    
    setError(null);
    setSuccess(false);
    
    const finalGpu = gpuType === "Custom" ? customGpu.trim() : gpuType;
    if (!finalGpu) {
      setError("Please specify a GPU model");
      return;
    }
    
    const capNum = parseInt(capacity);
    if (isNaN(capNum) || capNum <= 0) {
      setError("Capacity must be a positive integer");
      return;
    }
    
    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum < 0) {
      setError("Stake amount must be a positive number");
      return;
    }

    setBusy(true);
    try {
      await providersApi.register(
        wallet,
        finalGpu,
        capNum,
        stakeNum,
        host.trim() || undefined,
        port.trim() || undefined,
        username.trim() || undefined,
        password.trim() || undefined
      );
      setSuccess(true);
      // Reset form
      setCapacity("1");
      setHost("");
      setPort("22");
      setUsername("root");
      setPassword("");
      // Trigger list refresh
      onRegistered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (!wallet) {
    return (
      <FadeIn>
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-2xl border border-border bg-card/20 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground mb-4">
            <PlusCircle className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">List Your GPU Node</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Connect your wallet to register compute capacity, stake collateral, and start earning USDC matching fees.
          </p>
          <Button onClick={connect} className="mt-5">
            Connect Wallet
          </Button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <form onSubmit={handleRegister} className="mx-auto max-w-xl rounded-2xl border border-border bg-card/40 p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">Register GPU Node Capacity</h3>
          <p className="text-xs text-muted-foreground">
            Provide details of your GPU hardware to list it in the Obscura Marketplace.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>GPU node capacity successfully registered to compute pool!</span>
          </div>
        )}

        <div className="space-y-4">
          {/* GPU Model & Custom */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="gpuType" className="text-xs font-medium text-muted-foreground">GPU Model</label>
              <select
                id="gpuType"
                value={gpuType}
                onChange={(e) => setGpuType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="H100 80GB">H100 80GB</option>
                <option value="A100 80GB">A100 80GB</option>
                <option value="RTX 4090">RTX 4090</option>
                <option value="L40S">L40S</option>
                <option value="Custom">Custom...</option>
              </select>
            </div>

            {gpuType === "Custom" && (
              <div className="space-y-1.5">
                <label htmlFor="customGpu" className="text-xs font-medium text-muted-foreground">Custom GPU Model Name</label>
                <input
                  id="customGpu"
                  type="text"
                  placeholder="e.g. RTX 3090, A6000"
                  value={customGpu}
                  onChange={(e) => setCustomGpu(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              </div>
            )}
          </div>

          {/* Capacity & Stake */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="capacity" className="text-xs font-medium text-muted-foreground">Available Capacity (Units)</label>
              <input
                id="capacity"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="stake" className="text-xs font-medium text-muted-foreground">Collateral Stake ($OBSC)</label>
              <div className="relative">
                <input
                  id="stake"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="500"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background/60 pl-3 pr-12 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">$OBSC</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 my-4 pt-4">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Globe className="h-3.5 w-3.5 text-primary" /> SSH Node Connection Details (Optional)
            </h4>
            <p className="text-[10px] text-muted-foreground mb-4">
              Enter the SSH details users will use to connect once matched and settled.
            </p>

            <div className="space-y-4">
              {/* Host & Port */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="host" className="text-xs font-medium text-muted-foreground">SSH Host / IP Address</label>
                  <input
                    id="host"
                    type="text"
                    placeholder="e.g. 82.102.34.12, node.obscura.net"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="port" className="text-xs font-medium text-muted-foreground">SSH Port</label>
                  <input
                    id="port"
                    type="text"
                    placeholder="22"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-xs font-medium text-muted-foreground">Username</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="root"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password / Auth Key</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{busy ? "Registering GPU Node..." : "Register GPU Node"}</span>
        </Button>
      </form>
    </FadeIn>
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

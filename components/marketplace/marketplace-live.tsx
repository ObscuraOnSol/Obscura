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
  User,
  Key,
  Settings,
  Lock,
} from "lucide-react";
import { useConnection } from "@solana/wallet-adapter-react";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { marketApi, providersApi, type ProviderRow } from "@/lib/api";
import { fmtUsdHr, shortHash } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { performUsdcTransfer } from "@/lib/solana";

const OBSCURA_COLLATERAL_WALLET = "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6";

interface Row {
  id: string;
  wallet: string;
  gpuType: string;
  capacity: number;
  stakeAmount: number;
  rateMicro: number;
  successfulPings: number;
  failedPings: number;
  status: string;
}

export function MarketplaceLive() {
  const [activeTab, setActiveTab] = useState<"rent" | "provide">("rent");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshList = () => {
    marketApi.providers()
      .then(({ providers }) => {
        setRows(providers as Row[]);
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
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative flex items-center gap-2 ${
            activeTab === "rent"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-4 w-4" /> Rent GPUs
        </button>
        <button
          onClick={() => setActiveTab("provide")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative flex items-center gap-2 ${
            activeTab === "provide"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <PlusCircle className="h-4 w-4" /> Provide GPU (Seller)
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
                No active GPU providers match your search.
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
              {rows
                .filter((p) => p.gpuType.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((p) => {
                  const totalPings = p.successfulPings + p.failedPings;
                  const uptime = totalPings > 0 ? (p.successfulPings / totalPings) * 100 : 100;

                  return (
                    <StaggerItem key={p.id}>
                      <div className="group rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/30">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                              <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              {p.gpuType}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-1">
                              Operator: {shortHash(p.wallet, 5, 4)}
                            </div>
                          </div>
                          <div className="data flex items-center gap-1.5 text-xl font-bold text-primary">
                            <img src="/usdc_logo.png" alt="USDC" className="h-4 w-4 object-contain rounded-full" />
                            {fmtUsdHr(p.rateMicro / 1_000_000).replace("$", "")}
                          </div>
                        </div>

                        {/* Uptime Bar */}
                        <div className="mt-4 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Node Uptime</span>
                            <span className="font-semibold">{uptime.toFixed(1)}% ({p.successfulPings}/{totalPings} checks)</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                uptime >= 90
                                  ? "bg-emerald-500"
                                  : uptime >= 75
                                    ? "bg-amber-500"
                                    : "bg-destructive"
                              }`}
                              style={{ width: `${uptime}%` }}
                            />
                          </div>
                        </div>

                        <div className="data mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5 text-muted-foreground/80" />
                            {p.stakeAmount} USDC collateral
                          </span>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
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
  const { wallet, connect, sendTransaction, publicKey } = useWallet();
  const { connection } = useConnection();

  const [gpuType, setGpuType] = useState("H100 80GB");
  const [customGpu, setCustomGpu] = useState("");
  const [rate, setRate] = useState("1.80");

  // Connection details (required)
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const rateNum = parseFloat(rate);
  const calculatedCollateral = isNaN(rateNum) ? 0 : rateNum * 17.78;
  const sellerProtocolFee = calculatedCollateral * 0.007;
  const totalSellerPayable = calculatedCollateral + sellerProtocolFee;
  const finalGpu = gpuType === "Custom" ? customGpu.trim() : gpuType;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !publicKey || !sendTransaction) {
      connect();
      return;
    }

    setError(null);
    setSuccess(false);

    if (!finalGpu) {
      setError("Please specify a GPU model");
      return;
    }

    if (isNaN(rateNum) || rateNum <= 0) {
      setError("Hourly rate must be positive");
      return;
    }

    if (calculatedCollateral <= 0) {
      setError("Hourly rate must result in a positive collateral value");
      return;
    }

    if (!host.trim() || !port.trim() || !username.trim() || !password.trim()) {
      setError("All SSH node connection details are required.");
      return;
    }

    setBusy(true);
    try {
      // 1. Perform on-chain transfer of USDC collateral stake + 0.7% protocol fee
      const txSig = await performUsdcTransfer(
        connection,
        publicKey,
        sendTransaction,
        OBSCURA_COLLATERAL_WALLET,
        totalSellerPayable,
      );

      // 2. Call backend register API with capacity=1 (units removed)
      const rateMicroNum = Math.round(rateNum * 1_000_000);
      await providersApi.register(
        wallet,
        finalGpu,
        1,
        calculatedCollateral,
        host.trim(),
        port.trim(),
        username.trim(),
        password.trim(),
        rateMicroNum,
        txSig,
      );

      setSuccess(true);
      // Reset form connection details
      setHost("");
      setPort("22");
      setUsername("root");
      setPassword("");
      // Trigger list refresh
      onRegistered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collateral payment or registration failed");
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
            Connect your wallet to lock compute collateral, register capacity, and start earning USDC.
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
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] max-w-5xl mx-auto items-start">
        {/* Left Form */}
        <form onSubmit={handleRegister} className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8 space-y-6">
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
              <span>GPU node capacity successfully registered and collateral locked!</span>
            </div>
          )}

          <div className="space-y-4">
            {/* GPU Model & Custom */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="gpuType" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" /> GPU Model
                </label>
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
                  <label htmlFor="customGpu" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-primary" /> Custom Name
                  </label>
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

            {/* Rate & Stake */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="rate" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-primary" /> Rate ($/hr)
                </label>
                <div className="relative">
                  <input
                    id="rate"
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    placeholder="1.80"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background/60 pl-3 pr-12 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  />
                  <img src="/usdc_logo.png" alt="USDC" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 object-contain rounded-full" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="stake" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Collateral
                </label>
                <div className="relative">
                  <input
                    id="stake"
                    type="text"
                    value={rateNum > 0 ? (rateNum * 17.78).toFixed(4) : ""}
                    disabled
                    className="flex h-10 w-full rounded-md border border-border/40 bg-background/20 pl-3 pr-12 py-1.5 text-xs text-muted-foreground opacity-70 cursor-not-allowed focus-visible:outline-none"
                  />
                  <img src="/usdc_logo.png" alt="USDC" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 object-contain rounded-full opacity-60" />
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 my-4 pt-4">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <Globe className="h-3.5 w-3.5 text-primary animate-pulse" /> SSH Connection Settings
              </h4>
              <p className="text-[10px] text-muted-foreground mb-4">
                Enter connection settings which will be forwarded to matched clients.
              </p>

              <div className="space-y-4">
                {/* Host & Port */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="host" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-primary" /> Host / IP Address
                    </label>
                    <input
                      id="host"
                      type="text"
                      placeholder="e.g. 82.102.34.12"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="port" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5 text-primary" /> Port
                    </label>
                    <input
                      id="port"
                      type="text"
                      placeholder="22"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>
                </div>

                {/* Username & Password */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="username" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" /> Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      placeholder="root"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-primary" /> Password / Key
                    </label>
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Right Preview Card */}
        <div className="rounded-2xl border border-primary/20 bg-card/60 p-6 flex flex-col justify-between h-full min-h-[380px] shadow-xl shadow-black/40 backdrop-blur-md relative overflow-hidden group">
          {/* Subtle watermark background */}
          <div className="absolute -right-10 -bottom-10 opacity-[0.03] text-primary transition-transform group-hover:scale-110 duration-300">
            <Cpu className="h-44 w-44 rotate-[-12deg]" />
          </div>

          <div className="space-y-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Node Listing Preview</div>
              <h4 className="text-sm font-semibold text-foreground mt-1 flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> {finalGpu || "Unknown GPU"}
              </h4>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1 border-b border-border/30 pb-3">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3 text-primary" /> Hourly Lease Rate
                </span>
                <span className="text-lg font-bold text-foreground flex items-center gap-1.5">
                  <img src="/usdc_logo.png" alt="USDC" className="h-4.5 w-4.5 object-contain rounded-full" />
                  {rateNum > 0 ? rateNum.toFixed(4) : "0.0000"} <span className="text-xs text-muted-foreground font-normal">/ hr</span>
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/30 pb-3">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3 text-primary" /> Collateral Lock Required
                </span>
                <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <img src="/usdc_logo.png" alt="USDC" className="h-3.5 w-3.5 object-contain rounded-full" />
                  {calculatedCollateral > 0 ? calculatedCollateral.toFixed(4) : "0.0000"} USDC
                </span>
                <span className="text-[9px] text-muted-foreground leading-normal mt-0.5">
                  Rate-proportional collateral (17.78x hourly rate). Slashed 25% per failed healthcheck.
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/30 pb-3">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3 text-primary" /> Protocol Fee (0.7%)
                </span>
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <img src="/usdc_logo.png" alt="USDC" className="h-3.5 w-3.5 object-contain rounded-full" />
                  {sellerProtocolFee > 0 ? sellerProtocolFee.toFixed(4) : "0.0000"} USDC
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/30 pb-3">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3 text-primary animate-pulse" /> Total to Pay
                </span>
                <span className="text-base font-extrabold text-primary flex items-center gap-1.5">
                  <img src="/usdc_logo.png" alt="USDC" className="h-4.5 w-4.5 object-contain rounded-full" />
                  {totalSellerPayable > 0 ? totalSellerPayable.toFixed(4) : "0.0000"} USDC
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/30 pb-3">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3 text-primary" /> SSH Command Preview
                </span>
                <div className="rounded-lg border border-border bg-background/50 p-2.5 font-mono text-[10px] text-muted-foreground break-all leading-normal select-none">
                  ssh {username || "root"}@{host || "host_ip"} {port && port !== "22" ? `-p ${port}` : ""}
                </div>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            variant="white"
            onClick={() => {
              const formEl = document.querySelector("form");
              if (formEl) formEl.requestSubmit();
            }}
            className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 font-semibold transition-transform duration-200 active:scale-95 shadow-lg shadow-white/5 border border-white"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin text-black" />}
            <span>{busy ? "Locking Collateral & Listing..." : "Lock Collateral & List GPU"}</span>
          </Button>
        </div>
      </div>
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

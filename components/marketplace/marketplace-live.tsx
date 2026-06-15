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
  ChevronDown,
  X,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { HARDWARE_LIST } from "@/lib/hardware";
import confetti from "canvas-confetti";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import Link from "next/link";
import { marketApi, providersApi, type ProviderRow } from "@/lib/api";
import { fmtUsdHr, shortHash } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { performUsdcTransfer, performUsdcSplitTransfer, signAndSendSerializedTransaction } from "@/lib/solana";

const OBSCURA_COLLATERAL_WALLET = "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6";
const OBSCURA_SERVICE_WALLET = "FHMr5nLShb3AxFmdqS2dEwdseKFvaic6vyFcCm3Hm6Jn";

function getBrandLogo(brand: string, className = "h-3.5 w-3.5") {
  const b = brand.toUpperCase();
  if (b === "NVIDIA") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#76B900]`} fill="currentColor">
        <path d="M23.997 12a11.996 11.996 0 01-11.995 12c-4.966 0-9.255-3.01-11.085-7.293L4.9 14.8c1.378 2.052 3.822 3.4 6.6 3.4 3.93 0 7.15-2.936 7.15-6.52s-3.22-6.52-7.15-6.52c-2.6 0-4.9 1.22-6.313 3.1l-3.8-1.5C3.292 3.167 7.373 0 12.002 0c6.626 0 11.995 5.373 11.995 12z" />
      </svg>
    );
  }
  if (b === "AMD") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#ED1C24]`} fill="currentColor">
        <path d="M12 0L1.5 10.5V24h12V13.5h7.5L24 10.5V0H12zm9 9h-9v9H9V9H3V3h18v6z" />
      </svg>
    );
  }
  if (b === "INTEL") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#0071C5]`} fill="currentColor">
        <path d="M21.412 17.039c.07-.492.105-1.04.105-1.638v-6.223h-2.14v6.188c0 .878-.457 1.353-1.336 1.353h-3.69c-.879 0-1.353-.475-1.353-1.353V9.178H10.86v6.223c0 .598.035 1.146.105 1.638H1.723V6.786h2.145V14.65c0 .878.474 1.353 1.353 1.353h3.69c.879 0 1.353-.475 1.353-1.353V6.786H12.41V14.65c0 .878.475 1.353 1.353 1.353h3.69c.879 0 1.354-.475 1.354-1.353v-7.864h2.144V14.65c0 .878.475 1.353 1.354 1.353h1.16v-2.073h-1.16v.72c0 .878-.475 1.353-1.354 1.353h-3.69c-.879 0-1.353-.475-1.353-1.353v-5.263h2.14v5.228c0 .878.457 1.353 1.336 1.353h3.69c.879 0 1.353-.475 1.353-1.353v-5.228h2.14v5.263z" />
      </svg>
    );
  }
  if (b === "APPLE") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#A2AAAD]`} fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.52 2.81-1.33z" />
      </svg>
    );
  }
  if (b === "DELL") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#0076c0]`} fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m.018 20.315c-4.577 0-8.298-3.72-8.298-8.297 0-4.578 3.72-8.299 8.298-8.299 4.577 0 8.297 3.72 8.297 8.299 0 4.577-3.72 8.297-8.297 8.297M8.344 7.643H5.976v8.697h2.61c2.197 0 3.32-.976 3.32-2.583 0-1.296-.64-2.127-1.871-2.45v-.063c1.037-.367 1.579-1.127 1.579-2.274 0-1.428-.971-2.316-2.582-2.316v-.011zm.703 3.652c.703 0 1.135-.304 1.135-.98 0-.668-.426-.957-1.135-.957h-1.07v1.937h1.07zm.052 3.593c.792 0 1.282-.338 1.282-1.035 0-.712-.49-1.011-1.282-1.011h-1.122v2.046H9.1zm3.896.452h3.914v-1.464H14.88v-2.015h1.996v-1.439H14.88V9.106h2.146V7.643H12.99v8.697h.006zm5.836 0h2.645V7.643h-1.614v7.195H17.84zm3.084 0H22v-8.697h-1.614v7.195H20.92v.006z" />
      </svg>
    );
  }
  if (b === "HP") {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-[#0096D6]`} fill="currentColor">
        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm.018 20.315c-4.577 0-8.298-3.72-8.298-8.297 0-4.578 3.72-8.299 8.298-8.299 4.577 0 8.297 3.72 8.297 8.299 0 4.577-3.72 8.297-8.297 8.297M8.645 19.385l.775-3.32h1.258c1.92 0 2.85-1.012 3.125-2.2a2.38 2.38 0 00-2.22-2.915H9.684l.872-3.75h1.745l-.407 1.75h1.455c1.92 0 2.85-1.012 3.125-2.2a2.38 2.38 0 00-2.22-2.915h-3.49L9.123 18.89c-.1.43-.497.77-1.239.77H7.4l-.565 2.43c-.07.288.15.562.443.562l1.367-.007v-.005l.001-.002-.001-.263z" />
      </svg>
    );
  }
  return <Cpu className={`${className} text-primary`} />;
}

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "provide") {
        setActiveTab("provide");
      }
    }
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
              placeholder="Search hardware models (e.g., H100, RTX 4090)..."
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
              <div className="flex min-h-[25vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/10 p-8 text-center text-sm text-muted-foreground gap-4">
                <span>No active GPU providers match your search.</span>
                <Button
                  onClick={() => setActiveTab("provide")}
                  variant="outline"
                  className="flex items-center gap-2 border-primary/30 hover:border-primary/50 text-foreground transition-all duration-200"
                >
                  <PlusCircle className="h-4 w-4 text-primary" />
                  Switch to Provide GPU Screen
                </Button>
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
                      <Link
                        href={`/orders?gpuType=${encodeURIComponent(p.gpuType)}`}
                        className="group block rounded-xl border border-border bg-card/40 p-6 transition-all hover:border-primary/30 hover:bg-card/50 cursor-pointer text-left"
                      >
                        <div className="flex items-baseline justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                              <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              <span>{p.gpuType}</span>
                              {p.capacity <= 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Allocated
                                </span>
                              )}
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
                      </Link>
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

  const [gpuType, setGpuType] = useState("NVIDIA H100 80GB");
  const [customGpu, setCustomGpu] = useState("");
  const [rate, setRate] = useState("1.80");

  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [tempCustomModel, setTempCustomModel] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  // Connection details (required)
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      
      const timer = setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.6 }
        });
      }, 250);
      
      return () => clearTimeout(timer);
    }
  }, [success]);

  const rateNum = parseFloat(rate);
  const calculatedCollateral = isNaN(rateNum) ? 0 : rateNum * 17.78;
  const sellerProtocolFee = calculatedCollateral * 0.007;
  const totalSellerPayable = calculatedCollateral + sellerProtocolFee;
  const finalGpu = gpuType === "Custom" ? customGpu.trim() : gpuType;

  const filteredHardware = HARDWARE_LIST.filter((item) => {
    if (searchFilter && !item.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    if (brandFilter !== "All" && item.brand.toLowerCase() !== brandFilter.toLowerCase()) {
      return false;
    }
    if (typeFilter !== "All" && item.type.toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }
    if (yearFilter !== "All") {
      if (yearFilter === "Older") {
        if (item.releaseYear > 2020) return false;
      } else {
        if (item.releaseYear !== parseInt(yearFilter)) return false;
      }
    }
    return true;
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !publicKey || !sendTransaction) {
      connect();
      return;
    }

    setError(null);
    setSuccess(false);

    if (!finalGpu) {
      setError("Please specify a hardware model");
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
      // 1. Request serialized transaction from backend
      const { serializedTx } = await providersApi.buildRegisterTx(
        publicKey.toBase58(),
        rateNum
      );

      // 2. Sign and send transaction
      const txSig = await signAndSendSerializedTransaction(
        connection,
        serializedTx,
        sendTransaction
      );

      // 3. Call backend register API with capacity=1 (units removed)
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



          <div className="space-y-4">
            {/* Hardware Model & Custom */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" /> Hardware Model
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTempCustomModel(gpuType === "Custom" ? customGpu : "");
                    setIsModelModalOpen(true);
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring hover:bg-background/80 transition-colors"
                >
                  <span className="truncate">
                    {gpuType === "Custom" ? (customGpu ? `Custom: ${customGpu}` : "Custom Hardware...") : gpuType}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
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
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Preview</div>
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

      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-[#0c0d10] p-6 shadow-2xl flex flex-col max-h-[85vh] text-foreground animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div>
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" /> Select Hardware Model
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Browse and filter our catalog of CPUs and GPUs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModelModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-border/20 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Custom Input Block at the top */}
            <div className="py-4 border-b border-border/20 space-y-2">
              <label className="text-xs font-semibold text-primary block">
                Can't find your hardware model here? Input custom
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. NVIDIA RTX 5090, Custom Server Cluster..."
                  value={tempCustomModel}
                  onChange={(e) => setTempCustomModel(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => {
                    if (tempCustomModel.trim()) {
                      setGpuType("Custom");
                      setCustomGpu(tempCustomModel.trim());
                      setIsModelModalOpen(false);
                    }
                  }}
                  disabled={!tempCustomModel.trim()}
                >
                  Apply Custom
                </Button>
              </div>
            </div>

            {/* Filter Section */}
            <div className="py-4 border-b border-border/20 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Search catalog (e.g. H100, EPYC)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/40 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Brand Selector with Logos */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Brand</span>
                <div className="flex flex-wrap gap-1.5">
                  {["All", "NVIDIA", "AMD", "Intel", "Apple", "Dell", "HP", "Other"].map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setBrandFilter(brand)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-medium transition-all ${
                        brandFilter === brand
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 bg-background/30 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {brand !== "All" && getBrandLogo(brand, "h-3 w-3 shrink-0")}
                      <span>{brand}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type and Release Year */}
              <div className="grid gap-3 grid-cols-2 text-xs">
                {/* Type */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Type</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="All">All Types</option>
                    <option value="gpu">GPU</option>
                    <option value="cpu">CPU</option>
                  </select>
                </div>

                {/* Release Year */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Release Year</span>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="All">All Years</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                    <option value="Older">2020 & Older</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2 max-h-[300px]">
              {filteredHardware.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No hardware matching the selected filters found.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredHardware.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setGpuType(item.name);
                        setIsModelModalOpen(false);
                      }}
                      className={`flex flex-col text-left p-3 rounded-lg border text-xs transition-all ${
                        gpuType === item.name
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-card/30 hover:border-primary/40 hover:bg-card/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-semibold text-foreground truncate">{item.name}</span>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-background/60 text-[9px] uppercase tracking-wider border border-border/40 font-mono flex items-center gap-1">
                          {getBrandLogo(item.brand, "h-2.5 w-2.5 shrink-0")}
                          {item.brand}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-background/60 text-[9px] uppercase tracking-wider border border-border/40 font-mono">
                          {item.type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-background/60 text-[9px] uppercase tracking-wider border border-border/40 font-mono">
                          {item.releaseYear}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-[#0c0d10] p-8 shadow-2xl flex flex-col items-center text-center text-foreground animate-in zoom-in-95 duration-200">
            {/* Green glowing circle with check icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>

            <h3 className="text-xl font-bold text-foreground tracking-tight">
              Registration Successful!
            </h3>
            
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground max-w-sm">
              Your GPU node capacity is now successfully registered and active. The required collateral lock has been established and verified on-chain.
            </p>

            <div className="mt-6 w-full rounded-xl border border-border/40 bg-card/30 p-4 space-y-2.5 text-left text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered Hardware:</span>
                <span className="font-semibold text-foreground">{finalGpu}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lease Rate:</span>
                <span className="font-semibold text-foreground">{fmtUsdHr(rateNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral Locked:</span>
                <span className="font-semibold text-foreground">{calculatedCollateral.toFixed(4)} USDC</span>
              </div>
            </div>

            <div className="mt-8 flex gap-3 w-full">
              <Button
                type="button"
                onClick={() => setSuccess(false)}
                className="flex-1 py-2.5 font-semibold"
              >
                Okay
              </Button>
            </div>
          </div>
        </div>
      )}
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

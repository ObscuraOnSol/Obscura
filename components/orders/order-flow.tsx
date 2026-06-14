"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Lock,
  Eye,
  X,
  Loader2,
  Wallet,
  AlertTriangle,
  GitCompare,
  CheckCircle2,
  Maximize2,
  Info,
  Copy,
  Check,
  ChevronDown,
  LogOut,
  Terminal,
  ArrowLeft,
  Coins,
  Cpu,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useConnection } from "@solana/wallet-adapter-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhaseBadge } from "@/components/ui/badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { ordersApi, marketApi, type SessionOrder, type ProviderRow } from "@/lib/api";
import { computeCommitHash, randomSecretHex, usdToMicro } from "@/lib/commit";
import { cn, fmtUsdHr, shortHash } from "@/lib/utils";
import { performUsdcTransfer, performUsdcSplitTransfer, signAndSendSerializedTransaction } from "@/lib/solana";

const OBSCURA_SERVICE_WALLET = "FHMr5nLShb3AxFmdqS2dEwdseKFvaic6vyFcCm3Hm6Jn";

const GPU_TYPES = ["H100 80GB", "A100 80GB", "RTX 4090", "L40S"];
const PHASES = ["committed", "revealed", "matched", "settled"] as const;

const PHASE_DETAILS = {
  committed: {
    label: "Committed",
    tooltip: "Committed: Order hashed client-side - nothing visible on-chain.",
    icon: Lock,
  },
  revealed: {
    label: "Revealed",
    tooltip: "Revealed: Price and quantity enter the next batch auction.",
    icon: Eye,
  },
  matched: {
    label: "Matched",
    tooltip: "Matched: ZK-verified batch auction clears in ~45 seconds.",
    icon: GitCompare,
  },
  settled: {
    label: "Settled",
    tooltip: "Settled: USDC released from escrow to counterparties.",
    icon: CheckCircle2,
  },
} as const;

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

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
  const { wallet, connect, sendTransaction, publicKey } = useWallet();
  const { connection } = useConnection();
  const { signedIn, signIn } = useSession();
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [gpuTypes, setGpuTypes] = useState<string[]>([]);
  const [gpuType, setGpuType] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("1.8000");
  const [activeProviders, setActiveProviders] = useState<ProviderRow[]>([]);
  const [loadingGpus, setLoadingGpus] = useState(true);

  const computedPrice = useMemo(() => {
    const matches = activeProviders.filter((p) => p.gpuType === gpuType);
    if (matches.length > 0) {
      // Get the rate of the cheapest active provider for this GPU type
      const minRate = Math.min(...matches.map((p) => p.rateMicro / 1_000_000));
      return minRate.toFixed(4);
    }
    // Fallback defaults ONLY when marketplace has no active providers for this GPU
    switch (gpuType) {
      case "H100 80GB": return "2.5000";
      case "A100 80GB": return "1.8000";
      case "RTX 4090": return "0.8000";
      case "L40S": return "1.2000";
      default: return "1.5000";
    }
  }, [gpuType, activeProviders]);

  useEffect(() => {
    setPrice(computedPrice);
  }, [computedPrice]);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<SessionOrder | null>(null);
  const [connectOrder, setConnectOrder] = useState<SessionOrder | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<{
    host: string;
    port: string;
    username: string;
    password?: string;
    webCliUrl: string;
  } | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);

  const handleOpenConnect = async (o: SessionOrder) => {
    setConnectOrder(o);
    setLoadingConnection(true);
    setConnectionDetails(null);
    try {
      const details = await ordersApi.connection(o.id);
      setConnectionDetails(details);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connection details");
    } finally {
      setLoadingConnection(false);
    }
  };

  useEffect(() => setSecret(randomSecretHex()), []);

  useEffect(() => {
    setLoadingGpus(true);
    marketApi.providers()
      .then(({ providers }) => {
        const active = providers.filter((p) => p.status === "active");
        setActiveProviders(active);
        const activeGpus = Array.from(
          new Set(active.map((p) => p.gpuType))
        );
        setGpuTypes(activeGpus);
        if (activeGpus.length > 0) {
          setGpuType((prev) => (activeGpus.includes(prev) ? prev : activeGpus[0]));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch GPU types from marketplace:", err);
      })
      .finally(() => {
        setLoadingGpus(false);
      });
  }, []);

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
    if (!wallet) {
      connect();
      return;
    }
    if (!validInputs || !previewHash) {
      setError("enter a positive price and a whole-number quantity");
      return;
    }
    if (!signedIn) {
      const ok = await signIn();
      if (!ok) {
        setError("Sign-in was rejected: please approve the wallet signature request to commit your order.");
        return;
      }
    }
    setBusy(true);
    try {
      const priceMicro = Number(usdToMicro(priceNum));
      const { id } = await ordersApi.commit(wallet, gpuType, previewHash);
      saveReveal(id, { secret, priceMicro, qty: qtyNum });
      setSecret(randomSecretHex()); // rotate for the next order
      await refresh(wallet);
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
      setError("Reveal data for this order is not on this device: it was committed elsewhere.");
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

  async function handlePayAndSettle(order: SessionOrder) {
    if (!wallet || !publicKey || !sendTransaction) return;
    if (!order.assignedProviderWallet || !order.clearingPrice || !order.hours) {
      setError("Order matching details are missing.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // 1. Request serialized transaction from backend
      const { serializedTx } = await ordersApi.buildSettleTx(order.id, publicKey.toBase58());

      // 2. Sign and send transaction
      const txSig = await signAndSendSerializedTransaction(
        connection,
        serializedTx,
        sendTransaction
      );

      // 3. Confirm settlement on backend
      await ordersApi.settle(order.id, wallet, txSig);
      await refresh(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment or settlement failed");
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

          <div className="mt-6">
            {loadingGpus ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
                <span className="text-xs text-muted-foreground">Checking marketplace depth...</span>
              </div>
            ) : gpuTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/25 p-8 text-center text-xs text-muted-foreground space-y-4">
                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 animate-bounce" />
                <div className="font-semibold text-foreground text-sm">No active GPUs available</div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed max-w-[280px]">
                  There are currently no active GPU nodes listed in the marketplace. Please check back later or list your own GPU capacity as a seller to get started.
                </p>
                <Link
                  href="/marketplace?tab=provide"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:bg-card hover:border-primary/40 active:scale-95 shadow-md shadow-black/20"
                >
                  List Your GPU Node
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gpu" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5 text-primary" /> GPU type
                  </Label>
                  <select
                    id="gpu"
                    value={gpuType}
                    onChange={(e) => setGpuType(e.target.value)}
                    className="data flex h-10 w-full rounded-md border border-border bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {gpuTypes.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Coins className="h-3.5 w-3.5 text-primary" /> Price ($/hr)
                    </Label>
                    <div className="relative">
                      <Input
                        id="price"
                        className="data pr-10 bg-background/20 text-muted-foreground cursor-not-allowed opacity-80"
                        disabled
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                      <img src="/usdc_logo.png" alt="USDC" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 object-contain rounded-full opacity-60" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qty" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Duration (Hours)
                    </Label>
                    <Input
                      id="qty"
                      className="data"
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </div>
                </div>

                {/* Lease Estimate & Protocol Fee Preview */}
                {validInputs && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>Order Cost Estimate</span>
                      <span className="text-primary font-semibold">USDC</span>
                    </div>
                    
                    <div className="space-y-1.5 pt-1 border-t border-primary/10">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Lease cost:</span>
                        <span className="text-foreground font-mono">
                          {(priceNum * qtyNum).toFixed(4)} USDC
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Protocol fee (0.5%):
                          <span className="text-[10px] text-muted-foreground/60 font-normal">(charged at settlement)</span>
                        </span>
                        <span className="text-foreground font-mono">
                          {(priceNum * qtyNum * 0.005).toFixed(4)} USDC
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-bold pt-1.5 border-t border-primary/10 text-primary">
                        <span>Total amount to pay:</span>
                        <span className="flex items-center gap-1 font-mono">
                          <img src="/usdc_logo.png" alt="USDC" className="h-3.5 w-3.5 object-contain rounded-full" />
                          {(priceNum * qtyNum * 1.005).toFixed(4)} USDC
                        </span>
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground/75 leading-normal bg-background/30 rounded p-2 border border-border/40">
                      ℹ️ Note: 0.5% is charged as a protocol fee on the total amount you pay to settle the lease.
                    </div>
                  </div>
                )}

                {/* Commit hash preview (the only thing that hits the chain) */}
                <div className="rounded-md border border-dashed border-border bg-background/40 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    <Lock className="h-3 w-3" /> Commit hash (keccak256)
                  </div>
                  <div className="data mt-1.5 break-all text-xs text-primary">
                    {previewHash ? `0x${previewHash}` : "-"}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                    Computed client-side from price, rent duration, and a random secret. Only this
                    hash is submitted, meaning your size and price stay private until reveal.
                  </p>
                </div>

                <Button onClick={handleCommit} disabled={busy} className="w-full" size="lg">
                  {busy ? <Loader2 className="animate-spin" /> : <Lock />}
                  {!wallet ? "Connect wallet" : "Commit order"}
                </Button>

                {error ? (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}
              </div>
            )}
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
                  onOpenDetails={() => setModalOrder(o)}
                  onConnect={() => handleOpenConnect(o)}
                  onPayAndSettle={() => handlePayAndSettle(o)}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>

      {/* Modal for Order Details */}
      <AnimatePresence>
        {modalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-md relative"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" /> Order Specifications
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Detailed cryptographic specs and routing state.
                  </p>
                </div>
                <button
                  onClick={() => setModalOrder(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-6 space-y-4">
                {/* Status and GPU Type */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/40 bg-background/40 p-3.5">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hardware Model</span>
                    <div className="mt-1 font-semibold text-foreground">{modalOrder.gpuType}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifecycle State</span>
                    <div className="mt-1">
                      <PhaseBadge status={modalOrder.status} />
                    </div>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-3.5 text-sm">
                  <div className="flex flex-col gap-1 border-b border-border/40 pb-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Order ID (UUID)</span>
                    <div className="flex items-center justify-between gap-2 font-mono text-xs text-foreground">
                      <span className="truncate">{modalOrder.id}</span>
                      <CopyText text={modalOrder.id} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 border-b border-border/40 pb-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Commit Hash (Keccak256)</span>
                    <div className="flex items-center justify-between gap-2 font-mono text-xs text-foreground">
                      <span className="truncate">0x{modalOrder.commitHash}</span>
                      <CopyText text={`0x${modalOrder.commitHash}`} />
                    </div>
                  </div>

                  {(() => {
                    const data = loadReveal(modalOrder.id);
                    if (data) {
                      return (
                        <>
                          <div className="flex flex-col gap-1 border-b border-border/40 pb-3">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Secret Key (Preimage)</span>
                            <div className="flex items-center justify-between gap-2 font-mono text-xs text-foreground">
                              <span className="truncate">{data.secret}</span>
                              <CopyText text={data.secret} />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bid Price</span>
                              <div className="font-mono text-sm text-primary font-medium">
                                {fmtUsdHr(data.priceMicro / 1e6)}/hr
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</span>
                              <div className="font-mono text-sm text-foreground font-medium">
                                {data.qty} {data.qty === 1 ? "hour" : "hours"}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    }

                    const isCommitted = modalOrder.status === "committed";
                    return (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center">
                        <Lock className="mx-auto h-5 w-5 text-muted-foreground/60" />
                        <p className="mt-2 text-xs font-medium text-foreground">
                          {isCommitted ? "Bid Parameters Encrypted" : "Bid Parameters Offline"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                          {isCommitted 
                            ? "Only the commit hash is registered on-chain. The price, rent duration, and secret are kept local until you perform the Reveal phase."
                            : "The parameters and secret key for this order were not found in this device's local storage."
                          }
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Timestamp</span>
                    <div className="text-xs text-foreground">
                      {new Date(modalOrder.ts).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                {modalOrder.status === "committed" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleReveal(modalOrder);
                      setModalOrder(null);
                    }}
                    disabled={busy}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Reveal Now
                  </Button>
                )}
                {(modalOrder.status === "committed" || modalOrder.status === "revealed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleCancel(modalOrder);
                      setModalOrder(null);
                    }}
                    disabled={busy}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel Order
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setModalOrder(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Order Connection / SSH */}
      <AnimatePresence>
        {connectOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-md relative scrollbar-thin"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" /> Compute Node Connection
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SSH endpoint for the allocated {connectOrder.gpuType} instance.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConnectOrder(null);
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-6 space-y-4">
                {loadingConnection ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    <p className="text-xs text-muted-foreground font-sans">Provisioning secure tunnel connection...</p>
                  </div>
                ) : connectionDetails ? (
                  <>
                    {/* Connection Details box */}
                    <div className="space-y-3.5 text-sm">
                      {/* Host Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Host Address</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">{connectionDetails.host}</span>
                          <CopyText text={connectionDetails.host} />
                        </div>
                      </div>

                      {/* Port Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Port</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">{connectionDetails.port}</span>
                          <CopyText text={connectionDetails.port} />
                        </div>
                      </div>

                      {/* User Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Username</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">{connectionDetails.username}</span>
                          <CopyText text={connectionDetails.username} />
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Credentials / Password</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">{connectionDetails.password || "no password"}</span>
                          <CopyText text={connectionDetails.password || ""} />
                        </div>
                      </div>

                      {/* Command Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SSH Command</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-primary">
                          <span className="truncate">ssh {connectionDetails.username}@{connectionDetails.host} -p {connectionDetails.port}</span>
                          <CopyText text={`ssh ${connectionDetails.username}@${connectionDetails.host} -p ${connectionDetails.port}`} />
                        </div>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Info className="h-4 w-4 text-primary shrink-0" />
                        Instructions
                      </div>
                      <p className="text-xs text-muted-foreground leading-normal font-sans">
                        Open your terminal and run the copied SSH command. Use the provided password when prompted. Once connected, your environment is ready with pre-configured NVIDIA drivers and dependencies.
                      </p>
                      <p className="text-xs text-primary font-medium leading-normal font-sans">
                        ⚠️ Safety Recommendation: Since this connection is provisional, you should change the password immediately upon entering the server using the <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-[10px]">passwd</code> command.
                      </p>
                    </div>


                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-destructive space-y-2">
                    <AlertTriangle className="h-8 w-8" />
                    <p className="text-xs font-sans">Failed to load connection credentials.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConnectOrder(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderRow({
  order,
  busy,
  onReveal,
  onCancel,
  onOpenDetails,
  onConnect,
  onPayAndSettle,
}: {
  order: SessionOrder;
  busy: boolean;
  onReveal: () => void;
  onCancel: () => void;
  onOpenDetails: () => void;
  onConnect: () => void;
  onPayAndSettle: () => void;
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
        <div className="mt-4 flex items-center gap-1.5">
          {PHASES.map((p, i) => {
            const detail = PHASE_DETAILS[p];
            const Icon = detail.icon;
            const isCompletedOrActive = i <= activeIdx;
            return (
              <div key={p} className="group relative flex flex-1 items-center gap-1.5">
                <div
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    isCompletedOrActive ? "bg-primary" : "bg-border",
                  )}
                />
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                    isCompletedOrActive 
                      ? "border-primary/50 bg-primary/10 text-primary" 
                      : "border-border/60 bg-card/20 text-muted-foreground/30",
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 scale-95 opacity-0 pointer-events-none group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-30">
                  <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium text-popover-foreground shadow-xl shadow-black/40 whitespace-nowrap">
                    {detail.tooltip}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {order.status === "matched" && order.assignedProviderWallet && order.clearingPrice && order.hours && (
        <div className="mt-4 p-3 rounded-lg border border-dashed border-primary/20 bg-primary/5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provider:</span>
            <span className="font-mono text-foreground">{shortHash(order.assignedProviderWallet, 5, 4)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rent Details:</span>
            <span className="text-foreground">{order.hours} {order.hours === 1 ? "hour" : "hours"} @ {fmtUsdHr(order.clearingPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Protocol Fee (0.5%):</span>
            <span className="text-foreground font-mono">{(order.clearingPrice * order.hours * 0.005).toFixed(4)} USDC</span>
          </div>
          <div className="flex items-center justify-between font-semibold pt-1.5 border-t border-primary/10">
            <span className="text-primary">Total Payment:</span>
            <span className="text-primary flex items-center gap-1">
              <img src="/usdc_logo.png" alt="USDC" className="h-3.5 w-3.5 object-contain rounded-full" />
              {(order.clearingPrice * order.hours * 1.005).toFixed(4)} USDC
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {order.status === "committed" && (
          <Button size="sm" onClick={onReveal} disabled={busy}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Reveal
          </Button>
        )}
        {(order.status === "committed" || order.status === "revealed") && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        )}
        {order.status === "revealed" && (
          <span className="data text-xs text-muted-foreground">
            in the next batch auction…
          </span>
        )}

        {order.status === "matched" && (
          <Button size="sm" variant="white" onClick={onPayAndSettle} disabled={busy}>
            <Coins className="h-3.5 w-3.5 mr-1.5 text-primary" /> Pay & Settle
          </Button>
        )}
        
        {order.status === "settled" && (
          <Button size="sm" variant="white" onClick={onConnect}>
            <Terminal className="h-3.5 w-3.5 mr-1.5" /> Connect
          </Button>
        )}

        <Button size="sm" variant="ghost" className="ml-auto" onClick={onOpenDetails}>
          <Maximize2 className="h-3.5 w-3.5 mr-1.5" /> Details
        </Button>
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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { signOut } = useSession();

  if (!wallet) {
    return (
      <Button size="sm" variant="outline" onClick={onConnect}>
        <Wallet className="h-3.5 w-3.5" /> Connect
      </Button>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    signOut();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="data inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-border/20 hover:text-foreground transition-colors outline-none"
      >
        {shortHash(wallet, 4, 4)}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-md flex flex-col gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-primary" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span>Disconnect</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

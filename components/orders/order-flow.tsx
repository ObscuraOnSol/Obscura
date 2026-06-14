"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhaseBadge } from "@/components/ui/badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { ordersApi, type SessionOrder } from "@/lib/api";
import { computeCommitHash, randomSecretHex, usdToMicro } from "@/lib/commit";
import { cn, fmtUsdHr, shortHash } from "@/lib/utils";

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
  const { wallet, connect } = useWallet();
  const { signedIn, signIn } = useSession();
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [gpuType, setGpuType] = useState(GPU_TYPES[0]);
  const [price, setPrice] = useState("1.8000");
  const [qty, setQty] = useState("1");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOrder, setModalOrder] = useState<SessionOrder | null>(null);
  const [connectOrder, setConnectOrder] = useState<SessionOrder | null>(null);
  const [showWebCli, setShowWebCli] = useState(false);

  const handleOpenConnect = (o: SessionOrder) => {
    setConnectOrder(o);
  };

  useEffect(() => setSecret(randomSecretHex()), []);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* New order */}
      <FadeIn direction="up">
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New order</h2>
            <WalletChip wallet={wallet} onConnect={connect} />
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gpu">GPU type</Label>
              <select
                id="gpu"
                value={gpuType}
                onChange={(e) => setGpuType(e.target.value)}
                className="data flex h-10 w-full rounded-md border border-border bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {GPU_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price ($/hr)</Label>
                <Input
                  id="price"
                  className="data"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  className="data"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
            </div>

            {/* Commit hash preview (the only thing that hits the chain) */}
            <div className="rounded-md border border-dashed border-border bg-background/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                <Lock className="h-3 w-3" /> Commit hash (keccak256)
              </div>
              <div className="data mt-1.5 break-all text-xs text-primary">
                {previewHash ? `0x${previewHash}` : "-"}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                Computed client-side from price, qty, and a random secret. Only this
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
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">GPU Model</span>
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
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity</span>
                              <div className="font-mono text-sm text-foreground font-medium">
                                {data.qty} {data.qty === 1 ? "node" : "nodes"}
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
                            ? "Only the commit hash is registered on-chain. The price, quantity, and secret are kept local until you perform the Reveal phase."
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
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-md relative"
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
                    setShowWebCli(false);
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-6 space-y-4">
                {!showWebCli ? (
                  <>
                    {/* Connection Details box */}
                    <div className="space-y-3.5 text-sm">
                      {/* Host Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Host Address</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">localhost</span>
                          <CopyText text="localhost" />
                        </div>
                      </div>

                      {/* Port Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Port</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">2222</span>
                          <CopyText text="2222" />
                        </div>
                      </div>

                      {/* User Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Username</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">root</span>
                          <CopyText text="root" />
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Credentials / Password</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-foreground">
                          <span className="truncate">obscura</span>
                          <CopyText text="obscura" />
                        </div>
                      </div>

                      {/* Command Field */}
                      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">SSH Command</span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-xs text-primary">
                          <span className="truncate">ssh root@localhost -p 2222</span>
                          <CopyText text="ssh root@localhost -p 2222" />
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

                    {/* Use Web CLI option button */}
                    <Button 
                      className="w-full mt-4 flex items-center justify-center gap-2"
                      variant="outline"
                      onClick={() => setShowWebCli(true)}
                    >
                      <Terminal className="h-4 w-4 text-primary" />
                      Use Web CLI
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Live Terminal Window Wrapper */}
                    <div className="overflow-hidden rounded-xl border border-border/80 bg-zinc-950 shadow-2xl">
                      {/* Terminal Window Chrome */}
                      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-border/40 select-none">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/80">root@obscura-gpu-node:~</span>
                        <div className="w-10" />
                      </div>
                      {/* Embedded Iframe */}
                      <iframe
                        src="http://localhost:7681"
                        className="w-full h-[320px] bg-black border-none"
                        title="Live Console"
                      />
                    </div>

                    <Button 
                      className="w-full mt-4 flex items-center justify-center gap-2"
                      variant="outline"
                      onClick={() => setShowWebCli(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Show SSH Details
                    </Button>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConnectOrder(null);
                    setShowWebCli(false);
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
}: {
  order: SessionOrder;
  busy: boolean;
  onReveal: () => void;
  onCancel: () => void;
  onOpenDetails: () => void;
  onConnect: () => void;
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
        
        {/* Connect button for settled/matched orders */}
        {(order.status === "settled" || order.status === "matched") && (
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

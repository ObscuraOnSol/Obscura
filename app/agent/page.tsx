"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Bot, 
  Settings, 
  Key, 
  Copy, 
  Check, 
  Activity, 
  Wallet, 
  ShieldCheck, 
  Sliders, 
  Coins, 
  RefreshCw,
  BookOpen
} from "lucide-react";
import { AppFrame, StatCard } from "@/components/app-frame";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { useWallet } from "@/lib/wallet";
import { ordersApi, keysApi, agentApi, API_BASE, type ApiKey, type SessionOrder, type AgentStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { shortHash, fmtAgo } from "@/lib/utils";
import Link from "next/link";

const AGENT_STARTER_PROMPT = `You are an autonomous AI Agent equipped with a Solana wallet and web capabilities. Your goal is to lease high-performance GPU/CPU compute capacity on the Obscura network programmatically.

Obscura uses a secure Commit-Reveal auction mechanism and an on-chain Escrow contract (X402 Gate) for settlement. Follow these system instructions exactly:

### 1. API Endpoint & Credentials
- Base URL: https://api.obscuraonsol.com
- Header: Include 'X-API-Key: <YOUR_API_KEY>' on all requests.
- OpenAPI JSON Spec for reference: https://api.obscuraonsol.com/v1/agents/docs.json

### 2. Step-by-Step Order Lifecycle

#### Phase A: Commit Order
1. Generate a random 32-byte hex string as your 'secret' (keep it private).
2. Calculate the keccak-256 hash of your bid parameters:
   commitHash = keccak256( priceMicro (8-byte Little Endian u64) || qty (8-byte Little Endian u64) || secret (32-byte bytes) )
3. Submit the commit hash:
   - Method: POST
   - Route: /api/orders
   - Body: { "gpuType": "NVIDIA H100 80GB", "commitHash": "0x<your_commit_hash>" }
4. Store the returned 'id' (this is your order ID).

#### Phase B: Reveal Bid
1. Immediately or when the commit window closes, reveal your parameters:
   - Method: POST
   - Route: /api/orders/{id}/reveal
   - Body: { "priceMicro": 1800000, "qty": 4, "secret": "0x<your_32_byte_secret>" }
   *(where priceMicro is the USDC rate/hr * 1e6, and qty is lease duration in hours)*

#### Phase C: Pay and Settle (X402 Gate)
1. Periodically check order status:
   - Method: GET
   - Route: /api/orders/{id}
2. If the response is HTTP 402 Payment Required:
   - Read the payload to get payment details (e.g. amountUsdc, escrowWallet, paymentUrl).
   - Fetch the base64-serialized Solana transaction to fund the escrow:
     - Method: POST
     - Route: /api/orders/{id}/build-settle-tx
   - Sign the returned transaction using your private key and broadcast it to the Solana network to obtain the transaction signature (txSig).
   - Activate the lease by submitting the signature:
     - Method: POST
     - Route: /api/orders/{id}/settle
     - Body: { "txSig": "<your_transaction_signature>" }

#### Phase D: Retrieve SSH Connection Credentials
1. Call GET /api/orders/{id} again.
2. Once verified, it will return HTTP 200 with SSH connection details:
   {
     "id": "order-id",
     "status": "settled",
     "connection": {
       "host": "api.obscuraonsol.com",
       "port": "22000",
       "username": "root",
       "password": "..."
     }
   }
3. Connect via SSH using the provided credentials to execute your GPU workloads.`;

export default function AgentPage() {
  const { wallet, connect } = useWallet();
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const loadData = useCallback(async (w: string) => {
    setLoading(true);
    try {
      const [{ orders: fetchedOrders }, { keys: fetchedKeys }, fetchedStats] = await Promise.all([
        ordersApi.list(w),
        keysApi.list(w),
        agentApi.stats(w),
      ]);
      setOrders(fetchedOrders);
      setKeys(fetchedKeys.filter(k => !k.revokedAt));
      setStats(fetchedStats);
    } catch (e) {
      console.error("Failed to load agent dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (wallet) {
      void loadData(wallet);
      const interval = setInterval(() => {
        void loadData(wallet);
      }, 5000); // refresh every 5s
      return () => clearInterval(interval);
    }
  }, [wallet, loadData]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const statCards = [
    { label: "Passport", value: "SAS · active", sub: "owner-revocable", icon: ShieldCheck },
    { label: "Reputation", value: stats ? `${stats.reputation} / 100` : "87 / 100", sub: "signal-weighted", icon: Activity },
    { label: "Tier", value: "Gold", sub: "3,000 req/min", icon: Sliders },
  ];

  if (!wallet) {
    return (
      <AppFrame active="/agent" title="Agent mode">
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground mb-4">
            <Bot className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Programmatic Agent Console</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Connect your developer/owner wallet to view programmatic stats, spend limits, rolling usage, active API credentials, and agent order history.
          </p>
          <Button onClick={connect} className="mt-5">
            <Wallet className="h-4 w-4 mr-2" /> Connect Wallet
          </Button>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame active="/agent" title="Agent mode">
      <div className="space-y-6">
        {/* Top Stats */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-3" staggerDelay={0.07}>
          {statCards.map((s) => (
            <StaggerItem key={s.label}>
              <StatCard label={s.label} value={s.value} sub={s.sub} icon={s.icon} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Console Navigation */}
        <div className="flex border-b border-border/40 pb-px">
          <button
            className="px-4 py-2 text-sm font-medium transition-colors border-b-2 border-primary text-foreground relative flex items-center gap-2"
          >
            <Bot className="h-4 w-4" /> Agent Dashboard
          </button>
          <a
            href={`${API_BASE}/v1/agent/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium transition-colors border-b-2 border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="h-4 w-4" /> API Reference
          </a>
        </div>

        {/* Tab Content */}
        <FadeIn className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
          {/* Left Side: Spend limits, request usages and programmatic orders */}
          <div className="space-y-6">
            {/* Rolling usage and spend limits */}
            <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Programmatic Resource Allocations</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Spending limits and rate thresholds configured for the current gold SAS passport.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Daily Spend cap */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-primary" /> Daily Spend Cap</span>
                    <span className="font-semibold text-foreground">
                      ${stats ? stats.dailySpend.toFixed(2) : "0.00"} / ${stats ? stats.dailySpendCap.toFixed(2) : "500.00"}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${stats ? Math.min(100, (stats.dailySpend / stats.dailySpendCap) * 100) : 0}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Resets in 24h (rolling 24-hour window)
                  </div>
                </div>

                {/* API Rate cap */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-primary animate-spin-slow" /> API Rate Limit</span>
                    <span className="font-semibold text-foreground">
                      {stats ? stats.apiRequests.toLocaleString() : "0"} / {stats ? stats.apiRequestsLimit.toLocaleString() : "4,320,000"} req
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats ? Math.min(100, (stats.apiRequests / stats.apiRequestsLimit) * 100) : 0}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Current load: ~5 req/min (Burst limit: 3,000 req/min)
                  </div>
                </div>
              </div>
            </div>

            {/* Programmatic Orders list */}
            <div className="rounded-2xl border border-border bg-card/40 p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Programmatic Orders</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recent transactions and matching states generated via the Agent API.
                  </p>
                </div>
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>

              {orders.length === 0 ? (
                <div className="flex min-h-[20vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/10 text-center text-xs text-muted-foreground p-6">
                  No programmatic orders found for this wallet. Generate a key in Settings and call the endpoints to start.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2.5 font-medium">Order ID</th>
                        <th className="py-2.5 font-medium">GPU Type</th>
                        <th className="py-2.5 font-medium">Status</th>
                        <th className="py-2.5 font-medium">Cost / Duration</th>
                        <th className="py-2.5 font-medium text-right">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-b border-border/20 hover:bg-card/25 transition-colors">
                          <td className="py-3 font-mono text-[11px] text-primary">
                            <span className="cursor-pointer" onClick={() => handleCopy(o.id, `order-${o.id}`)}>
                              {copiedText === `order-${o.id}` ? "Copied!" : shortHash(o.id, 6, 4)}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-foreground">{o.gpuType}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-wider ${
                              o.status === "settled" 
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                                : o.status === "matched"
                                  ? "border-primary/20 bg-primary/5 text-primary"
                                  : o.status === "cancelled"
                                    ? "border-destructive/20 bg-destructive/5 text-destructive"
                                    : "border-border/60 bg-background/40 text-muted-foreground"
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 text-foreground font-mono">
                            {o.clearingPrice && o.hours 
                              ? `${(o.clearingPrice * o.hours).toFixed(2)} USDC (${o.hours}h)` 
                              : "-"}
                          </td>
                          <td className="py-3 text-muted-foreground text-right">{fmtAgo(o.ts)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Credentials & Prompt Cards */}
          <div className="space-y-4">
            {/* Active Credentials Card */}
            <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-primary" /> Active Credentials
                </h3>
                <Link href="/settings" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  <Settings className="h-3 w-3" /> Manage
                </Link>
              </div>

              {keys.length === 0 ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    No active API keys found. You must generate an API key to allow agents to interact programmatically.
                  </p>
                  <Link href="/settings" className="inline-block w-full">
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      Generate API Key
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {keys.map((k) => (
                    <div key={k.id} className="rounded-xl border border-border/60 bg-background/50 p-3 flex items-center justify-between">
                      <div>
                        <div className="data text-xs font-mono text-foreground">{k.masked}</div>
                        <div className="text-[9px] text-muted-foreground font-mono mt-1">
                          Tier: <span className="text-primary font-bold uppercase">{k.tier}</span> · Created {fmtAgo(k.createdAt)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(k.id, `key-${k.id}`)}
                        className="h-8 w-8 p-0"
                      >
                        {copiedText === `key-${k.id}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-[10px] text-emerald-400 leading-normal flex items-start gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Passport integration is fully authenticated and safe. Hardware operators can be revoked at any time.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Starter Prompt Card */}
            <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-primary" /> Starter Prompt
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Equip your LLM agent with the complete instruction set, API lifecycle details, and schemas required to lease GPU capacity autonomously.
              </p>
              <Button onClick={() => setShowPromptModal(true)} className="w-full text-xs" variant="outline">
                View Agent Prompt
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Starter Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-[#0d0e12] p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-border/30 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary animate-pulse" /> Agent Starter Prompt
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Copy this comprehensive system prompt to instruct your agent.
                </p>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/60 hover:bg-card/30 rounded-lg px-2.5 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-black/40 border border-border/30 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap select-text selection:bg-primary/20">
              {AGENT_STARTER_PROMPT}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end items-center gap-3 border-t border-border/30 pt-4 mt-4">
              <Button
                onClick={() => handleCopy(AGENT_STARTER_PROMPT, "prompt-copy")}
                className="text-xs flex items-center gap-2"
              >
                {copiedText === "prompt-copy" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied Prompt!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppFrame>
  );
}

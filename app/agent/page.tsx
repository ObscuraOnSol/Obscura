"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Bot, 
  Settings, 
  Key, 
  Copy, 
  Check, 
  Terminal, 
  Activity, 
  Wallet, 
  Clock, 
  Cpu, 
  Coins, 
  Sliders, 
  ShieldCheck, 
  Globe, 
  Lock, 
  Eye, 
  RefreshCw,
  Search,
  BookOpen
} from "lucide-react";
import { AppFrame, StatCard } from "@/components/app-frame";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import { useWallet } from "@/lib/wallet";
import { ordersApi, keysApi, type ApiKey, type SessionOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { shortHash, fmtAgo, fmtUsdHr } from "@/lib/utils";
import Link from "next/link";

const STATS = [
  { label: "Passport", value: "SAS · active", sub: "owner-revocable", icon: ShieldCheck },
  { label: "Reputation", value: "87 / 100", sub: "signal-weighted", icon: Activity },
  { label: "Tier", value: "Gold", sub: "3,000 req/min", icon: Sliders },
];

export default function AgentPage() {
  const { wallet, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"dashboard" | "docs">("dashboard");
  const [activeDocRoute, setActiveDocRoute] = useState<"auth" | "commit" | "reveal" | "connection" | "cancel">("auth");
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const loadData = useCallback(async (w: string) => {
    setLoading(true);
    try {
      const [{ orders: fetchedOrders }, { keys: fetchedKeys }] = await Promise.all([
        ordersApi.list(w),
        keysApi.list(w),
      ]);
      setOrders(fetchedOrders);
      setKeys(fetchedKeys.filter(k => !k.revokedAt));
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

  const getDocSnippet = (route: "auth" | "commit" | "reveal" | "connection" | "cancel", lang: "curl" | "js" | "python") => {
    const keyHeader = keys.length > 0 ? keys[0].masked : "obsc_sk_gold_abc123xyz";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://api.obscuraonsol.com";
    
    const snippets = {
      auth: {
        curl: `curl -H "X-API-Key: ${keyHeader}" \\\n  ${baseUrl}/api/orders/metrics`,
        js: `fetch("${baseUrl}/api/orders/metrics", {\n  headers: {\n    "X-API-Key": "${keyHeader}"\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data));`,
        python: `import requests\n\nheaders = {"X-API-Key": "${keyHeader}"}\nresponse = requests.get("${baseUrl}/api/orders/metrics", headers=headers)\nprint(response.json())`
      },
      commit: {
        curl: `curl -X POST -H "X-API-Key: ${keyHeader}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"gpuType": "NVIDIA H100 80GB", "commitHash": "0x3ab5f8b9ec47347fd0b0a1a2f3"}' \\\n  ${baseUrl}/api/orders`,
        js: `fetch("${baseUrl}/api/orders", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "${keyHeader}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    gpuType: "NVIDIA H100 80GB",\n    commitHash: "0x3ab5f8b9ec47347fd0b0a1a2f3"\n  })\n})\n.then(res => res.json())\n.then(data => console.log(data));`,
        python: `import requests\n\nheaders = {\n    "X-API-Key": "${keyHeader}",\n    "Content-Type": "application/json"\n}\ndata = {\n    "gpuType": "NVIDIA H100 80GB",\n    "commitHash": "0x3ab5f8b9ec47347fd0b0a1a2f3"\n}\nresponse = requests.post("${baseUrl}/api/orders", headers=headers, json=data)\nprint(response.json())`
      },
      reveal: {
        curl: `curl -X POST -H "X-API-Key: ${keyHeader}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"priceMicro": 1800000, "qty": 4, "secret": "0x3c2415d8f761be"}' \\\n  ${baseUrl}/api/orders/your-order-id/reveal`,
        js: `fetch("${baseUrl}/api/orders/your-order-id/reveal", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "${keyHeader}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    priceMicro: 1800000, // $1.80 per hour\n    qty: 4,             // 4 hours duration\n    secret: "0x3c2415d8f761be"\n  })\n})\n.then(res => res.json())\n.then(data => console.log(data));`,
        python: `import requests\n\nheaders = {\n    "X-API-Key": "${keyHeader}",\n    "Content-Type": "application/json"\n}\ndata = {\n    "priceMicro": 1800000, \n    "qty": 4, \n    "secret": "0x3c2415d8f761be"\n}\nresponse = requests.post("${baseUrl}/api/orders/your-order-id/reveal", headers=headers, json=data)\nprint(response.json())`
      },
      connection: {
        curl: `curl -H "X-API-Key: ${keyHeader}" \\\n  ${baseUrl}/api/orders/your-order-id`,
        js: `fetch("${baseUrl}/api/orders/your-order-id", {\n  headers: {\n    "X-API-Key": "${keyHeader}"\n  }\n})\n.then(res => res.json())\n.then(data => {\n  if (data.status === "settled") {\n    console.log("SSH Host:", data.connection.host);\n    console.log("Port:", data.connection.port);\n  }\n});`,
        python: `import requests\n\nheaders = {"X-API-Key": "${keyHeader}"}\nresponse = requests.get("${baseUrl}/api/orders/your-order-id", headers=headers)\ndata = response.json()\nif data.get("status") == "settled":\n    print("SSH Connection Info:", data.get("connection"))`
      },
      cancel: {
        curl: `curl -X POST -H "X-API-Key: ${keyHeader}" \\\n  ${baseUrl}/api/orders/your-order-id/cancel`,
        js: `fetch("${baseUrl}/api/orders/your-order-id/cancel", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "${keyHeader}"\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data));`,
        python: `import requests\n\nheaders = {"X-API-Key": "${keyHeader}"}\nresponse = requests.post("${baseUrl}/api/orders/your-order-id/cancel", headers=headers)\nprint(response.json())`
      }
    };

    return snippets[route]?.[lang] || "";
  };

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
          {STATS.map((s) => (
            <StaggerItem key={s.label}>
              <StatCard label={s.label} value={s.value} sub={s.sub} icon={s.icon} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Console Navigation */}
        <div className="flex border-b border-border/40 pb-px">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative flex items-center gap-2 ${
              activeTab === "dashboard"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="h-4 w-4" /> Agent Dashboard
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 relative flex items-center gap-2 ${
              activeTab === "docs"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" /> API Reference
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" ? (
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
                      <span className="font-semibold text-foreground">$112.40 / $500.00</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "22.5%" }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Resets in 9h 17m (rolling 24-hour window)
                    </div>
                  </div>

                  {/* API Rate cap */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-primary animate-spin-slow" /> API Rate Limit</span>
                      <span className="font-semibold text-foreground">14,241 / 4,320,000 req</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "0.33%" }} />
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

            {/* Right Side: Active Credentials card */}
            <div className="space-y-4">
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
            </div>
          </FadeIn>
        ) : (
          /* API documentation / Swagger-style panel */
          <FadeIn className="rounded-2xl border border-border bg-card/40 overflow-hidden grid lg:grid-cols-[240px_1fr] items-stretch">
            {/* Sidebar documentation route selector */}
            <div className="border-r border-border/40 bg-card/10 p-4 space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 block mb-3">API Lifecycle</span>
              {[
                { id: "auth", label: "Authentication", method: "HEADER" },
                { id: "commit", label: "1. Commit Order", method: "POST" },
                { id: "reveal", label: "2. Reveal Order", method: "POST" },
                { id: "connection", label: "3. Connection Info", method: "GET" },
                { id: "cancel", label: "Cancel Order", method: "POST" }
              ].map((route) => (
                <button
                  key={route.id}
                  onClick={() => setActiveDocRoute(route.id as any)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-all flex items-center justify-between font-medium ${
                    activeDocRoute === route.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-card/30 hover:text-foreground"
                  }`}
                >
                  <span>{route.label}</span>
                  <span className={`text-[8px] font-mono px-1 rounded ${
                    route.method === "POST" 
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                      : route.method === "GET"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-muted/10 text-muted-foreground border border-border/60"
                  }`}>
                    {route.method}
                  </span>
                </button>
              ))}
            </div>

            {/* Docs Detail Console */}
            <div className="p-6 sm:p-8 space-y-6">
              {activeDocRoute === "auth" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Authentication Gate
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Obscura's Agent API requires all write/read request flows to carry a secure `X-API-Key` in the request header.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Header Format</h4>
                    <code className="block bg-black/40 border border-border/40 rounded-lg p-3 text-xs font-mono text-primary">
                      X-API-Key: obsc_sk_gold_yourkeyhere
                    </code>
                  </div>

                  <div className="text-xs leading-relaxed text-muted-foreground space-y-2 bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <p className="font-semibold text-primary">Testing Authentication</p>
                    <p>You can execute a simple healthcheck and fetch live GPU marketplace statistics to verify that your key is properly authenticated.</p>
                  </div>
                </div>
              )}

              {activeDocRoute === "commit" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Commit Order
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submits a cryptographic commit hash representing your bid. The actual price, quantity, and secret details remain private.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">HTTP Request</span>
                    <div className="flex items-center gap-2 text-xs font-mono bg-black/40 border border-border/40 rounded-lg px-3 py-2">
                      <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 rounded text-[9px] font-bold">POST</span>
                      <span className="text-foreground">/api/orders</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Payload Parameters</span>
                    <div className="border border-border/40 bg-card/20 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-foreground">gpuType <span className="text-destructive">*</span></span>
                        <span className="text-muted-foreground">string (e.g. "NVIDIA H100 80GB")</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-foreground">commitHash <span className="text-destructive">*</span></span>
                        <span className="text-muted-foreground">16-128 character hex string</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDocRoute === "reveal" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" /> Reveal Order Preimage
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reveals the bid specifications once the commit window closes. The engine verifies the parameters against your stored commit hash.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">HTTP Request</span>
                    <div className="flex items-center gap-2 text-xs font-mono bg-black/40 border border-border/40 rounded-lg px-3 py-2">
                      <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 rounded text-[9px] font-bold">POST</span>
                      <span className="text-foreground">/api/orders/:id/reveal</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Payload Parameters</span>
                    <div className="border border-border/40 bg-card/20 rounded-lg p-3 text-xs space-y-3">
                      <div className="flex justify-between">
                        <span className="font-mono text-foreground">priceMicro <span className="text-destructive">*</span></span>
                        <span className="text-muted-foreground">integer (USDC price per hour * 1,000,000)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-foreground">qty <span className="text-destructive">*</span></span>
                        <span className="text-muted-foreground">integer (Duration in hours)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-foreground">secret <span className="text-destructive">*</span></span>
                        <span className="text-muted-foreground">hex string (Client-side entropy)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDocRoute === "connection" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" /> Fetch Connection Details
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Retrieves matching provider specifications, lease settlement state, and direct SSH credentials when settled.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">HTTP Request</span>
                    <div className="flex items-center gap-2 text-xs font-mono bg-black/40 border border-border/40 rounded-lg px-3 py-2">
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 rounded text-[9px] font-bold">GET</span>
                      <span className="text-foreground">/api/orders/:id</span>
                    </div>
                  </div>
                </div>
              )}

              {activeDocRoute === "cancel" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Cancel Unsettled Order
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cancels an order that is currently in a `committed` or `revealed` status, immediately dropping it from the matching engine loop.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">HTTP Request</span>
                    <div className="flex items-center gap-2 text-xs font-mono bg-black/40 border border-border/40 rounded-lg px-3 py-2">
                      <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 rounded text-[9px] font-bold">POST</span>
                      <span className="text-foreground">/api/orders/:id/cancel</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Code Sandbox tabs */}
              <div className="border-t border-border/40 pt-6 space-y-4">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Code Sandbox Snippets</span>
                
                {["curl", "js", "python"].map((lang) => {
                  const snippet = getDocSnippet(activeDocRoute, lang as any);
                  const isCopied = copiedText === `snippet-${activeDocRoute}-${lang}`;

                  return (
                    <div key={lang} className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold uppercase px-1">
                        <span>{lang === "js" ? "JavaScript (Node.js)" : lang}</span>
                        <button
                          onClick={() => handleCopy(snippet, `snippet-${activeDocRoute}-${lang}`)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                        >
                          {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          <span>{isCopied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <pre className="bg-[#08090b] border border-border/60 rounded-xl p-4 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto whitespace-pre">
                        {snippet}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </AppFrame>
  );
}

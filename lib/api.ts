export const API_BASE = (() => {
  let url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return "http://localhost:3001";

  // Clean trailing slashes and whitespace
  url = url.trim().replace(/\/+$/, "");

  // Fix typos like https//domain.com to https://domain.com
  url = url.replace(/^(https?)\/\/([^/])/i, "$1://$2");

  // Fix double protocols like https://https// or https://https://
  url = url.replace(/^(https?:\/\/)+https?:\/\//i, "$1");
  url = url.replace(/^https?:\/\/https?\/\//i, "https://");
  url = url.replace(/^http:\/\/http\/\//i, "http://");
  url = url.replace(/^https?:\/\/https?:\/\//i, "https://");

  // Clean duplicate protocol characters
  url = url.replace(/^(https?:\/\/)+/, (match) => match.includes("https") ? "https://" : "http://");

  return url;
})();

export const WS_BASE = API_BASE.replace(/^http/i, "ws") + "/ws";



export interface SessionOrder {
  id: string;
  gpuType: string;
  commitHash: string;
  revealed: boolean;
  status: "committed" | "revealed" | "matched" | "settled" | "cancelled";
  ts: string;
  assignedProviderWallet?: string | null;
  clearingPrice?: number | null;
  hours?: number | null;
  leaseStartedAt?: string | null;
}

// SIWS session token, set by the SessionProvider after sign-in. When present,
// it authenticates write requests (the backend derives the wallet from it).
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errorMsg = (body.message as string) || (body.error as string) || `request failed (${res.status})`;
    throw new Error(errorMsg);
  }
  return body as T;
}

export interface MarketPrice {
  gpuType: string;
  clearingPrice: number;
  ts: string;
}
export interface ProviderRow {
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
export interface MarketStats {
  window: string;
  gpuTypes: number;
  totalFills: number;
  avgClearingPrice: number | null;
  batchStats?: {
    lastRun: number;
    nextRun: number;
    intervalSeconds: number;
  };
}
export interface Settlement {
  batchId: number;
  gpuType: string;
  clearingPrice: number;
  fillCount: number;
  ts: string;
}
export interface OrderMetric {
  gpuType: string;
  total: number;
  revealed: number;
  settled: number;
  fillRate: number;
}

export const marketApi = {
  prices: () => call<{ prices: MarketPrice[] }>("/api/market/prices"),
  stats: () => call<MarketStats>("/api/market/stats"),
  providers: () => call<{ providers: ProviderRow[] }>("/api/providers"),
  settlements: (limit = 8) =>
    call<{ settlements: Settlement[] }>(`/api/settlements?limit=${limit}`),
  orderMetrics: () =>
    call<{ window: string; breakdown: OrderMetric[] }>("/api/orders/metrics"),
};

export const ordersApi = {
  commit: (wallet: string, gpuType: string, commitHash: string) =>
    call<{ id: string; phase: string; ts: string }>("/api/session/orders", {
      method: "POST",
      body: JSON.stringify({ wallet, gpuType, commitHash }),
    }),

  reveal: (
    id: string,
    wallet: string,
    priceMicro: number,
    qty: number,
    secret: string,
  ) =>
    call<{ id: string; phase: string }>(`/api/session/orders/${id}/reveal`, {
      method: "POST",
      body: JSON.stringify({ wallet, priceMicro, qty, secret }),
    }),

  cancel: (id: string, wallet: string) =>
    call<{ id: string; status: string }>(`/api/session/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ wallet }),
    }),

  settle: (id: string, wallet: string, txSig: string) =>
    call<{ id: string; status: string }>(`/api/session/orders/${id}/settle`, {
      method: "POST",
      body: JSON.stringify({ wallet, txSig }),
    }),

  buildSettleTx: (id: string, wallet: string) =>
    call<{ serializedTx: string }>(`/api/session/orders/${id}/build-settle-tx`, {
      method: "POST",
      body: JSON.stringify({ wallet }),
    }),

  list: (wallet: string) =>
    call<{ orders: SessionOrder[] }>(
      `/api/session/orders?wallet=${encodeURIComponent(wallet)}`,
    ),

  connection: (id: string) =>
    call<{
      host: string;
      port: string;
      username: string;
      password?: string;
      webCliUrl: string;
    }>(`/api/session/orders/${id}/connection`),

  receipt: (id: string, wallet: string) =>
    call<OrderReceipt>(
      `/api/session/orders/${id}/receipt?wallet=${encodeURIComponent(wallet)}`
    ),
};

export interface OrderReceipt {
  orderId: string;
  batchId: number;
  gpuType: string;
  clearingPrice: number;
  hours: number;
  totalCost: number;
  timestamp: string;
  status: string;
}

export interface AgentStats {
  reputation: number;
  dailySpend: number;
  dailySpendCap: number;
  apiRequests: number;
  apiRequestsLimit: number;
}

export const agentApi = {
  stats: (wallet: string) =>
    call<AgentStats>(`/api/session/agent/stats?wallet=${encodeURIComponent(wallet)}`),
};

export interface ApiKey {

  id: string;
  masked: string;
  tier: string;
  createdAt: string;
  revokedAt: string | null;
}

export const keysApi = {
  create: (wallet: string) =>
    call<{ apiKey: string; id: string; tier: string; note: string }>(
      "/api/session/keys",
      { method: "POST", body: JSON.stringify({ wallet }) },
    ),
  list: (wallet: string) =>
    call<{ keys: ApiKey[] }>(
      `/api/session/keys?wallet=${encodeURIComponent(wallet)}`,
    ),
  revoke: (wallet: string, id: string) =>
    call<{ id: string; revoked: boolean }>("/api/session/keys/revoke", {
      method: "POST",
      body: JSON.stringify({ wallet, id }),
    }),
};

export const authApi = {
  nonce: () =>
    call<{ nonce: string; statement: string }>("/api/auth/nonce", {
      method: "POST",
      body: "{}",
    }),
  verify: (wallet: string, nonce: string, signature: string) =>
    call<{ wallet: string; session: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ wallet, nonce, signature }),
    }),
};

export const providersApi = {
  buildRegisterTx: (wallet: string, rate: number) =>
    call<{ serializedTx: string }>("/api/providers/build-register-tx", {
      method: "POST",
      body: JSON.stringify({ wallet, rate }),
    }),

  register: (
    wallet: string,
    gpuType: string,
    capacity: number,
    stakeAmount: number,
    host?: string,
    port?: string,
    username?: string,
    password?: string,
    rateMicro?: number,
    txSig?: string,
  ) =>
    call<{ id: string; status: string }>("/api/providers", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        gpuType,
        capacity,
        stakeAmount,
        host,
        port,
        username,
        password,
        rateMicro,
        txSig,
      }),
    }),
};

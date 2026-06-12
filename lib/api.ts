export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export interface SessionOrder {
  id: string;
  gpuType: string;
  commitHash: string;
  revealed: boolean;
  status: "committed" | "revealed" | "matched" | "settled" | "cancelled";
  ts: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) ?? `request failed (${res.status})`);
  }
  return body as T;
}

export interface MarketPrice {
  gpuType: string;
  clearingPrice: number;
  ts: string;
}
export interface ProviderRow {
  gpuType: string;
  capacity: number;
  providerCount: number;
  totalStake: number;
}
export interface MarketStats {
  window: string;
  gpuTypes: number;
  totalFills: number;
  avgClearingPrice: number | null;
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

  list: (wallet: string) =>
    call<{ orders: SessionOrder[] }>(
      `/api/session/orders?wallet=${encodeURIComponent(wallet)}`,
    ),
};

import { pool, query } from "../db/index.ts";
import { env } from "../lib/env.ts";
import { broadcast } from "./websocket.ts";

/**
 * Obscura matching engine — a scheduled uniform-price batch auction.
 *
 * Each run, for every GPU type with revealed intents:
 *   1. sort bids highest-first,
 *   2. fill them against active provider capacity,
 *   3. the marginal (lowest filled) bid sets a single clearing price,
 *   4. write an aggregate settlement + a market_prices tick,
 *   5. advance filled orders to `settled` and drop their ephemeral intents.
 *
 * Unfilled intents (below the clearing price / past capacity) carry to the next
 * batch. This is the real lifecycle — nothing here is seeded.
 */

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastRunTimestamp = Date.now();

export function getMatchingStatus() {
  const intervalSeconds = Math.max(5, env.matchingIntervalSeconds);
  return {
    lastRun: lastRunTimestamp,
    nextRun: lastRunTimestamp + intervalSeconds * 1000,
    intervalSeconds,
  };
}

interface Intent {
  order_id: string;
  gpu_type: string;
  price_micro: string;
  qty: number;
  network: string;
}

export interface BatchResult {
  batchId: number | null;
  totalFills: number;
  byGpu: { gpuType: string; clearingPrice: number; fills: number }[];
}

export function startMatchingEngine(): void {
  if (timer) return;
  const ms = Math.max(5, env.matchingIntervalSeconds) * 1000;
  timer = setInterval(() => {
    void runBatch().catch((e) => console.error("[matching] batch failed:", e));
  }, ms);
  console.log(`[matching] engine started — every ${env.matchingIntervalSeconds}s`);
}

export function stopMatchingEngine(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function runBatch(): Promise<BatchResult> {
  if (running) return { batchId: null, totalFills: 0, byGpu: [] };
  running = true;
  lastRunTimestamp = Date.now();
  const client = await pool.connect();
  try {
    const { rows: intents } = await client.query<Intent>(
      `SELECT oi.order_id, oi.gpu_type, oi.price_micro, oi.qty, o.network
       FROM order_intents oi
       JOIN orders o ON oi.order_id = o.id`,
    );
    if (intents.length === 0) {
      return { batchId: null, totalFills: 0, byGpu: [] };
    }

    // Active capacity per GPU type & network.
    const { rows: caps } = await client.query<{ gpu_type: string; network: string; cap: string }>(
      `SELECT gpu_type, network, COALESCE(SUM(capacity), 0) AS cap
       FROM providers WHERE status = 'active' GROUP BY gpu_type, network`,
    );
    const capByGpuNet = new Map<string, number>();
    for (const c of caps) {
      capByGpuNet.set(`${c.gpu_type}_${c.network}`, Number(c.cap));
    }

    // Group intents by GPU type and network.
    const byGpuNet = new Map<string, Intent[]>();
    for (const it of intents) {
      const key = `${it.gpu_type}_${it.network}`;
      const list = byGpuNet.get(key) ?? [];
      list.push(it);
      byGpuNet.set(key, list);
    }

    const { rows: b } = await client.query<{ next: string }>(
      `SELECT COALESCE(MAX(batch_id), 0) + 1 AS next FROM settlements`,
    );
    const batchId = Number(b[0].next);

    await client.query("BEGIN");
    let totalFills = 0;
    const result: BatchResult["byGpu"] = [];

    for (const [key, list] of byGpuNet) {
      const [gpu, net] = key.split("_");
      const capacity = capByGpuNet.get(key) ?? 0;
      if (capacity <= 0) continue; // no liquidity for this GPU on this network

      // Highest bids fill first; the marginal fill sets the clearing price.
      list.sort((a, b) => Number(b.price_micro) - Number(a.price_micro));
      const filled: string[] = [];
      let used = 0;
      let clearingMicro = 0;
      for (const it of list) {
        if (used >= capacity) break;
        filled.push(it.order_id);
        used += it.qty;
        clearingMicro = Number(it.price_micro);
      }
      if (filled.length === 0) continue;

      const clearingPrice = clearingMicro / 1_000_000;

      await client.query(
        `INSERT INTO settlements (ts, batch_id, gpu_type, clearing_price, fill_count, network)
         VALUES (now(), $1, $2, $3, $4, $5)`,
        [batchId, gpu, clearingPrice, filled.length, net],
      );
      await client.query(
        `INSERT INTO market_prices (ts, gpu_type, clearing_price, network) VALUES (now(), $1, $2, $3)`,
        [gpu, clearingPrice, net],
      );
      for (const orderId of filled) {
        // Find an active provider for this GPU type & network that has capacity > 0
        const { rows: matchedProviders } = await client.query<{
          id: string;
          wallet: string;
          host: string | null;
          port: string | null;
          username: string | null;
          password: string | null;
        }>(
          `SELECT id, wallet, host, port, username, password 
           FROM providers 
           WHERE gpu_type = $1 AND network = $2 AND status = 'active' AND capacity > 0
           ORDER BY updated_at ASC
           LIMIT 1`,
          [gpu, net],
        );

        let host: string | null = null;
        let port: string | null = null;
        let username: string | null = null;
        let password: string | null = null;
        let provWallet: string | null = null;

        const orderIntent = list.find((it) => it.order_id === orderId);
        const orderHours = orderIntent ? orderIntent.qty : 1;

        if (matchedProviders.length > 0) {
          const prov = matchedProviders[0];
          host = prov.host;
          port = prov.port;
          username = prov.username;
          password = prov.password;
          provWallet = prov.wallet;

          const deductQty = orderIntent ? orderIntent.qty : 1;
          await client.query(
            `UPDATE providers SET capacity = GREATEST(0, capacity - $1) WHERE id = $2`,
            [deductQty, prov.id],
          );
        }

        await client.query(
          `UPDATE orders 
           SET status = 'matched', 
               assigned_host = $1, 
               assigned_port = $2, 
               assigned_username = $3, 
               assigned_password = $4,
               assigned_provider_wallet = $5,
               clearing_price = $6,
               hours = $7,
               batch_id = $8
           WHERE id = $9`,
          [host, port, username, password, provWallet, clearingPrice, orderHours, batchId, orderId],
        );
      }

      await client.query(`DELETE FROM order_intents WHERE order_id = ANY($1::uuid[])`, [
        filled,
      ]);

      totalFills += filled.length;
      result.push({ gpuType: gpu, clearingPrice, fills: filled.length });
    }

    await client.query("COMMIT");

    if (totalFills > 0) {
      console.log(
        `[matching] batch #${batchId}: ${totalFills} fills across ${result.length} GPU type(s)`,
      );

      // Fetch the updated 24h stats and order metrics to broadcast
      try {
        const statsRes = await client.query<{
          gpu_types: string;
          total_fills: string;
          avg_price: string | null;
        }>(`
          SELECT
            COUNT(DISTINCT gpu_type)::text AS gpu_types,
            COALESCE(SUM(fill_count), 0)::text AS total_fills,
            AVG(clearing_price)::text AS avg_price
          FROM settlements
          WHERE ts > now() - interval '24 hours'
        `);

        const metricsRes = await client.query<{
          gpu_type: string;
          total: string;
          revealed: string;
          settled: string;
        }>(`
          SELECT gpu_type,
                 COUNT(*)::text AS total,
                 COUNT(*) FILTER (WHERE revealed)::text AS revealed,
                 COUNT(*) FILTER (WHERE status = 'settled')::text AS settled
          FROM orders
          WHERE ts > now() - interval '24 hours'
          GROUP BY gpu_type
          ORDER BY gpu_type
        `);

        const s = statsRes.rows[0];
        const stats = {
          window: "24h",
          gpuTypes: Number(s?.gpu_types ?? 0),
          totalFills: Number(s?.total_fills ?? 0),
          avgClearingPrice: s?.avg_price ? Number(s.avg_price) : null,
          batchStats: getMatchingStatus(),
        };

        const breakdown = metricsRes.rows.map((r) => {
          const total = Number(r.total);
          const settled = Number(r.settled);
          return {
            gpuType: r.gpu_type,
            total,
            revealed: Number(r.revealed),
            settled,
            fillRate: total > 0 ? settled / total : 0,
          };
        });

        const newSettlements = result.map((r) => ({
          batchId,
          gpuType: r.gpuType,
          clearingPrice: r.clearingPrice,
          fillCount: r.fills,
          ts: new Date(),
        }));

        broadcast("settlement", {
          settlements: newSettlements,
          stats,
          metrics: breakdown,
        });
      } catch (err) {
        console.error("[matching] failed to broadcast settlement stats:", err);
      }
    }
    return { batchId: totalFills > 0 ? batchId : null, totalFills, byGpu: result };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    running = false;
  }
}


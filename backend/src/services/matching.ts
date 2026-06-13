import { pool, query } from "../db/index.ts";
import { env } from "../lib/env.ts";

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

interface Intent {
  order_id: string;
  gpu_type: string;
  price_micro: string;
  qty: number;
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
  const client = await pool.connect();
  try {
    const { rows: intents } = await client.query<Intent>(
      `SELECT order_id, gpu_type, price_micro, qty FROM order_intents`,
    );
    if (intents.length === 0) {
      return { batchId: null, totalFills: 0, byGpu: [] };
    }

    // Active capacity per GPU type (the implicit sell side).
    const { rows: caps } = await client.query<{ gpu_type: string; cap: string }>(
      `SELECT gpu_type, COALESCE(SUM(capacity), 0) AS cap
       FROM providers WHERE status = 'active' GROUP BY gpu_type`,
    );
    const capByGpu = new Map(caps.map((c) => [c.gpu_type, Number(c.cap)]));

    // Group intents by GPU.
    const byGpu = new Map<string, Intent[]>();
    for (const it of intents) {
      const list = byGpu.get(it.gpu_type) ?? [];
      list.push(it);
      byGpu.set(it.gpu_type, list);
    }

    const { rows: b } = await client.query<{ next: string }>(
      `SELECT COALESCE(MAX(batch_id), 0) + 1 AS next FROM settlements`,
    );
    const batchId = Number(b[0].next);

    await client.query("BEGIN");
    let totalFills = 0;
    const result: BatchResult["byGpu"] = [];

    for (const [gpu, list] of byGpu) {
      const capacity = capByGpu.get(gpu) ?? 0;
      if (capacity <= 0) continue; // no liquidity for this GPU

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
        `INSERT INTO settlements (ts, batch_id, gpu_type, clearing_price, fill_count)
         VALUES (now(), $1, $2, $3, $4)`,
        [batchId, gpu, clearingPrice, filled.length],
      );
      await client.query(
        `INSERT INTO market_prices (ts, gpu_type, clearing_price) VALUES (now(), $1, $2)`,
        [gpu, clearingPrice],
      );
      await client.query(
        `UPDATE orders SET status = 'settled' WHERE id = ANY($1::uuid[])`,
        [filled],
      );
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

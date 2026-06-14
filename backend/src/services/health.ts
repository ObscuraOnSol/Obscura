import net from "net";
import { pool } from "../db/index.ts";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startHealthChecker(): void {
  if (timer) return;
  // 5 minutes in milliseconds
  const intervalMs = 5 * 60 * 1000;
  timer = setInterval(() => {
    void runHealthChecks().catch((e) => console.error("[health] check failed:", e));
  }, intervalMs);
  console.log("[health] provider health checker started — every 5m");
  
  // Run once immediately on startup with a brief delay
  setTimeout(() => {
    void runHealthChecks().catch((e) => console.error("[health] initial check failed:", e));
  }, 5000);
}

export function stopHealthChecker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

function pingSsh(host: string, port: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
        socket.destroy();
      }
    });

    const fail = () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
        socket.destroy();
      }
    };

    socket.on("error", fail);
    socket.on("timeout", fail);

    socket.connect(port, host);
  });
}

export async function runHealthChecks(): Promise<void> {
  if (running) return;
  running = true;

  const client = await pool.connect();
  try {
    // Select all active providers
    const { rows: providers } = await client.query<{
      id: string;
      wallet: string;
      host: string | null;
      port: string | null;
      stake_amount: string;
      failed_pings: number;
    }>(
      `SELECT id, wallet, host, port, stake_amount, failed_pings 
       FROM providers 
       WHERE status = 'active'`
    );

    for (const p of providers) {
      if (!p.host) {
        continue;
      }

      const port = p.port ? parseInt(p.port) : 22;
      const ok = await pingSsh(p.host, port);

      if (ok) {
        // Increment successful pings
        await client.query(
          `UPDATE providers SET successful_pings = successful_pings + 1, updated_at = now() WHERE id = $1`,
          [p.id]
        );
        console.log(`[health] Ping succeeded for provider ${p.id} (${p.host}:${port})`);
      } else {
        // Increment failed pings and slash 25% of current stake
        const newFailedPings = p.failed_pings + 1;
        const currentStake = parseFloat(p.stake_amount);
        const slashAmount = currentStake * 0.25;
        const remainingStake = currentStake * 0.75;
        
        if (newFailedPings >= 4) {
          // Delist the provider by setting capacity = 0 and status = slashed
          await client.query(
            `UPDATE providers 
             SET failed_pings = $1, 
                 stake_amount = $2, 
                 status = 'slashed', 
                 capacity = 0,
                 updated_at = now() 
             WHERE id = $3`,
            [newFailedPings, remainingStake, p.id]
          );
          console.warn(`[health] Provider ${p.id} (${p.host}:${port}) failed healthcheck 4 times. Slashed and delisted!`);
        } else {
          await client.query(
            `UPDATE providers 
             SET failed_pings = $1, 
                 stake_amount = $2, 
                 updated_at = now() 
             WHERE id = $3`,
            [newFailedPings, remainingStake, p.id]
          );
          console.warn(`[health] Ping failed for provider ${p.id} (${p.host}:${port}). Slashed ${slashAmount.toFixed(2)} USDC (25%).`);
        }
      }
    }
  } catch (err) {
    console.error("[health] Error during health checks:", err);
  } finally {
    client.release();
    running = false;
  }
}

import { pool } from "../db/index.ts";
import { sendUsdcFromService } from "../lib/solana.ts";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

// Configurable "escrow hour" duration in milliseconds for easier testing in development
const ESCROW_HOUR_MS = Number(process.env.ESCROW_HOUR_MS ?? (60 * 60 * 1000)); // Default to 1 hour (3,600,000 ms)

export function startEscrowManager(): void {
  if (timer) return;
  // Poll every 1 minute
  const intervalMs = 60 * 1000;
  timer = setInterval(() => {
    void processEscrowPayouts().catch((e) => console.error("[escrow] Payout cycle failed:", e));
  }, intervalMs);
  console.log(`[escrow] Escrow manager service started — polling every 1m (1 hour duration = ${ESCROW_HOUR_MS}ms)`);

  // Run once immediately on startup with a brief delay
  setTimeout(() => {
    void processEscrowPayouts().catch((e) => console.error("[escrow] Initial payout cycle failed:", e));
  }, 10000);
}

export function stopEscrowManager(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function processEscrowPayouts(): Promise<void> {
  if (running) return;
  running = true;

  const client = await pool.connect();
  try {
    // Select all settled orders where we haven't paid out all hours yet.
    // Also ensures assigned_provider_wallet and clearing_price are present.
    const { rows: orders } = await client.query<{
      id: string;
      assigned_provider_wallet: string;
      clearing_price: string;
      hours: number;
      payouts_completed: number;
      lease_started_at: Date;
    }>(
      `SELECT id, assigned_provider_wallet, clearing_price, hours, payouts_completed, lease_started_at
       FROM orders
       WHERE status = 'settled'
         AND payouts_completed < hours
         AND lease_started_at IS NOT NULL
         AND assigned_provider_wallet IS NOT NULL
         AND clearing_price IS NOT NULL`
    );

    for (const order of orders) {
      // Calculate how many hours have elapsed since lease_started_at
      const elapsedMs = Date.now() - order.lease_started_at.getTime();
      const elapsedHours = Math.floor(elapsedMs / ESCROW_HOUR_MS);
      
      // We should have paid out up to: Math.min(elapsedHours, order.hours)
      const targetPayouts = Math.min(elapsedHours, order.hours);
      
      // If we owe any payouts (i.e. targetPayouts > payouts_completed)
      if (targetPayouts > order.payouts_completed) {
        const payoutsNeeded = targetPayouts - order.payouts_completed;
        const rate = parseFloat(order.clearing_price);
        
        console.log(`[escrow] Order ${order.id} needs ${payoutsNeeded} payout(s). Elapsed intervals: ${elapsedHours}, Paid: ${order.payouts_completed}`);
        
        // Process them one by one to ensure database state is updated after each transfer
        for (let i = 0; i < payoutsNeeded; i++) {
          try {
            console.log(`[escrow] Executing payout of ${rate} USDC to provider ${order.assigned_provider_wallet} for order ${order.id}...`);
            
            // Execute transfer on-chain
            const txSig = await sendUsdcFromService(order.assigned_provider_wallet, rate);
            
            // Increment payouts_completed in DB
            const nextPayoutCount = order.payouts_completed + 1;
            await client.query(
              `UPDATE orders 
               SET payouts_completed = $1, 
                   last_payout_at = now() 
               WHERE id = $2`,
              [nextPayoutCount, order.id]
            );
            
            order.payouts_completed = nextPayoutCount; // Update local loop state
            console.log(`[escrow] Payout successful. Tx: ${txSig}. Updated order ${order.id} payouts to ${nextPayoutCount}/${order.hours}`);
          } catch (txErr) {
            console.error(`[escrow] Failed to transfer payout for order ${order.id}:`, txErr);
            // Break loop for this order so we don't try subsequent payouts in the same cycle if one fails (e.g. rate limit / network error)
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error("[escrow] Error in processEscrowPayouts:", err);
  } finally {
    client.release();
    running = false;
  }
}

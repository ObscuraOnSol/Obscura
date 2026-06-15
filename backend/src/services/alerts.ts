import pg from "pg";
import { pool } from "../db/index.ts";
import { broadcast } from "./websocket.ts";

export interface PriceAlert {
  id: string;
  wallet: string;
  gpuType: string;
  targetPrice: number;
  network: string;
  isTriggered: boolean;
  triggeredAt: Date | null;
  createdAt: Date;
}

/**
 * Checks for any active (untriggered) price alerts that match the newly settled clearing price.
 * For any matching alerts (targetPrice >= clearingPrice), sets them to triggered and broadcasts
 * the event to the frontend client via WebSocket.
 */
export async function checkPriceAlerts(
  gpuType: string,
  clearingPrice: number,
  network: string,
  clientConnection?: any
): Promise<void> {
  const runner = (clientConnection || pool) as pg.Pool | pg.PoolClient;
  
  // Find and update alerts matching:
  // - same gpu_type
  // - same network
  // - not yet triggered
  // - target_price >= clearing_price (alert triggers when price drops to or below target)
  const { rows: triggered } = await runner.query<{
    id: string;
    wallet: string;
    gpu_type: string;
    target_price: string;
    network: string;
    triggered_at: Date;
    created_at: Date;
  }>(
    `UPDATE price_alerts
     SET is_triggered = TRUE, triggered_at = now()
     WHERE gpu_type = $1 AND network = $2 AND is_triggered = FALSE AND target_price >= $3
     RETURNING id, wallet, gpu_type, target_price, network, triggered_at, created_at`,
    [gpuType, network, clearingPrice]
  );

  for (const alert of triggered) {
    const targetVal = Number(alert.target_price);
    console.log(
      `[alerts] Price alert triggered for wallet ${alert.wallet}: ${alert.gpu_type} clearing price is now $${clearingPrice}/hr (target was <= $${targetVal}/hr)`
    );

    broadcast("price_alert", {
      id: alert.id,
      wallet: alert.wallet,
      gpuType: alert.gpu_type,
      targetPrice: targetVal,
      clearingPrice,
      network: alert.network,
      triggeredAt: alert.triggered_at,
    });
  }
}

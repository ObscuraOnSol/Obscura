import { query } from "../db/index.ts";
import { sendTelegramMessage, telegramConfigured } from "./telegram.ts";

export interface FillReceipt {
  wallet: string;
  orderId: string;
  gpuType: string;
  clearingPrice: number; // USD / hr
  hours?: number | null;
}

/**
 * Push a fill receipt to the order owner's enabled channels (#10).
 * Telegram only for now; respects notification prefs and is a no-op unless the
 * user opted in, linked their chat, and a bot token is configured.
 */
export async function sendOrderFillReceipt(r: FillReceipt): Promise<void> {
  try {
    const { rows } = await query<{
      notification_prefs: { telegramEnabled?: boolean; orderFillsEnabled?: boolean } | null;
      telegram_chat_id: string | null;
    }>(
      `SELECT notification_prefs, telegram_chat_id FROM users WHERE wallet = $1`,
      [r.wallet],
    );
    if (rows.length === 0) return;

    const prefs = rows[0].notification_prefs ?? {};
    const chatId = rows[0].telegram_chat_id;
    const fillsOn = prefs.orderFillsEnabled !== false; // default on
    const telegramOn = prefs.telegramEnabled === true;

    if (!fillsOn || !telegramOn || !chatId || !telegramConfigured()) return;

    const lines = [
      "✅ <b>Order filled</b>",
      `${r.gpuType} @ <b>$${r.clearingPrice.toFixed(4)}/hr</b>`,
      r.hours ? `Duration: ${r.hours}h` : null,
      `Order: <code>${r.orderId.slice(0, 8)}</code>`,
      "",
      "Open Obscura to pay and activate your lease.",
    ].filter(Boolean) as string[];

    await sendTelegramMessage(chatId, lines.join("\n"));
  } catch (e) {
    console.error("[notify] fill receipt failed:", e);
  }
}

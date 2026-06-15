import { query } from "../db/index.ts";
import { sendTelegramMessage, telegramConfigured } from "./telegram.ts";
import { sendEmail, emailConfigured } from "./email.ts";

export interface FillReceipt {
  wallet: string;
  orderId: string;
  gpuType: string;
  clearingPrice: number; // USD / hr
  hours?: number | null;
}

interface Prefs {
  telegramEnabled?: boolean;
  emailEnabled?: boolean;
  emailAddress?: string;
  orderFillsEnabled?: boolean;
}

/**
 * Push a fill receipt to the order owner's enabled channels (#10) — Telegram
 * and/or email. Respects notification prefs; each channel is independent and a
 * no-op unless the user opted in and that channel is configured.
 */
export async function sendOrderFillReceipt(r: FillReceipt): Promise<void> {
  try {
    const { rows } = await query<{
      notification_prefs: Prefs | null;
      telegram_chat_id: string | null;
    }>(
      `SELECT notification_prefs, telegram_chat_id FROM users WHERE wallet = $1`,
      [r.wallet],
    );
    if (rows.length === 0) return;

    const prefs = rows[0].notification_prefs ?? {};
    if (prefs.orderFillsEnabled === false) return; // default on

    const chatId = rows[0].telegram_chat_id;
    const rate = `$${r.clearingPrice.toFixed(4)}/hr`;
    const shortId = r.orderId.slice(0, 8);
    const duration = r.hours ? `${r.hours}h` : null;

    // Telegram
    if (prefs.telegramEnabled === true && chatId && telegramConfigured()) {
      const lines = [
        "✅ <b>Order filled</b>",
        `${r.gpuType} @ <b>${rate}</b>`,
        duration ? `Duration: ${duration}` : null,
        `Order: <code>${shortId}</code>`,
        "",
        "Open Obscura to pay and activate your lease.",
      ].filter(Boolean) as string[];
      await sendTelegramMessage(chatId, lines.join("\n"));
    }

    // Email (Resend)
    if (prefs.emailEnabled === true && prefs.emailAddress && emailConfigured()) {
      await sendEmail(
        prefs.emailAddress,
        `Obscura — your ${r.gpuType} order filled`,
        renderEmail({ gpuType: r.gpuType, rate, duration, shortId }),
      );
    }
  } catch (e) {
    console.error("[notify] fill receipt failed:", e);
  }
}

function renderEmail(o: {
  gpuType: string;
  rate: string;
  duration: string | null;
  shortId: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:ui-sans-serif,system-ui,sans-serif;color:#e8e8e8">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#22c7b8">Obscura</div>
    <h1 style="font-size:22px;margin:16px 0 4px">✅ Order filled</h1>
    <p style="color:#9aa;margin:0 0 24px">One of your compute orders matched in the latest batch.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;color:#9aa">GPU</td><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;text-align:right">${o.gpuType}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;color:#9aa">Clearing price</td><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;text-align:right;font-weight:600">${o.rate}</td></tr>
      ${o.duration ? `<tr><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;color:#9aa">Duration</td><td style="padding:10px 0;border-bottom:1px solid #1c1c1c;text-align:right">${o.duration}</td></tr>` : ""}
      <tr><td style="padding:10px 0;color:#9aa">Order</td><td style="padding:10px 0;text-align:right;font-family:ui-monospace,monospace">${o.shortId}</td></tr>
    </table>
    <p style="margin:24px 0 0;color:#9aa;font-size:13px">Open Obscura to pay and activate your lease.</p>
  </div></body></html>`;
}

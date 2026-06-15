import { query } from "../db/index.ts";
import { env } from "../lib/env.ts";

/**
 * Telegram delivery for fill receipts (#10). Entirely env-gated: with no
 * TELEGRAM_BOT_TOKEN everything here is a no-op. Linking uses long polling so
 * no public webhook URL is required.
 */
const api = (method: string) =>
  `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

export function telegramConfigured(): boolean {
  return !!env.telegramBotToken;
}

// Bot @username — from env, else auto-detected from the token via getMe (cached).
let cachedUsername = env.telegramBotUsername || "";
export async function ensureBotUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  if (!telegramConfigured()) return "";
  try {
    const res = await fetch(api("getMe"));
    const data = (await res.json()) as { ok: boolean; result?: { username?: string } };
    if (data.ok && data.result?.username) cachedUsername = data.result.username;
  } catch (e) {
    console.error("[telegram] getMe failed:", e);
  }
  return cachedUsername;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!telegramConfigured()) return false;
  try {
    const res = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage failed:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] sendMessage error:", e);
    return false;
  }
}

// --- /start linking via long polling ---

interface TgUpdate {
  update_id: number;
  message?: { chat?: { id?: number }; text?: string };
}

let polling = false;
let offset = 0;

export function startTelegramPolling(): void {
  if (!telegramConfigured() || polling) return;
  polling = true;
  void ensureBotUsername(); // warm the cached @username
  console.log("[telegram] linking poller started");
  void pollLoop();
}

export function stopTelegramPolling(): void {
  polling = false;
}

async function pollLoop(): Promise<void> {
  while (polling) {
    try {
      const res = await fetch(`${api("getUpdates")}?timeout=30&offset=${offset}`, {
        signal: AbortSignal.timeout(40_000),
      });
      const data = (await res.json()) as { ok: boolean; result?: TgUpdate[] };
      if (data.ok && data.result) {
        for (const u of data.result) {
          offset = u.update_id + 1;
          await handleUpdate(u);
        }
      }
    } catch {
      // network hiccup / long-poll timeout — brief backoff, then retry
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function handleUpdate(u: TgUpdate): Promise<void> {
  const text = u.message?.text?.trim();
  const chatId = u.message?.chat?.id;
  if (!text || chatId == null || !text.startsWith("/start")) return;

  const code = text.split(/\s+/)[1];
  if (!code) {
    await sendTelegramMessage(
      String(chatId),
      "Open the <b>Connect Telegram</b> link from Obscura → Settings to link your wallet.",
    );
    return;
  }

  const { rowCount } = await query(
    `UPDATE users SET telegram_chat_id = $1, telegram_link_code = NULL WHERE telegram_link_code = $2`,
    [String(chatId), code],
  );
  await sendTelegramMessage(
    String(chatId),
    rowCount
      ? "✅ <b>Linked!</b> You'll get a receipt here whenever one of your Obscura orders fills."
      : "That link code is invalid or expired — generate a new one in Obscura → Settings.",
  );
}

import { env } from "../lib/env.ts";

/**
 * Email delivery via Resend (#10). Entirely env-gated: with no RESEND_API_KEY
 * every call is a no-op. `RESEND_FROM` defaults to Resend's onboarding sender
 * (works for testing without a verified domain).
 */
export function emailConfigured(): boolean {
  return !!env.resendApiKey;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!emailConfigured() || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.resendApiKey}`,
      },
      body: JSON.stringify({ from: env.resendFrom, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] resend send failed:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] resend error:", e);
    return false;
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Mail, Send, Bell, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { DataError } from "@/components/marketplace/marketplace-live";
import { useWallet } from "@/lib/wallet";
import { notificationsApi, telegramApi, type NotificationPrefs } from "@/lib/api";

export function NotificationPreferences() {
  const { wallet } = useWallet();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  // Local state copy for form editing
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState("");
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState(true);
  const [orderFillsEnabled, setOrderFillsEnabled] = useState(true);

  // Telegram linking (chat-id capture via /start)
  const [tgConfigured, setTgConfigured] = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);

  const load = useCallback(async (w: string) => {
    try {
      const data = await notificationsApi.get(w);
      setPrefs(data);
      setEmailEnabled(data.emailEnabled);
      setEmailAddress(data.emailAddress);
      setTelegramEnabled(data.telegramEnabled);
      setTelegramUsername(data.telegramUsername);
      setPriceAlertsEnabled(data.priceAlertsEnabled);
      setOrderFillsEnabled(data.orderFillsEnabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load notification preferences");
    }
    try {
      const s = await telegramApi.status(w);
      setTgConfigured(s.configured);
      setTgLinked(s.linked);
    } catch {
      /* non-fatal */
    }
  }, []);

  async function connectTelegram() {
    if (!wallet) return;
    setTgBusy(true);
    setError(null);
    try {
      const { deepLink } = await telegramApi.linkCode(wallet);
      window.open(deepLink, "_blank", "noopener,noreferrer");
      // Poll for the /start to land (up to ~30s).
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await telegramApi.status(wallet);
        if (s.linked) {
          setTgLinked(true);
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Telegram linking");
    } finally {
      setTgBusy(false);
    }
  }

  async function disconnectTelegram() {
    if (!wallet) return;
    setTgBusy(true);
    try {
      await telegramApi.unlink(wallet);
      setTgLinked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlink Telegram");
    } finally {
      setTgBusy(false);
    }
  }

  useEffect(() => {
    if (wallet) void load(wallet);
  }, [wallet, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;

    if (emailEnabled && !emailAddress) {
      setError("Please provide a valid email address to enable email notifications.");
      return;
    }

    if (telegramEnabled && !telegramUsername) {
      setError("Please provide your Telegram username/handle to enable Telegram notifications.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedPrefs: NotificationPrefs = {
        emailEnabled,
        emailAddress,
        telegramEnabled,
        telegramUsername: telegramUsername.replace(/^@/, ""), // Strip leading @ if present
        priceAlertsEnabled,
        orderFillsEnabled,
      };

      await notificationsApi.update(wallet, updatedPrefs);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to save preferences");
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) return null;

  return (
    <div className="max-w-2xl mt-12 pt-8 border-t border-border/60">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary animate-pulse" />
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose where and when you receive order status fills and price alert notifications.
      </p>

      <form onSubmit={save} className="mt-6 space-y-6">
        <div className="space-y-4 rounded-xl border border-border bg-card/20 p-5">
          {/* Email Settings */}
          <div className="flex flex-col gap-3 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">Email Alerts</h3>
                  <p className="text-xs text-muted-foreground">Receive updates directly to your inbox</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
            </div>
            {emailEnabled && (
              <FadeIn>
                <div className="mt-1">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    required={emailEnabled}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </FadeIn>
            )}
          </div>

          {/* Telegram Settings */}
          <div className="flex flex-col gap-3 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">Telegram Channels</h3>
                  <p className="text-xs text-muted-foreground">Push notifications to your Telegram account</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
            </div>
            {telegramEnabled && (
              <FadeIn>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    required={telegramEnabled}
                    className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Connect Telegram — captures chat id via /start (#10) */}
                <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  {!tgConfigured ? (
                    <p className="text-[11px] text-muted-foreground">
                      Telegram delivery isn&apos;t enabled on this deployment yet — your
                      preference is saved and activates once it&apos;s configured.
                    </p>
                  ) : tgLinked ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Telegram connected
                      </span>
                      <button
                        type="button"
                        onClick={disconnectTelegram}
                        disabled={tgBusy}
                        className="text-[11px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-muted-foreground">
                        Connect Telegram so receipts can reach you — opens the bot, then tap{" "}
                        <b className="text-foreground">Start</b>.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={connectTelegram}
                        disabled={tgBusy}
                      >
                        {tgBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Connect
                      </Button>
                    </div>
                  )}
                </div>
              </FadeIn>
            )}
          </div>

          {/* Event Subscriptions */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Toggles</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">GPU Price Alerts</span>
                  <p className="text-[11px] text-muted-foreground">When clearing prices fall below your targets</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={priceAlertsEnabled}
                onChange={(e) => setPriceAlertsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Order Fills</span>
                  <p className="text-[11px] text-muted-foreground">When your commitments get matched and settled</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={orderFillsEnabled}
                onChange={(e) => setOrderFillsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
            </div>
          </div>
        </div>

        {error && <DataError message={error} />}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy} className="h-9">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
          
          {success && (
            <FadeIn>
              <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Preferences saved!
              </span>
            </FadeIn>
          )}
        </div>
      </form>
    </div>
  );
}

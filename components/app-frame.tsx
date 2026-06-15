"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  ScrollText,
  Store,
  Activity,
  Bot,
  Settings,
  Menu,
  X,
  ArrowLeft,
  BookOpen,
  Bell,
} from "lucide-react";
import { WS_BASE } from "@/lib/api";

import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ClickEffects } from "@/components/click-effects";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { shortHash } from "@/lib/utils";
import { ReelAnimation } from "@/components/reel-animation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ScrollText },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/agent", label: "Agent mode", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function AppFrame({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { wallet } = useWallet();
  const [notifications, setNotifications] = useState<{
    id: string;
    type: "price_alert" | "order_fill";
    gpuType: string;
    targetPrice?: number;
    clearingPrice: number;
    batchId?: number;
    orderId?: string;
  }[]>([]);

  useEffect(() => {
    if (!wallet) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        socket = new WebSocket(WS_BASE);

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "price_alert") {
              const alert = msg.data;
              if (alert.wallet === wallet) {
                setNotifications((prev) => [
                  ...prev,
                  {
                    id: alert.id,
                    type: "price_alert",
                    gpuType: alert.gpuType,
                    targetPrice: alert.targetPrice,
                    clearingPrice: alert.clearingPrice,
                  },
                ]);

                // Auto dismiss after 10s
                setTimeout(() => {
                  setNotifications((prev) => prev.filter((n) => n.id !== alert.id));
                }, 10000);
              }
            } else if (msg.type === "order_fill") {
              const fill = msg.data;
              if (fill.wallet === wallet) {
                setNotifications((prev) => [
                  ...prev,
                  {
                    id: fill.orderId,
                    type: "order_fill",
                    gpuType: fill.gpuType,
                    clearingPrice: fill.clearingPrice,
                    batchId: fill.batchId,
                    orderId: fill.orderId,
                  },
                ]);

                // Auto dismiss after 10s
                setTimeout(() => {
                  setNotifications((prev) => prev.filter((n) => n.id !== fill.orderId));
                }, 10000);
              }
            }
          } catch (err) {
            console.error("[app-frame] failed to parse ws message:", err);
          }
        };

        socket.onclose = () => {
          reconnectTimeout = setTimeout(connect, 5000);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch (err) {
        console.error("[app-frame] failed to connect ws:", err);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [wallet]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Custom cursor + click ripples, same as the landing page */}
      <ClickEffects />

      {/* Top bar: logo (back to landing) on the left, hamburger nav on the right */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Back">
              <Wordmark className="[&_span]:hidden sm:[&_span]:inline" />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h1>
          </div>

          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-card/40 text-foreground transition-colors hover:bg-card hover:border-primary/30"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      {/* Navigation drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-xs flex-col border-l border-border/50 bg-background/95 p-6 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <Wordmark className="[&_span]:text-base" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-card/50 text-foreground transition-colors hover:bg-card"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="mt-8 flex flex-col gap-1">
                {NAV.map((item) => {
                  const on = item.href === active;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        on
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-card hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="mt-4 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>

              <SessionBox />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Real-time Price Alert & Order Fill Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md ${
                n.type === "price_alert"
                  ? "border-amber-500/30 bg-card/90"
                  : "border-primary/30 bg-card/90"
              }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 border ${
                n.type === "price_alert"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  : "bg-primary/10 border-primary/20 text-primary"
              }`}>
                <Bell className="h-4.5 w-4.5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-foreground">
                  {n.type === "price_alert" ? "Price Alert Triggered!" : "Order Matched & Filled!"}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.type === "price_alert" ? (
                    <>
                      <span className="font-semibold text-foreground">{n.gpuType}</span> clearing price dropped to{" "}
                      <span className="font-semibold text-emerald-500 font-mono">${n.clearingPrice.toFixed(2)}/hr</span> (Target was ${n.targetPrice?.toFixed(2)}).
                    </>
                  ) : (
                    <>
                      Your order for <span className="font-semibold text-foreground">{n.gpuType}</span> was filled in batch{" "}
                      <span className="font-semibold text-foreground font-mono">#{n.batchId}</span> at{" "}
                      <span className="font-semibold text-emerald-500 font-mono">${n.clearingPrice.toFixed(2)}/hr</span>.
                    </>
                  )}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    href={n.type === "price_alert" ? "/settings" : "/orders"}
                    className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
                  >
                    {n.type === "price_alert" ? "View Alerts" : "View Connection"}
                  </Link>
                  <span className="text-[10px] text-muted-foreground/60">•</span>
                  <button
                    onClick={() => dismissNotification(n.id)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SessionBox() {
  const { wallet, connect, disconnect } = useWallet();
  const { signedIn, signingIn, signIn } = useSession();

  return (
    <div className="mt-auto rounded-lg border border-border bg-card/40 p-3">
      <div className="data flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        Session
        {signedIn && <span className="text-primary">● signed in</span>}
      </div>
      <div className="data mt-1 text-xs text-foreground">
        {wallet ? shortHash(wallet, 4, 4) : "not connected"}
      </div>
      {!wallet ? (
        <Button size="sm" className="mt-3 w-full" onClick={connect}>
          Connect wallet
        </Button>
      ) : !signedIn ? (
        <Button size="sm" className="mt-3 w-full" onClick={() => void signIn()} disabled={signingIn}>
          {signingIn ? "Check your wallet…" : "Sign in with Solana"}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => void disconnect()}
        >
          Disconnect
        </Button>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/30">
      {/* Background icon watermark: tilted, scale-up, and green-tinted on hover */}
      {Icon && (
        <div className="absolute -bottom-5 -right-5 pointer-events-none opacity-[0.06] text-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] group-hover:opacity-[0.12] ease-out">
          <Icon className="h-24 w-24 rotate-[-12deg]" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="data mt-2 text-2xl font-bold text-foreground relative z-10">
        <ReelAnimation text={value} />
      </div>
      {sub ? (
        <div className="data mt-1 text-xs text-muted-foreground relative z-10">{sub}</div>
      ) : null}
    </div>
  );
}

export function Placeholder({ note }: { note: string }) {
  return (
    <div className="mt-6 flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
      <div>
        <div className="data text-[11px] uppercase tracking-[0.2em] text-primary">
          Scaffolded surface
        </div>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

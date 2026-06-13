"use client";

import { useState } from "react";
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
} from "lucide-react";

import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ClickEffects } from "@/components/click-effects";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { shortHash } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ScrollText },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/agent", label: "Agent mode", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
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

  return (
    <div className="relative min-h-screen bg-background">
      {/* Custom cursor + click ripples, same as the landing page */}
      <ClickEffects />

      {/* Top bar — logo (back to landing) on the left, hamburger nav on the right */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Back to landing">
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
                Back to landing
              </Link>

              <SessionBox />
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/30">
      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="data mt-2 text-2xl font-bold text-foreground">{value}</div>
      {sub ? (
        <div className="data mt-1 text-xs text-muted-foreground">{sub}</div>
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

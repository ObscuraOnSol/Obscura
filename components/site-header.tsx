"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { useWallet } from "@/lib/wallet";
import { useSession } from "@/lib/session";
import { shortHash } from "@/lib/utils";


export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { wallet, connect, disconnect, connecting } = useWallet();
  const { signedIn, signingIn, signIn, signOut } = useSession();

  const nav = [
    ["Marketplace", "/marketplace"],
    ["Orders", "/orders"],
    ["Agents", "/agent"],
    ["Whitepaper", "/whitepaper"],
    ["Roadmap", "/roadmap"],
    ["Docs", "/docs"],
  ] as const;

  return (
    <>
      <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between rounded-xl border border-border/40 bg-card/30 px-6 backdrop-blur-md shadow-lg shadow-black/20">
          <Link href="/">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* Desktop Auth */}
            <div className="hidden items-center gap-3 md:flex">
              {!wallet ? (
                <Button variant="ghost" size="sm" onClick={connect} disabled={connecting}>
                  {connecting ? "Connecting..." : "Sign in"}
                </Button>
              ) : !signedIn ? (
                <Button variant="ghost" size="sm" onClick={() => void signIn()} disabled={signingIn}>
                  {signingIn ? "Checking..." : "Sign in"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="font-mono text-xs">
                      {shortHash(wallet, 4, 4)}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void signOut()}
                  >
                    Disconnect
                  </Button>
                </div>
              )}
              <Link href="/dashboard">
                <Button size="sm" variant="white">
                  Launch app
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-card/50 text-foreground md:hidden hover:bg-card transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            {/* Drawer Content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-xs border-l border-border/50 bg-background/95 p-6 shadow-2xl backdrop-blur-md md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between">
                <Wordmark />
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-card/50 text-foreground hover:bg-card transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="mt-12 flex flex-col gap-6">
                {nav.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-3">
                {!wallet ? (
                  <Button variant="outline" className="w-full" onClick={connect} disabled={connecting}>
                    {connecting ? "Connecting..." : "Sign in"}
                  </Button>
                ) : !signedIn ? (
                  <Button variant="outline" className="w-full" onClick={() => void signIn()} disabled={signingIn}>
                    {signingIn ? "Checking..." : "Sign in"}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    <Link href="/dashboard" className="w-full" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full font-mono text-sm">
                        {shortHash(wallet, 4, 4)}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground text-sm"
                      onClick={() => {
                        void signOut();
                        setIsOpen(false);
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                  <Button className="w-full" variant="white">
                    Launch app
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

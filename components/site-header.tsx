"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { useComingSoon } from "@/components/coming-soon";

// `soon: true` items would enter the app, so they open the coming-soon modal.
const NAV = [
  { label: "Marketplace", soon: true },
  { label: "Orders", soon: true },
  { label: "Agents", soon: true },
  { label: "Whitepaper", href: "#" },
  { label: "Roadmap", href: "#" },
  { label: "Docs", href: "#" },
] as const;

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { open } = useComingSoon();

  return (
    <>
      <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between rounded-xl border border-border/40 bg-card/30 px-6 backdrop-blur-md shadow-lg shadow-black/20">
          <Link href="/">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) =>
              "soon" in item ? (
                <button
                  key={item.label}
                  onClick={open}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="flex items-center gap-3">
            {/* Desktop CTA */}
            <div className="hidden items-center gap-3 md:flex">
              <Button size="sm" onClick={open}>
                Coming soon
              </Button>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
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
                {NAV.map((item) =>
                  "soon" in item ? (
                    <button
                      key={item.label}
                      onClick={() => {
                        open();
                        setIsOpen(false);
                      }}
                      className="text-left text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </nav>

              <div className="mt-auto">
                <Button
                  className="w-full"
                  onClick={() => {
                    open();
                    setIsOpen(false);
                  }}
                >
                  Coming soon
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

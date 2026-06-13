"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";

export function SiteHeader({ onComingSoonClick }: { onComingSoonClick?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleComingSoonClick = () => {
    if (onComingSoonClick) {
      onComingSoonClick();
    } else {
      router.push("/?comingsoon=true");
    }
  };

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
            {nav.map(([label, href]) => {
              const isAppPage = ["/marketplace", "/orders", "/agent"].includes(href);
              if (isAppPage) {
                return (
                  <button
                    key={label}
                    onClick={handleComingSoonClick}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </button>
                );
              }
              return (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {/* Desktop Launch App replaced with Coming soon (No Sign In) */}
            <div className="hidden items-center gap-3 md:flex">
              <Button size="sm" variant="white" onClick={handleComingSoonClick}>
                Coming soon
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
                {nav.map(([label, href]) => {
                  const isAppPage = ["/marketplace", "/orders", "/agent"].includes(href);
                  if (isAppPage) {
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          setIsOpen(false);
                          handleComingSoonClick();
                        }}
                        className="text-left text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {label}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto flex flex-col gap-3">
                <Button
                  className="w-full"
                  variant="white"
                  onClick={() => {
                    setIsOpen(false);
                    handleComingSoonClick();
                  }}
                >
                  Coming soon
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

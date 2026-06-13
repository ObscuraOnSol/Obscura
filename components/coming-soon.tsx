"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Clock, ArrowUpRight } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pre-launch "coming soon" gate. Any control that would normally enter the app
 * opens this modal instead. Wrap the page in <ComingSoonProvider> and use
 * <ComingSoonButton> / <ComingSoonLink> (or useComingSoon()) for triggers.
 */
const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useComingSoon = () => useContext(Ctx);

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <AnimatePresence>
        {isOpen && <Modal onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function Modal({ onClose }: { onClose: () => void }) {
  const socials: [string, string][] = [
    ["Telegram", "https://t.me/obscurasol"],
    ["X (Twitter)", "https://x.com/obscurasol"],
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 24, stiffness: 240 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-2xl"
      >
        <div className="pointer-events-none absolute inset-0 aperture-glow opacity-60" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">Launching soon</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The Obscura dark pool isn&apos;t live yet. Commit-reveal orders, the
            marketplace, and the agent API all open at launch. Follow along so
            you don&apos;t miss it.
          </p>

          <div className="mt-6 flex justify-center">
            <CABadge />
          </div>

          <div className="mt-7 flex justify-center gap-3">
            {socials.map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/60 px-4 py-2 text-sm transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {label}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ComingSoonButton({
  children,
  ...props
}: Omit<ButtonProps, "onClick" | "asChild">) {
  const { open } = useComingSoon();
  return (
    <Button onClick={open} {...props}>
      {children}
    </Button>
  );
}

export function ComingSoonLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open } = useComingSoon();
  return (
    <button onClick={open} className={cn("text-left", className)}>
      {children}
    </button>
  );
}

/** Static "CA: Coming Soon" badge (contract address placeholder). */
export function CABadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "data inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs text-primary",
        className,
      )}
    >
      <span className="uppercase tracking-[0.2em] opacity-70">CA</span>
      <span className="h-3 w-px bg-primary/30" />
      Coming Soon
    </span>
  );
}

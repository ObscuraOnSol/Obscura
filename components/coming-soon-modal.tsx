"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Lock, ExternalLink } from "lucide-react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComingSoonModal({ isOpen, onClose }: ComingSoonModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-md relative text-center"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary mb-4 animate-pulse">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Launch Coming Soon</h3>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Obscura&apos;s private compute pool and dark-market matches are currently undergoing final audits and Devnet deployment. Join our community to be notified when the mainnet application goes live.
              </p>

              <div className="mt-6 flex flex-col gap-2 w-full">
                <a
                  href="https://x.com/obscuraonsol?s=21"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/50 py-2.5 text-xs font-medium text-foreground hover:bg-white/5 transition-colors"
                >
                  Follow on X (Twitter)
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
                <a
                  href="https://t.me/obscurasolana"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/50 py-2.5 text-xs font-medium text-foreground hover:bg-white/5 transition-colors"
                >
                  Join Telegram Channel
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

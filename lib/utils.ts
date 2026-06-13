import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a USD/hr compute price as a terminal-grade monospace readout. */
export function fmtUsdHr(value: number): string {
  return `$${value.toFixed(4)}/hr`;
}

/** Compact relative time, e.g. "3m ago", "2h ago". */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  const secs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Short-form Solana address / hash for order readouts. */
export function shortHash(hash: string | null | undefined, lead = 6, tail = 4): string {
  if (!hash) return "-";
  if (hash.length <= lead + tail) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

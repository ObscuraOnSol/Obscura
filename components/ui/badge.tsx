import { cn } from "@/lib/utils";

const PHASE_STYLES: Record<string, string> = {
  committed: "border-muted-foreground/30 text-muted-foreground",
  revealed: "border-primary/40 text-primary",
  matched: "border-primary/60 text-primary bg-primary/10",
  settled: "border-foreground/40 text-foreground bg-foreground/5",
  cancelled: "border-destructive/40 text-destructive",
};

export function PhaseBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "data inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        PHASE_STYLES[status] ?? "border-border text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

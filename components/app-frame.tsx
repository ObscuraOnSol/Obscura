import Link from "next/link";
import {
  LayoutDashboard,
  ScrollText,
  Store,
  Activity,
  Bot,
  Settings,
} from "lucide-react";

import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative flex">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card/30 p-4 md:flex">
          <Link href="/" className="px-2 py-3">
            <Wordmark className="[&_span]:text-base" />
          </Link>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV.map((item) => {
              const on = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
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
          <div className="mt-auto rounded-md border border-border bg-background/60 p-3">
            <div className="data text-[11px] uppercase tracking-widest text-muted-foreground">
              Session
            </div>
            <div className="data mt-1 text-xs text-foreground">
              not connected
            </div>
            <Button size="sm" className="mt-3 w-full">
              Sign in with Solana
            </Button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/70 px-6 backdrop-blur-md">
            <h1 className="text-xl font-bold tracking-tight">
              {title}
            </h1>
            <span className="pill">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Devnet
            </span>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
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

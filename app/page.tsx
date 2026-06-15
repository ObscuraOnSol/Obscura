"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Unlock,
  Boxes,
  Coins,
  ShieldCheck,
  Bot,
  Activity,
  EyeOff,
  ExternalLink,
  Flame,
  TrendingUp,
  Zap,
  Cpu,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { ClickEffects } from "@/components/click-effects";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
  HeroStagger,
  HeroItem,
  ParallaxText,
} from "@/components/motion";
import { TextScramble } from "@/components/text-scramble";
import { BlurTextCycle } from "@/components/blur-text-cycle";
import { ComingSoonModal } from "@/components/coming-soon-modal";
import { ReelAnimation } from "@/components/reel-animation";
import { cn, fmtUsdHr } from "@/lib/utils";

/* ---------- Data ---------- */

const CLEARING = [
  { gpu: "H100 80GB", price: 1.8642, delta: -3.1 },
  { gpu: "A100 80GB", price: 0.9421, delta: -1.4 },
  { gpu: "RTX 4090", price: 0.3187, delta: +2.2 },
  { gpu: "L40S", price: 0.6755, delta: -0.6 },
];

const PHASES = [
  { key: "COMMIT", label: "Committed", note: "Order hashed client-side, nothing visible on-chain.", icon: Lock },
  { key: "REVEAL", label: "Revealed", note: "Price and quantity enter the next batch auction.", icon: Unlock },
  { key: "MATCH", label: "Matched", note: "ZK-verified batch auction clears in ~45 seconds.", icon: Boxes },
  { key: "SETTLE", label: "Settled", note: "USDC released from escrow to counterparties.", icon: Coins },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Commit-reveal orders",
    body: "Orders are hashed before submission. Size, price, and timing never hit the public mempool, preventing front-running of your compute buys.",
  },
  {
    icon: Boxes,
    title: "ZK-matched batch auctions",
    body: "A scheduled ~45s batch auction clears a single price. Matching happens under proof; order details are never exposed during matching.",
  },
  {
    icon: ShieldCheck,
    title: "Screened settlement",
    body: "Every external exit carries a clean-provenance association-set proof. Privacy without naked wallet layering; a microstructure tool, not an obfuscator.",
  },
  {
    icon: Bot,
    title: "Agent-native API",
    body: "Token-gated programmatic access via SAS passports. Agents submit, list, and cancel orders with an X-API-Key. No KYC; wallet is identity.",
  },
];

const FOOTER_LINKS = {
  product: [
    ["Marketplace", "/marketplace"],
    ["Orders", "/orders"],
    ["Dashboard", "/dashboard"],
    ["Agent API", "/agent"],
  ],
  community: [
    ["Telegram", "https://t.me/obscurasolana", true],
    ["X (Twitter)", "https://x.com/obscuraonsol?s=21", true],
    ["GitHub", "https://github.com/ObscuraOnSol", true],
  ],
  resources: [
    ["Whitepaper", "/whitepaper", false],
    ["Roadmap", "/roadmap", false],
    ["Documentation", "/docs", false],
  ],
} as const;

/* ---------- Page ---------- */

export default function Home() {
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const isComingSoon = process.env.NEXT_PUBLIC_IS_COMING_SOON === "true" || process.env.IS_COMING_SOON === "true";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("comingsoon") === "true") {
        setIsComingSoonOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    const isAppPage = ["/dashboard", "/marketplace", "/orders", "/agent"].some(
      (path) => href === path || href.startsWith(path + "/")
    );
    if (isComingSoon && isAppPage) {
      e.preventDefault();
      setIsComingSoonOpen(true);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <ClickEffects />
      {/* Hero background image covering header + hero */}
      <div className="absolute left-0 right-0 top-0 h-[800px] overflow-hidden pointer-events-none z-0">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/65 to-background" />
      </div>

      <div className="relative z-10">
        <SiteHeader />
        <Hero isComingSoon={isComingSoon} onLinkClick={handleLinkClick} />
        <Ticker />
        <PhaseStrip />
        <ClearingPrices />
        <Features />
        <PrivacyShowcase />
        <Flywheel />
        <BrandBand />
        <CTA isComingSoon={isComingSoon} onLinkClick={handleLinkClick} />
        <SiteFooter isComingSoon={isComingSoon} onLinkClick={handleLinkClick} />
      </div>

      <ComingSoonModal isOpen={isComingSoonOpen} onClose={() => setIsComingSoonOpen(false)} />
    </div>
  );
}



/* ---------- Hero ---------- */

interface ComingSoonProps {
  isComingSoon: boolean;
  onLinkClick: (e: React.MouseEvent, href: string) => void;
}

function Hero({ isComingSoon, onLinkClick }: ComingSoonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText("63pWiBNCEW4RkYTDBG9dcabzdiHdVZMHnauKGhcWpump");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="container relative flex flex-col items-center pb-24 pt-28 text-center md:pt-36">
        <HeroStagger className="flex flex-col items-center">
          <HeroItem>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <div 
                onClick={handleCopy}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-3.5 py-1 text-xs font-mono text-primary transition-colors hover:bg-primary/10 select-none"
                title="Click to copy CA"
              >
                <span className="h-1.5 w-1.5 rounded bg-primary" />
                {copied ? "Copied!" : "CA: 63pWiBNCEW4RkYTDBG9dcabzdiHdVZMHnauKGhcWpump"}
              </div>
              <a 
                href="https://dexscreener.com/solana/63pWiBNCEW4RkYTDBG9dcabzdiHdVZMHnauKGhcWpump" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                view on DEXScreener <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </HeroItem>

          <HeroItem>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Compute
              <br />
              <BlurTextCycle
                texts={[
                  "in the dark.",
                  "in private.",
                  "in the shadows.",
                  "in the umbra.",
                  "in the shade."
                ]}
                className="text-foreground"
              />
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mt-7 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
              A dark pool for GPU compute on Solana. Encrypted order books,
              commit-reveal submission, ZK-matched batch auctions, USDC-settled.
              No&nbsp;one sees what you buy, what you pay, or when.
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/dashboard" onClick={(e) => onLinkClick(e, "/dashboard")}>
                <Button size="lg" variant="white">
                  {isComingSoon ? "Coming soon" : "Launch app"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/marketplace" onClick={(e) => onLinkClick(e, "/marketplace")}>
                <Button size="lg" variant="outline">
                  {isComingSoon ? "Coming soon" : "View live prices"}
                </Button>
              </Link>
            </div>
          </HeroItem>

          <HeroItem>
            <p className="data mt-8 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
              No wallet required to browse ·
              <Image
                src="/usdc_logo.png"
                alt="USDC"
                width={14}
                height={14}
                className="inline-block rounded-full"
              />
              USDC-settled from day one
            </p>
          </HeroItem>
        </HeroStagger>
      </div>
    </section>
  );
}

/* ---------- Ticker ---------- */

function Ticker() {
  const [prices, setPrices] = useState(
    CLEARING.map((c) => ({
      gpu: c.gpu,
      price: c.price,
      delta: c.delta,
      basePrice: c.price,
    }))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      // Pick a random GPU to update
      const randomIndex = Math.floor(Math.random() * CLEARING.length);
      setPrices((prev) =>
        prev.map((item, idx) => {
          if (idx === randomIndex) {
            const randomFactor = Math.random() * 0.5 - 0.25; // -25% to +25%
            const newPrice = item.basePrice * (1 + randomFactor);
            const newDelta = randomFactor * 100;
            return {
              ...item,
              price: newPrice,
              delta: newDelta,
            };
          }
          return item;
        })
      );
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  const row = [...prices, ...prices, ...prices, ...prices];

  return (
    <div className="border-y border-border/60 bg-card/30 overflow-hidden">
      <div className="flex animate-marquee items-center gap-10 whitespace-nowrap py-3">
        {row.map((item, i) => {
          const deltaText = `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)}%`;

          return (
            <span key={i} className="data inline-flex items-center gap-3 text-xs text-muted-foreground">
              {i % CLEARING.length === 0 && (
                <span className="data flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-primary">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Live
                </span>
              )}
              
              {/* GPU Logo */}
              <span className="inline-flex items-center text-primary/70 shrink-0">
                <Cpu className="h-3.5 w-3.5" />
              </span>

              <span className="text-foreground font-semibold">{item.gpu}</span>

              {/* USDC Logo & Price */}
              <span className="inline-flex items-center gap-1">
                <Image
                  src="/usdc_logo.png"
                  alt="USDC"
                  width={14}
                  height={14}
                  className="rounded-full shrink-0"
                />
                <span className="inline-flex items-baseline gap-0.5">
                  <TextScramble text={item.price.toFixed(4)} duration={400} delay={0} className="font-mono text-foreground font-bold" />
                  <span className="font-mono text-muted-foreground/60 text-[10px]">/hr</span>
                </span>
              </span>

              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-0.5 rounded-sm shrink-0",
                  item.delta < 0
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-destructive bg-destructive/10 border border-destructive/20"
                )}
              >
                <TextScramble text={deltaText} duration={400} delay={0} />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Phase Strip ---------- */

function PhaseStrip() {
  return (
    <section className="container py-24">
      <FadeIn>
        <SectionHeading
          eyebrow="The order lifecycle"
          title="Every order makes its phase explicit"
          sub="The UI always shows whether an order is committed, revealed, matched, or settled, so you know exactly what is, and isn't, yet public."
        />
      </FadeIn>
      <StaggerContainer className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
        {PHASES.map((p, i) => (
          <StaggerItem key={p.key}>
            <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/30">
              {/* Background icon watermark: tilted, scale-up, and green-tinted on hover */}
              <div className="absolute -bottom-5 -right-5 pointer-events-none opacity-[0.06] text-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] group-hover:opacity-[0.12] ease-out shrink-0">
                <p.icon className="h-24 w-24 rotate-[-12deg]" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="data text-[11px] uppercase tracking-[0.2em] text-primary">
                    0{i + 1} / {p.key}
                  </div>
                  <p.icon className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                </div>
                <div className="mt-4 text-xl font-semibold">{p.label}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.note}</p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
      <FadeIn delay={0.2}>
        <div className="mt-6">
          <Frame
            src="/photo_2026-06-13_18-00-11.jpg"
            alt="Obscura order lifecycle (commit, reveal, match, settle)"
          />
        </div>
      </FadeIn>
    </section>
  );
}

/* ---------- Clearing Prices ---------- */

function ClearingPrices() {
  return (
    <section className="container py-24">
      <FadeIn>
        <SectionHeading
          eyebrow="Clearing prices"
          title="Monospace price feed"
          sub="A clearing-price oracle for H100, A100, RTX 4090 and newer parts, featuring peer-to-peer auction pricing, materially cheaper than hyperscalers."
        />
      </FadeIn>
      <StaggerContainer className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.06}>
        {CLEARING.map((c) => (
          <StaggerItem key={c.gpu}>
            <div className="bg-card p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.gpu}
              </div>
              <div className="data mt-3 text-3xl font-bold text-foreground">
                {fmtUsdHr(c.price)}
              </div>
              <div
                className={cn(
                  "data mt-1.5 text-sm",
                  c.delta < 0 ? "text-primary" : "text-destructive",
                )}
              >
                {c.delta > 0 ? "▲" : "▼"} {Math.abs(c.delta)}% · 24h
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
      <FadeIn delay={0.2}>
        <div className="mt-10">
          <Frame
            src="/photo_2026-06-13_18-00-05.jpg"
            alt="Obscura live clearing prices market feed"
          />
        </div>
      </FadeIn>
    </section>
  );
}

/* ---------- Features ---------- */

function Features() {
  return (
    <section className="container py-24">
      <FadeIn>
        <SectionHeading
          eyebrow="Privacy Showcase"
          title="Compute in the dark"
          sub="Fully on-chain, privacy-preserving by default, AI-agent-native. The legitimate market-microstructure approach, not an obfuscation service."
        />
      </FadeIn>
      <StaggerContainer className="mt-14 grid gap-4 md:grid-cols-2" staggerDelay={0.1}>
        {FEATURES.map((f) => (
          <StaggerItem key={f.title}>
            <div className="group flex h-full gap-5 rounded-xl border border-border bg-card/40 p-6 transition-all hover:border-primary/30 hover:bg-card/60">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary transition-colors group-hover:bg-primary/10">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}

/* ---------- Flywheel ---------- */

function Flywheel() {
  const steps = [
    { text: "Protocol earns fees", icon: Coins },
    { text: "Buys back & burns $OBSCURA", icon: Flame },
    { text: "Pays USDC yield to stakers", icon: TrendingUp },
    { text: "Node operators lock $OBSCURA", icon: ShieldCheck },
    { text: "Agents auto-buy for API access", icon: Bot },
    { text: "More compute → more fees", icon: Zap },
  ];
  return (
    <section className="container py-24">
      <ScaleIn>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="grid-hairlines p-8 md:p-12">
            <SectionHeading
              eyebrow="$OBSCURA token"
              title="A flywheel, not a faucet"
              sub="20% of protocol fees buy back and burn $OBSCURA. Stakers earn real USDC yield. Node operators stake as collateral, slashable for dishonesty."
              align="left"
            />
            <StaggerContainer className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.06}>
              {steps.map((s, i) => (
                <StaggerItem key={s.text}>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-4 py-3 transition-colors hover:border-primary/20">
                    <span className="data text-xs text-primary/60">0{i + 1}</span>
                    <s.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{s.text}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </ScaleIn>
    </section>
  );
}

/* ---------- CTA ---------- */

function CTA({ isComingSoon, onLinkClick }: ComingSoonProps) {
  return (
    <section className="container py-24">
      <ScaleIn>
        <div className="relative overflow-hidden rounded-2xl">
          {/* CTA background image */}
          <div className="absolute inset-0">
            <Image
              src="/cta-bg.jpg"
              alt=""
              fill
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-background/60" />
          </div>
          <div className="relative px-8 py-20 text-center md:py-24">
            <FadeIn>
              <EyeOff className="mx-auto h-8 w-8 text-primary" />
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
                Buy compute. <span className="text-muted-foreground">Leave no trace.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mx-auto mt-5 max-w-md text-muted-foreground">
                Sign in with Solana, commit your first order, and watch it clear in
                the next batch.
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="mt-8 flex justify-center">
                <Link href="/dashboard" onClick={(e) => onLinkClick(e, "/dashboard")}>
                  <Button size="lg" variant="white">
                    {isComingSoon ? "Coming soon" : "Launch app"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </ScaleIn>
    </section>
  );
}

/* ---------- Footer ---------- */

function SiteFooter({ isComingSoon, onLinkClick }: ComingSoonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText("63pWiBNCEW4RkYTDBG9dcabzdiHdVZMHnauKGhcWpump");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="relative overflow-hidden border-t border-border">
      {/* Giant OBSCURA background text */}
      <ParallaxText
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
      >
        <span
          className="whitespace-nowrap text-[12rem] font-bold uppercase leading-none tracking-tight text-foreground/[0.03] sm:text-[16rem] md:text-[20rem] lg:text-[26rem]"
          aria-hidden="true"
        >
          OBSCURA
        </span>
      </ParallaxText>

      <div className="container relative py-16 md:py-20">
        <StaggerContainer className="grid gap-12 md:grid-cols-12" staggerDelay={0.08}>
          {/* Brand column */}
          <StaggerItem className="md:col-span-4">
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A dark pool for GPU compute on Solana. Encrypted order books,
              batch auctions, USDC-settled.
            </p>
          </StaggerItem>

          {/* Product links */}
          <StaggerItem className="md:col-span-2">
            <h4 className="data text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Product
            </h4>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.product.map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    onClick={(e) => onLinkClick(e, href)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </StaggerItem>

          {/* Community links */}
          <StaggerItem className="md:col-span-3">
            <h4 className="data text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Community
            </h4>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.community.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                    <ExternalLink className="h-3 w-3 opacity-40" />
                  </a>
                </li>
              ))}
            </ul>
          </StaggerItem>

          {/* Resources links */}
          <StaggerItem className="md:col-span-3">
            <h4 className="data text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Resources
            </h4>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.resources.map(([label, href, isExternal]) => (
                <li key={label}>
                  {isExternal ? (
                    <a
                      href={href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3 opacity-40" />
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </StaggerItem>
        </StaggerContainer>

        {/* Bottom bar */}
        <FadeIn delay={0.4}>
          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
            <p className="data text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} Obscura. Compute in the dark.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span 
                onClick={handleCopy}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-mono text-primary transition-colors hover:bg-primary/10 select-none"
                title="Click to copy CA"
              >
                <span className="h-1.5 w-1.5 rounded bg-primary" />
                {copied ? "Copied!" : "CA: 63pWiBNC...Wpump"}
              </span>
              <a 
                href="https://dexscreener.com/solana/63pWiBNCEW4RkYTDBG9dcabzdiHdVZMHnauKGhcWpump" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                view on DEXScreener <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
            <p className="data text-xs text-muted-foreground/40">
              Pseudonymous · No KYC · USDC-settled
            </p>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}

/* ---------- Graphic frame ---------- */

function Frame({
  src,
  alt,
  ratio = "aspect-[16/9]",
}: {
  src: string;
  alt: string;
  ratio?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/40",
        ratio,
      )}
    >
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      {/* aperture corner ticks, the green flick */}
      <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-primary/40" />
      <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-primary/40" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b border-l border-primary/40" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-primary/40" />
    </div>
  );
}

/* ---------- Privacy showcase ---------- */

function PrivacyShowcase() {
  return (
    <section className="container py-24">
      <FadeIn>
        <SectionHeading
          eyebrow="Private by default"
          title="Five layers of privacy, one clean exit"
          sub="Order intent, size, and timing stay hidden through matching; settlement is screened so every external exit carries a clean-provenance proof."
        />
      </FadeIn>
      <StaggerContainer
        className="mt-14 grid gap-4 md:grid-cols-2"
        staggerDelay={0.12}
      >
        <StaggerItem>
          <Frame
            src="/photo_2026-06-13_18-00-10.jpg"
            alt="Obscura privacy architecture, private by default"
            ratio="aspect-square"
          />
        </StaggerItem>
        <StaggerItem>
          <Frame
            src="/photo_2026-06-13_18-00-13.jpg"
            alt="Obscura private GPU market"
            ratio="aspect-square"
          />
        </StaggerItem>
      </StaggerContainer>
    </section>
  );
}

/* ---------- Brand band ---------- */

function BrandBand() {
  return (
    <section className="container py-12">
      <ScaleIn>
        <Frame
          src="/photo_2026-06-13_18-00-14.jpg"
          alt="Obscura compute in the dark"
          ratio="aspect-[21/9]"
        />
      </ScaleIn>
    </section>
  );
}

/* ---------- Section Heading ---------- */

function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      <div className="data text-[11px] uppercase tracking-[0.22em] text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-muted-foreground">{sub}</p>
    </div>
  );
}

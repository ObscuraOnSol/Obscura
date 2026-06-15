"use client";

import React, { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, BookOpen, Terminal, Shield, Sparkles, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClickEffects } from "@/components/click-effects";
import { SiteHeader } from "@/components/site-header";

const DOCS_CONTENT = `# OBSCURA Protocol & Developer Documentation

## 1. What is Obscura?
Obscura is a decentralized, privacy-preserving dark pool for GPU and AI compute resources built on Solana.
In traditional compute marketplaces, order details are public, exposing training durations, model choices, and pricing to competitors. Obscura hides these details using a commit-reveal mechanism and zero-knowledge proofs (zk-SNARKs). Matches clear in scheduled 45-second batch auctions at a single market-clearing price, preventing front-running and timing analysis.

---

## 2. How to Use Obscura

### 2.1 For Compute Buyers
1. Commit: Generate a cryptographic hash of your compute requirement (GPU model, max price, quantity, lease duration) combined with a local random salt. Submit only the hash to the Solana contract and deposit the maximum lease cost into escrow.
2. Reveal: During the match window, reveal the order parameters and salt. The contract verifies the parameters match your committed hash.
3. Lease: If matched, compute access is allocated to your public key. If unmatched, the escrowed USDC is refunded.

### 2.2 For Compute Providers
1. Register: Register your hardware specs via the developer portal or the CLI.
2. Stake Collateral: Lock up a minimum threshold of $OBSC tokens as collateral. This stake is slashable in the event of hardware failures or dishonest match reporting.
3. Host: Run the Obscura host daemon to accept containerized AI workloads matched by the pool.

---

## 3. Using Obscura via the UI

Obscura is designed to be fully usable from the web interface for standard users.

### 3.1 Order Lifecycle on the UI
1. **GPU Selection:** Browse active hardware configurations on the **Marketplace**. Note that hardware marked as **Allocated** is currently in use; placing an order on allocated hardware may cause your order to be held in the "reveal" status until the node is released.
2. **Commit Order:** Fill in the lease duration (in hours). Click **Commit Order** to sign a cryptographic commitment hash and secure the estimated USDC rental cost in the escrow contract.
3. **Reveal Bid:** Once the commitment is recorded, click **Reveal Order** to submit your bid parameters to the upcoming batch auction.
4. **Settle & Lease:** If matched, sign the settlement transaction to claim your lease. Click **Connect** to open the secure web terminal or retrieve SSH credentials.

### 3.2 Programmatic & AI Agent Access
For autonomous AI agents, programmatic integrations, or developer credentials, go to the **[Agent Mode](/agent)** dashboard page to retrieve your API keys and read the AI Agent Starter Prompt.

---

## 4. Real-World Use Cases

1. Proprietary Model Training:
   Enterprises training proprietary models can lease clusters of H100s privately, ensuring competitors cannot monitor their training timelines, model scales, or cluster locations.
2. Autonomous Agent Compute Swarms:
   AI agents acting as independent economic entities can dynamically lease GPUs on-demand to run inference, paying autonomously in USDC.
3. Cost-Optimized Batch Inferences:
   Compute buyers with latency-insensitive workloads can submit orders into the 45-second batch auctions, matching against excess provider capacity at discounts of up to 40% compared to on-demand retail clouds.

---

## 5. Open Source & Contribution Guidelines
Obscura is built on the belief that decentralized infrastructure must be transparent, verifiable, and open.

### 5.1 Repository License
All core Obscura codebases (including the commitment contract, zk-SNARK matching circuits, CLI client, and SDKs) are open-source under the MIT License.

### 5.2 How to Contribute
We welcome contributions from developers, researchers, and node operators:
- Bug Reporting: Report security vulnerabilities directly to obscurasol@outlook.com. Report generic bugs via GitHub Issues.
- Pull Requests: Submit PRs to the respective repos. Ensure all code passes formatting checks and unit tests.
- Matching Circuits: Cryptographers can contribute enhancements to the matching constraints located in the contracts/circuits folder.
`;

const NAV_ITEMS = [
  { id: "what-is-obscura", title: "What is Obscura?", icon: BookOpen },
  { id: "how-to-use", title: "How to Use", icon: Terminal },
  { id: "using-the-web-ui", title: "Using the Web UI", icon: Terminal },
  { id: "use-cases", title: "Real-World Use Cases", icon: Sparkles },
  { id: "open-source", title: "Open Source", icon: Shield }
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("what-is-obscura");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const downloadFile = useCallback((format: "md" | "txt") => {
    const filename = `obscura-docs.${format}`;
    const contentType = format === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([DOCS_CONTENT], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-x-clip text-foreground scroll-smooth">
      <ClickEffects />
      
      {/* Glow Header Background */}
      <div className="absolute left-0 right-0 top-0 h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteHeader />

        <main className="flex-1 container max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
          {/* Back Navigation */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </Link>

          {/* Action Header Card */}
          <div className="rounded-xl border border-border bg-card/40 p-6 backdrop-blur-sm mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="data text-[11px] uppercase tracking-[0.2em] text-primary">
                Developer Documentation
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-1">Obscura Docs</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Integrate private GPU compute, execute API orders, and contribute to the protocol.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile("md")}
                className="gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download .MD
              </Button>
              <Button
                variant="white"
                size="sm"
                onClick={() => downloadFile("txt")}
                className="gap-2"
              >
                <FileText className="h-3.5 w-3.5" />
                Download .TXT
              </Button>
            </div>
          </div>

          {/* Mintlify-like Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10 items-start">
            
            {/* Left Sidebar Table of Contents */}
            <aside className="sticky top-24 hidden md:block border-r border-border/30 pr-6 space-y-2">
              <div className="data text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50 font-bold mb-4 px-3">
                Navigation
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.title}
                    </a>
                  );
                })}
              </nav>
            </aside>

            {/* Middle Main Content */}
            <div className="space-y-12 pb-24 text-muted-foreground">
              
              {/* Section 1: What is Obscura? */}
              <section id="what-is-obscura" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">1. What is Obscura?</h2>
                </div>
                <p className="leading-relaxed">
                  Obscura is a decentralized, privacy-preserving dark pool for GPU and AI compute resources built on Solana.
                </p>
                <p className="leading-relaxed">
                  In traditional compute marketplaces, order details are public, exposing training durations, model choices, and pricing to competitors. Obscura hides these details using a commit-reveal mechanism and zero-knowledge proofs (zk-SNARKs). Matches clear in scheduled 45-second batch auctions at a single market-clearing price, preventing front-running and timing analysis.
                </p>
              </section>

              {/* Section 2: How to Use Obscura */}
              <section id="how-to-use" className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <Terminal className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">2. How to Use Obscura</h2>
                </div>
                
                <div>
                  <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-2">2.1 For Compute Buyers</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
                    <li>
                      <strong className="text-foreground">Commit:</strong> Generate a cryptographic hash of your compute requirement (GPU model, max price, quantity, lease duration) combined with a local random salt. Submit only the hash to the Solana contract and deposit the maximum lease cost into escrow.
                    </li>
                    <li>
                      <strong className="text-foreground">Reveal:</strong> During the match window, reveal the order parameters and salt. The contract verifies the parameters match your committed hash.
                    </li>
                    <li>
                      <strong className="text-foreground">Lease:</strong> If matched, compute access is allocated to your public key. If unmatched, the escrowed USDC is refunded.
                    </li>
                  </ol>
                </div>

                <div className="border-t border-border/20 pt-4">
                  <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-2">2.2 For Compute Providers</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
                    <li>
                      <strong className="text-foreground">Register:</strong> Register your hardware specs via the developer portal or the CLI.
                    </li>
                    <li>
                      <strong className="text-foreground">Stake Collateral:</strong> Lock up a minimum threshold of $OBSC tokens as collateral. This stake is slashable in the event of hardware failures or dishonest match reporting.
                    </li>
                    <li>
                      <strong className="text-foreground">Host:</strong> Run the Obscura host daemon to accept containerized AI workloads matched by the pool.
                    </li>
                  </ol>
                </div>
              </section>

              {/* Section 3: Using Obscura via UI */}
              <section id="using-the-web-ui" className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <Terminal className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">3. Using Obscura via the UI</h2>
                </div>

                <div className="space-y-6">
                  <p className="leading-relaxed">
                    Obscura is designed to be fully usable from the web interface for standard users. Below is the step-by-step workflow:
                  </p>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border bg-card/25 space-y-2">
                      <strong className="text-foreground block text-sm">🖥️ 3.1 Order Lifecycle on the UI</strong>
                      <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
                        <li>
                          <strong className="text-foreground">GPU Selection:</strong> Browse active hardware configurations on the Marketplace. Note that hardware marked as <span className="text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-xs">Allocated</span> is currently in use; placing an order on allocated hardware may cause your order to be held in the &quot;reveal&quot; status until the node is released.
                        </li>
                        <li>
                          <strong className="text-foreground">Commit Order:</strong> Fill in the lease duration (in hours). Click **Commit Order** to sign a cryptographic commitment hash and secure the estimated USDC rental cost in the escrow contract.
                        </li>
                        <li>
                          <strong className="text-foreground">Reveal Bid:</strong> Once the commitment is recorded, click **Reveal Order** to submit your bid parameters to the upcoming batch auction.
                        </li>
                        <li>
                          <strong className="text-foreground">Settle &amp; Lease:</strong> If matched, sign the settlement transaction to claim your lease. Click **Connect** to open the secure web terminal or retrieve SSH credentials.
                        </li>
                      </ol>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card/25 space-y-2">
                      <strong className="text-foreground block text-sm">🤖 3.2 Programmatic &amp; AI Agent Access</strong>
                      <p className="text-sm leading-relaxed">
                        If you are building autonomous AI agents or integrating programmatically via the developer gateway, you should use the dedicated API tools and keys.
                      </p>
                      <p className="text-sm leading-relaxed mt-2">
                        Please go to the <Link href="/agent" className="text-primary hover:underline font-semibold inline-flex items-center gap-1">Agent Mode Console</Link> page to generate API credentials, manage rolling spend caps, and review the detailed AI Agent Starter System Prompt.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Real-World Use Cases */}
              <section id="use-cases" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">4. Real-World Use Cases</h2>
                </div>
                <div className="space-y-4">
                  <ul className="space-y-4 text-sm">
                    <li className="p-4 rounded-lg border border-border bg-card/25">
                      <strong className="text-foreground block mb-1">💼 Proprietary Model Training</strong>
                      Enterprises training proprietary models can lease clusters of H100s privately, ensuring competitors cannot monitor their training timelines, model scales, or cluster locations.
                    </li>
                    <li className="p-4 rounded-lg border border-border bg-card/25">
                      <strong className="text-foreground block mb-1">🤖 Autonomous Agent Compute Swarms</strong>
                      AI agents acting as independent economic entities can dynamically lease GPUs on-demand to run inference, paying autonomously in USDC without credit card locks.
                    </li>
                    <li className="p-4 rounded-lg border border-border bg-card/25">
                      <strong className="text-foreground block mb-1">⚡ Cost-Optimized Batch Inferences</strong>
                      Compute buyers with latency-insensitive workloads can submit orders into the 45-second batch auctions, matching against excess provider capacity at discounts of up to 40% compared to retail clouds.
                    </li>
                  </ul>
                </div>
              </section>

              {/* Section 5: Open Source & Contributions */}
              <section id="open-source" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">5. Open Source & Contributions</h2>
                </div>
                <div className="space-y-4">
                  <p className="leading-relaxed">
                    Obscura is built on the belief that decentralized infrastructure must be transparent, verifiable, and open.
                  </p>
                  
                  <div className="border-t border-border/20 pt-4">
                    <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-2">5.1 Repository License</h3>
                    <p className="text-sm">
                      All core Obscura codebases (including the commitment contract, zk-SNARK matching circuits, CLI client, and SDKs) are open-source under the <strong className="text-foreground">MIT License</strong>.
                    </p>
                  </div>

                  <div className="border-t border-border/20 pt-4">
                    <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-2">5.2 How to Contribute</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                      <li>
                        <strong className="text-foreground">Bug Reporting:</strong> Report security vulnerabilities directly to <code className="text-primary bg-primary/5 px-1 py-0.5 rounded font-mono">obscurasol@outlook.com</code>. Report generic bugs via GitHub Issues.
                      </li>
                      <li>
                        <strong className="text-foreground">Pull Requests:</strong> Submit PRs to the respective repos. Ensure all code passes formatting checks and unit tests.
                      </li>
                      <li>
                        <strong className="text-foreground">Matching Circuits:</strong> Cryptographers can contribute enhancements to the matching constraints located in the <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">contracts/circuits</code> folder.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

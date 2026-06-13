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

## 3. Using Obscura via API

### 3.1 Authentication
All programmatic requests to the Obscura API gateway require an API key passed in the headers. You can generate an API key on the Settings tab of your dashboard.
Header Format:
\`\`\`http
X-API-Key: obsc_live_...
\`\`\`

### 3.2 Endpoint: Commit Order
Submit a cryptographic commitment hash for a compute purchase.
- Method: POST
- Path: /api/v1/orders/commit
- Request Body:
\`\`\`json
{
  "gpuType": "H100 80GB",
  "commitHash": "a1b2c3d4e5f6..."
}
\`\`\`
- Response:
\`\`\`json
{
  "orderId": "8f3b9c2a-7d1e-4f5b-8c6a-9b8c7d6e5f4a",
  "status": "committed",
  "createdAt": "2026-06-13T19:45:00Z"
}
\`\`\`

### 3.3 Endpoint: Reveal Order
Reveal the cleartext parameters and salt to enter the matching batch.
- Method: POST
- Path: /api/v1/orders/reveal
- Request Body:
\`\`\`json
{
  "orderId": "8f3b9c2a-7d1e-4f5b-8c6a-9b8c7d6e5f4a",
  "priceMicro": 1860000,
  "qty": 4,
  "secret": "32-byte-hex-secret-salt"
}
\`\`\`
- Response:
\`\`\`json
{
  "orderId": "8f3b9c2a-7d1e-4f5b-8c6a-9b8c7d6e5f4a",
  "status": "revealed"
}
\`\`\`

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
  { id: "api-reference", title: "API Reference", icon: Terminal },
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

              {/* Section 3: Using Obscura via API */}
              <section id="api-reference" className="scroll-mt-24 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                  <Terminal className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">3. Using Obscura via API</h2>
                </div>

                <div className="space-y-4">
                  <p className="leading-relaxed">
                    Developers and AI agents can interact with Obscura programmatically using standard HTTP JSON payloads.
                  </p>
                  
                  {/* Auth details */}
                  <div>
                    <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-2">3.1 Authentication</h3>
                    <p className="text-sm mb-3">All API requests must include your client API key in the request headers:</p>
                    <div className="relative rounded-lg border border-border bg-card/60 p-4 font-mono text-xs text-foreground flex justify-between items-center">
                      <span>X-API-Key: obsc_live_8f3b9c2a7d1e4f5b8c6a9b8c</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy("X-API-Key: obsc_live_8f3b9c2a7d1e4f5b8c6a9b8c", "auth")}
                        className="h-8 w-8 p-0 hover:bg-card"
                      >
                        {copiedId === "auth" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Endpoint: Commit */}
                  <div className="border-t border-border/20 pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">POST</span>
                      <span className="font-mono text-foreground text-sm">/api/v1/orders/commit</span>
                    </div>
                    <p className="text-sm">Submit your cryptographic commitment hash and lock compute value in escrow.</p>
                    <div className="relative rounded-lg border border-border bg-card/60 p-4 font-mono text-xs text-foreground flex justify-between items-start">
                      <pre className="overflow-x-auto pr-8">
{`{
  "gpuType": "H100 80GB",
  "commitHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}`}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(`{\n  "gpuType": "H100 80GB",\n  "commitHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"\n}`, "commit")}
                        className="h-8 w-8 p-0 hover:bg-card shrink-0"
                      >
                        {copiedId === "commit" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Endpoint: Reveal */}
                  <div className="border-t border-border/20 pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">POST</span>
                      <span className="font-mono text-foreground text-sm">/api/v1/orders/reveal</span>
                    </div>
                    <p className="text-sm">Submit the cleartext parameters and salt preimage once the reveal window opens.</p>
                    <div className="relative rounded-lg border border-border bg-card/60 p-4 font-mono text-xs text-foreground flex justify-between items-start">
                      <pre className="overflow-x-auto pr-8">
{`{
  "orderId": "8f3b9c2a-7d1e-4f5b-8c6a-9b8c7d6e5f4a",
  "priceMicro": 1860000,
  "qty": 4,
  "secret": "98939e45dd1932a6a5739912cbf71553b798926fcb7d816a0bab13c67fe87e69"
}`}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(`{\n  "orderId": "8f3b9c2a-7d1e-4f5b-8c6a-9b8c7d6e5f4a",\n  "priceMicro": 1860000,\n  "qty": 4,\n  "secret": "98939e45dd1932a6a5739912cbf71553b798926fcb7d816a0bab13c67fe87e69"\n}`, "reveal")}
                        className="h-8 w-8 p-0 hover:bg-card shrink-0"
                      >
                        {copiedId === "reveal" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
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

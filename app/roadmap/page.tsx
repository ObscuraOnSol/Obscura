"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Calendar, Milestone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClickEffects } from "@/components/click-effects";
import { SiteHeader } from "@/components/site-header";

const ROADMAP_CONTENT = `# OBSCURA: 6-Month Protocol & Product Roadmap

## Month 1: Genesis & Cryptographic Framework (Phase I)
*   **Objective**: Launch developer SDKs, finalize SIWS specifications, and release the cryptographic CLI tool.
*   **Key Deliverables**:
    - Finalize Sign-In-With-Solana (SIWS) authentication flow using ed25519 signatures.
    - Release \`obscura-cli\` for client-side order hashing and commitment generation.
    - Launch public developer portal containing SDKs for Node.js and Python agents.
    - Set up Devnet faucet for mock compute credits.

---

## Month 2: Commit-Reveal Devnet Launch (Phase II)
*   **Objective**: Deploy the core private order placement mechanism on Solana Devnet.
*   **Key Deliverables**:
    - Deploy the Solana commitment ledger program.
    - Implement the client-side salt generator and secure storage for revealed parameters.
    - Release escrow contract matching commit values to USDC deposit requirements.
    - Release order state dashboard reflecting: Committed → Pending Reveal → Expired.

---

## Month 3: Batch Matching & Clearing Loop (Phase III)
*   **Objective**: Release the scheduled batch matching engine and market pricing metrics.
*   **Key Deliverables**:
    - Deploy the scheduled clearing worker (45s batch auction loops).
    - Implement the single clearing price matching logic ($P_\\text{clear}$) maximizing transaction volume.
    - Expose live marketplace depth, historical clearing prices, and volume statistics APIs.
    - Launch the live provider registering dashboard.

---

## Month 4: ZK Verification & Circuit Audit (Phase IV)
*   **Objective**: Match orders under zero-knowledge proofs and verify them on-chain.
*   **Key Deliverables**:
    - Compile zk-SNARK circuits for order matching constraints.
    - Deploy the Solana verifier contract.
    - Integrate off-chain proof generation in matching nodes.
    - Conduct third-party cryptographic and smart contract security audit of matching circuits.

---

## Month 5: SAS Passport & Agent-Native API (Phase V)
*   **Objective**: Launch token-gated programmatic access and sovereign identity for AI agents.
*   **Key Deliverables**:
    - Release X-API-Key management portal.
    - Integrate on-chain $OBSC balance checks for API rate-limit tier mapping.
    - Deploy SAS (Sovereign Agent Service) Passports providing granular spending limits and policies.
    - Launch reputation indexer calculating provider uptime and matching efficiency.

---

## Month 6: Mainnet Release & Staking Launch (Phase VI)
*   **Objective**: Transition to Mainnet and launch protocol fee redistribution.
*   **Key Deliverables**:
    - Deploy final audited contracts to Solana Mainnet.
    - Launch $OBSC staking portal with USDC yield claiming.
    - Deploy node operator collateral locks for capacity validation.
    - Bootstrap initial compute pools with institutional provider partners.
`;

const MILESTONES = [
  {
    month: "01",
    title: "Phase I: Genesis & Cryptographic CLI",
    description: "Launch developer SDKs, finalize SIWS specifications, and release cryptographic CLI tooling.",
    deliverables: [
      "Finalize Sign-In-With-Solana (SIWS) authentication flow using ed25519 signatures.",
      "Release obscura-cli for client-side order hashing and commitment generation.",
      "Launch public developer portal containing SDKs for Node.js and Python agents.",
      "Set up Devnet faucet for mock compute credits."
    ]
  },
  {
    month: "02",
    title: "Phase II: Commit-Reveal Devnet Launch",
    description: "Deploy the core private order placement mechanism on Solana Devnet.",
    deliverables: [
      "Deploy the Solana commitment ledger program.",
      "Implement the client-side salt generator and secure storage for revealed parameters.",
      "Release escrow contract matching commit values to USDC deposit requirements.",
      "Release order state dashboard reflecting: Committed → Pending Reveal → Expired."
    ]
  },
  {
    month: "03",
    title: "Phase III: Batch Matching & Clearing Loop",
    description: "Release the scheduled batch matching engine and market pricing metrics.",
    deliverables: [
      "Deploy the scheduled clearing worker (45s batch auction loops).",
      "Implement the single clearing price matching logic (P_clear) maximizing transaction volume.",
      "Expose live marketplace depth, historical clearing prices, and volume statistics APIs.",
      "Launch the live provider registering dashboard."
    ]
  },
  {
    month: "04",
    title: "Phase IV: ZK Verification & Circuit Audit",
    description: "Match orders under zero-knowledge proofs and verify them on-chain.",
    deliverables: [
      "Compile zk-SNARK circuits for order matching constraints.",
      "Deploy the Solana verifier contract.",
      "Integrate off-chain proof generation in matching nodes.",
      "Conduct third-party cryptographic and smart contract security audit of matching circuits."
    ]
  },
  {
    month: "05",
    title: "Phase V: SAS Passport & Agent-Native API",
    description: "Launch token-gated programmatic access and sovereign identity for AI agents.",
    deliverables: [
      "Release X-API-Key management portal.",
      "Integrate on-chain $OBSC balance checks for API rate-limit tier mapping.",
      "Deploy SAS (Sovereign Agent Service) Passports providing granular spending limits and policies.",
      "Launch reputation indexer calculating provider uptime and matching efficiency."
    ]
  },
  {
    month: "06",
    title: "Phase VI: Mainnet Release & Staking Launch",
    description: "Transition to Mainnet and launch protocol fee redistribution.",
    deliverables: [
      "Deploy final audited contracts to Solana Mainnet.",
      "Launch $OBSC staking portal with USDC yield claiming.",
      "Deploy node operator collateral locks for capacity validation.",
      "Bootstrap initial compute pools with institutional provider partners."
    ]
  }
];

export default function RoadmapPage() {
  const downloadFile = useCallback((format: "md" | "txt") => {
    const filename = `obscura-roadmap.${format}`;
    const contentType = format === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([ROADMAP_CONTENT], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-x-clip text-foreground">
      <ClickEffects />
      
      {/* Glow Header Background */}
      <div className="absolute left-0 right-0 top-0 h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteHeader />

        <main className="flex-1 container max-w-4xl py-12 px-4 sm:px-6">
          {/* Back Navigation */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </Link>

          {/* Action Header Card */}
          <div className="rounded-xl border border-border bg-card/40 p-6 backdrop-blur-sm mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="data flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary">
                <Calendar className="h-3.5 w-3.5" />
                6-Month Execution Timeline
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-1">Obscura Roadmap</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Detailed development plans and milestones.
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

          {/* Roadmap Timeline */}
          <div className="relative border-l border-border/60 ml-4 pl-6 sm:ml-8 sm:pl-10 space-y-12 py-4">
            {MILESTONES.map((m) => (
              <div key={m.month} className="relative">
                {/* Timeline Dot */}
                <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 flex h-4 w-4 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-primary bg-background shadow-sm">
                  <Milestone className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 text-primary" />
                </div>

                {/* Milestone Detail Card */}
                <div className="group rounded-xl border border-border bg-card/30 p-6 backdrop-blur-sm transition-colors hover:border-primary/20">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="data text-xs text-primary font-semibold">
                      Month {m.month}
                    </span>
                    <span className="text-muted-foreground/30 text-xs">|</span>
                    <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                      {m.title}
                    </h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {m.description}
                  </p>

                  {/* Deliverables List */}
                  <div className="mt-5 border-t border-border/40 pt-4">
                    <h4 className="data text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-semibold mb-3">
                      Key Deliverables
                    </h4>
                    <ul className="space-y-2">
                      {m.deliverables.map((d, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2.5">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

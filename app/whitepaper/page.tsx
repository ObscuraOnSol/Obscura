"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClickEffects } from "@/components/click-effects";
import { SiteHeader } from "@/components/site-header";

const WHITEPAPER_CONTENT = `# OBSCURA: Decentralized Dark Pool for Sovereign AI Compute

## Abstract
Obscura introduces a decentralized, privacy-preserving dark pool architecture for GPU compute resources on the Solana blockchain. By implementing cryptographic commitments, commit-reveal protocols, scheduled batch clearing auctions, and zero-knowledge (ZK) match validation, Obscura mitigates the systemic issues of compute front-running, information leakage, and censorship in public marketplaces. This protocol enables autonomous AI agents and modern enterprises to acquire high-performance compute capacity (e.g., NVIDIA H100s, H200s, H800s, B200s) programmatically and privately. The microstructure ensures that compute allocation parameters, bidding prices, capacity sizes, and leasing schedules remain confidential until the exact moment of match settlement.

---

## 1. Introduction & The AI Compute Crisis
The exponential growth of Large Language Models (LLMs) and agentic AI systems has turned raw high-performance compute into the primary commodity of the 21st century. Despite this, compute markets remain highly centralized, governed by a small cartel of hyperscale cloud providers (AWS, Azure, GCP) and specialized retail clouds.

This centralized model introduces significant structural risks for developers and enterprises:
1.  **Supply Cartelization & Censorship**: Centralized hosting providers gate compute access behind strict KYC verification, geographical sanctions, and political alignment criteria. AI models that diverge from platform policies face sudden, unilateral compute lease terminations.
2.  **Corporate Espionage & Information Leakage**: Publicly leasing compute requires exposing model configurations, cluster scales, training durations, and bidding budgets. Competitors can scrape public marketplaces to front-run model launch windows, map corporate AI development pipelines, and disrupt capital allocations.
3.  **Front-running on Open Ledgers**: In public decentralized compute platforms, buy orders hit transparent mempools. Attackers can intercept these orders, buy up the required GPU time on-demand, and resell it to the original bidder at a premium (latency arbitrage).

Obscura addresses these vulnerabilities by building a cryptographic dark pool on Solana. By encrypting the order book, executing scheduled batch auctions, and verifying match authenticity using zero-knowledge proofs (zk-SNARKs), Obscura guarantees that compute buyers can secure hardware permissionlessly, privately, and at fair market value.

---

## 2. Protocol Microstructure & Cryptographic Commit-Reveal

### 2.1 The Continuous Leakage Problem
In standard double-auction order books, bidding parameters are public. If a buyer places a large bid for a cluster of 512 H100s, the entire market observes the demand. Sellers immediately increase ask prices, and rival buyers rush to secure remaining capacity, resulting in severe slippage and artificial price spikes.

### 2.2 The Commit-Reveal Framework
Obscura solves order-book leakage through a two-phase cryptographic commit-reveal system.

1.  **Commit Phase**:
    A compute buyer compiles their transaction parameters into a private order vector $O$:
    $$O = \{G, P, Q, T\}$$
    where:
    -   $G \\in \\mathbb{Z}^+$ represents the GPU model identifier (e.g., H100 80GB, A100 SXM4).
    -   $P \\in \\mathbb{R}^+$ represents the maximum bidding price in USDC per hour.
    -   $Q \\in \\mathbb{Z}^+$ represents the quantity of GPUs required.
    -   $T \\in \\mathbb{Z}^+$ represents the total lease duration in hours.

    To bind the order without revealing its contents, the client generates a 256-bit secure pseudorandom salt $S$. The client then computes the cryptographic commitment hash $H$:
    $$H = \\text{SHA-256}(G \\parallel P \\parallel Q \\parallel T \\parallel S)$$

    The buyer submits only the commitment hash $H$ and an escrow lock deposit of $P \\times Q \\times T$ USDC to the Solana Commitment Program. The on-chain ledger records only the transaction hash $H$ and the locked funds, keeping the GPU type, bid price, and quantity completely hidden.

2.  **Reveal Phase**:
    At the designated batch clearing block, the buyer reveals the cleartext values $\{G, P, Q, T\}$ and the salt $S$. The Solana Commitment Program re-hashes the revealed parameters and verifies that the output matches the committed hash $H$:
    $$\\text{SHA-256}(G_{\\text{rev}} \\parallel P_{\\text{rev}} \\parallel Q_{\\text{rev}} \\parallel T_{\\text{rev}} \\parallel S_{\\text{rev}}) \\stackrel{?}{=} H$$

    Upon successful validation, the order enters the active batch matching pool. Bidders who fail to reveal their parameters within the designated match window forfeit a percentage of their escrowed deposit (commitment fee) to prevent malicious matching-denial attacks.

---

## 3. Scheduled Batch Clearing Auctions
Rather than clearing transactions continuously (which leaks order timing and size information), Obscura utilizes scheduled batch auctions executed every $B = 45$ seconds.

### 3.1 Single Clearing Price Discovery
All revealed orders for a specific GPU class within a batch are aggregated to build supply and demand curves. Instead of executing orders at individual bid prices, the matching engine calculates a single, uniform clearing price $P_{\\text{clear}}$ for the entire batch.

Let $D(p)$ represent the aggregate demand curve (sum of $Q$ for all buy orders with $P \\ge p$) and $S(p)$ represent the aggregate supply curve (sum of capacity for all sell orders with $P_{\\text{limit}} \\le p$). The clearing price $P_{\\text{clear}}$ is calculated as the price that maximizes the matched transaction volume:
$$\\max \\sum \\min(D(P_{\\text{clear}}), S(P_{\\text{clear}}))$$

Executing all matches at $P_{\\text{clear}}$ prevents latency-based sniping, guarantees fair market pricing, and ensures that neither buyers nor sellers are penalized for submitting their true limit valuations.

---

## 4. zk-SNARK Matching Constraints & Verification
To maintain privacy during matching, the actual matching allocation is calculated off-chain by specialized matching nodes. To prove that the matches are correct and honest without leaking private bid parameters, nodes must submit a zero-knowledge proof (zk-SNARK) to the Solana Verifier Program.

The zk-SNARK circuit enforces the following constraints:
1.  **Clearing Price Legitimacy**: The calculated clearing price $P_{\\text{clear}}$ sits at the valid intersection of the revealed supply and demand curves.
2.  **Valuation Enforcement**: No buyer order was matched if $P < P_{\\text{clear}}$, and no seller order was matched if $P_{\\text{limit}} > P_{\\text{clear}}$.
3.  **Conservation of Allocation**: The sum of allocated compute units to buyers exactly matches the sum of hardware capacity activated by providers.
4.  **Escrow Integrity**: The funds released from the escrow account to a provider do not exceed the clearing price rate multiplied by the allocated duration ($P_{\\text{clear}} \\times Q \\times T$).

The Solana Verifier Program validates this proof in a single transaction. If the proof is valid, the contract releases the USDC to the providers and updates allocation records, keeping individual wallet connections and bid amounts private.

---

## 5. Tokenomics ($OBSC) & Sovereign Agent Service (SAS)

### 5.1 Protocol Fee Dynamics & Deflationary Loops
Obscura collects a 2.5% protocol fee on all settled compute leases. This fee is routed through automated on-chain contracts:
*   **20% Buyback and Burn**: 20% of all accumulated protocol fees are automatically converted to $OBSC tokens via decentralized exchanges (DEXs) and permanently burned, reducing the circulating supply.
*   **80% USDC Staking Yield**: 80% of protocol fees are distributed directly to $OBSC token stakers as real yield in USDC, aligning long-term token holders with protocol transaction volume.

### 5.2 Node Operator Staking
Operators running matching engines or hosting compute capacity are required to lock up a minimum stake of $OBSC. If an operator reports a fraudulent match, drops hardware availability during a lease, or breaches ZK constraints, their staked $OBSC is partially or fully slashed and redistributed to affected buyers.

### 5.3 SAS Passports for AI Agents
To support autonomous AI agents, Obscura provides programmatic access via the Sovereign Agent Service (SAS).
*   **Spend Controls**: Agents generate SAS Passports that enforce hard spending caps, lease limits, and GPU model policies.
*   **Token-Gated Tiers**: API access rates are determined by the agent's staked $OBSC balance:
    -   **Bronze Tier**: 60 requests/min.
    -   **Silver Tier**: 1,200 requests/min + priority batch allocation.
    -   **Gold Tier**: 3,000 requests/min + zero-latency order relaying.

---

## 6. Screened Settlement & Zero-Knowledge Compliance
A major risk for private compute networks is regulatory compliance. Obscura addresses this using **Screened Settlement** via Association-Set Proofs (ASPs).

Before a wallet can withdraw settled funds or establish a lease, it must provide a zero-knowledge membership proof. This proof verifies that the user's wallet address belongs to a pre-screened list of compliant, non-sanctioned addresses. The proof is verified without exposing the wallet's identity, history, or balance, ensuring compliance while preserving privacy.

---

## 7. Conclusion
Obscura bridges the gap between raw hardware markets and cutting-edge cryptography. By combining Solana's high-speed transaction speeds with commit-reveal protocols and zk-SNARK verifications, Obscura establishes a private, permissionless, and capital-efficient marketplace for the next generation of AI compute.
`;

export default function WhitepaperPage() {
  const downloadFile = useCallback((format: "md" | "txt") => {
    const filename = `obscura-whitepaper.${format}`;
    const contentType = format === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([WHITEPAPER_CONTENT], { type: contentType });
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
              <div className="data text-[11px] uppercase tracking-[0.2em] text-primary">
                Technical Specification
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-1">Obscura Whitepaper</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Version 1.0.0 · Cryptographic Specifications & Economics
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

          {/* Document Content */}
          <article className="prose prose-invert max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:border-b prose-h2:border-border/60 prose-h2:pb-2 prose-h3:text-lg prose-h3:mt-6 prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
            <div className="space-y-8 text-muted-foreground">
              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  OBSCURA: Decentralized Dark Pool for Sovereign AI Compute
                </h2>
                <p className="leading-relaxed">
                  Obscura introduces a decentralized, privacy-preserving dark pool architecture for GPU compute resources on the Solana blockchain. By implementing cryptographic commitments, commit-reveal protocols, scheduled batch clearing auctions, and zero-knowledge (ZK) match validation, Obscura mitigates the systemic issues of compute front-running, information leakage, and censorship in public marketplaces. This protocol enables autonomous AI agents and modern enterprises to acquire high-performance compute capacity (e.g., NVIDIA H100s, H200s, H800s, B200s) programmatically and privately. The microstructure ensures that compute allocation parameters, bidding prices, capacity sizes, and leasing schedules remain confidential until the exact moment of match settlement.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  1. Introduction & The AI Compute Crisis
                </h2>
                <p className="leading-relaxed mb-4">
                  The exponential growth of Large Language Models (LLMs) and agentic AI systems has turned raw high-performance compute into the primary commodity of the 21st century. Despite this, compute markets remain highly centralized, governed by a small cartel of hyperscale cloud providers (AWS, Azure, GCP) and specialized retail clouds.
                </p>
                <p className="leading-relaxed mb-4">
                  This centralized model introduces significant structural risks for developers and enterprises:
                </p>
                <ul className="list-disc pl-6 space-y-3 mb-4">
                  <li>
                    <strong className="text-foreground">Supply Cartelization & Censorship:</strong> Centralized hosting providers gate compute access behind strict KYC verification, geographical sanctions, and political alignment criteria. AI models that diverge from platform policies face sudden, unilateral compute lease terminations.
                  </li>
                  <li>
                    <strong className="text-foreground">Corporate Espionage & Information Leakage:</strong> Publicly leasing compute requires exposing model configurations, cluster scales, training durations, and bidding budgets. Competitors can scrape public marketplaces to front-run model launch windows, map corporate AI development pipelines, and disrupt capital allocations.
                  </li>
                  <li>
                    <strong className="text-foreground">Front-running on Open Ledgers:</strong> In public decentralized compute platforms, buy orders hit transparent mempools. Attackers can intercept these orders, buy up the required GPU time on-demand, and resell it to the original bidder at a premium (latency arbitrage).
                  </li>
                </ul>
                <p className="leading-relaxed">
                  Obscura addresses these vulnerabilities by building a cryptographic dark pool on Solana. By encrypting the order book, executing scheduled batch auctions, and verifying match authenticity using zero-knowledge proofs (zk-SNARKs), Obscura guarantees that compute buyers can secure hardware permissionlessly, privately, and at fair market value.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  2. Protocol Microstructure & Cryptographic Commit-Reveal
                </h2>
                
                <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                  2.1 The Continuous Leakage Problem
                </h3>
                <p className="leading-relaxed mb-4">
                  In standard double-auction order books, bidding parameters are public. If a buyer places a large bid for a cluster of 512 H100s, the entire market observes the demand. Sellers immediately increase ask prices, and rival buyers rush to secure remaining capacity, resulting in severe slippage and artificial price spikes. Obscura solves order-book leakage through a two-phase cryptographic commit-reveal system.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">
                  2.2 The Commit-Reveal Framework
                </h3>
                <ol className="list-decimal pl-6 space-y-4 mb-4">
                  <li>
                    <strong className="text-foreground">Commit Phase:</strong> A user compiles their transaction parameters into a private order vector <code className="text-primary bg-primary/5 px-1.5 py-0.5 rounded font-mono">O = &#123;G, P, Q, T&#125;</code> where <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">G</code> is the GPU model identifier, <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">P</code> is the max price, <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">Q</code> is the quantity, and <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">T</code> is the lease duration. 
                    <p className="mt-2">To bind the order without revealing its contents, the client generates a 256-bit secure pseudorandom salt <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">S</code>. The client then computes the cryptographic commitment hash:</p>
                    <div className="data my-3 p-3 bg-card rounded border border-border text-center text-foreground text-xs overflow-x-auto">
                      H = SHA-256( G || P || Q || T || S )
                    </div>
                    Only <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">H</code> and an escrow lock deposit of <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">P × Q × T</code> USDC are submitted to the Solana Commitment Program. The on-chain ledger records only the hash and the locked funds, keeping all variables completely hidden.
                  </li>
                  <li>
                    <strong className="text-foreground">Reveal Phase:</strong> At the designated batch clearing block, the buyer reveals the cleartext values and the salt. The Solana Commitment Program re-hashes the revealed parameters and verifies that the output matches the committed hash <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">H</code>. Successful validations enter the matching pool. Bidders who fail to reveal their parameters forfeit a percentage of their escrowed deposit (commitment fee) to prevent spam.
                  </li>
                </ol>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  3. Scheduled Batch Clearing Auctions
                </h2>
                <p className="leading-relaxed mb-4">
                  Rather than clearing transactions continuously (which leaks order timing and size information), Obscura utilizes scheduled batch auctions executed every <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">B = 45</code> seconds.
                </p>
                <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                  3.1 Single Clearing Price Discovery
                </h3>
                <p className="leading-relaxed">
                  All revealed orders for a specific GPU class within a batch are aggregated to build supply and demand curves. Instead of executing orders at individual bid prices, the matching engine calculates a single, uniform clearing price <code className="font-mono text-xs text-primary bg-primary/5 px-1 rounded">P_clear</code> for the entire batch. The clearing price is calculated as the price that maximizes the matched transaction volume. Executing all matches at this uniform clearing price prevents latency-based sniping, guarantees fair market pricing, and ensures that bidders are not penalized for submitting their true limit valuations.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  4. zk-SNARK Matching Constraints & Verification
                </h2>
                <p className="leading-relaxed mb-4">
                  To maintain privacy during matching, the actual matching allocation is calculated off-chain by specialized matching nodes. To prove that the matches are correct and honest without leaking private bid parameters, nodes must submit a zero-knowledge proof (zk-SNARK) to the Solana Verifier Program.
                </p>
                <p className="leading-relaxed mb-3 font-semibold text-foreground">The zk-SNARK circuit enforces the following constraints:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong className="text-foreground">Clearing Price Legitimacy:</strong> The calculated clearing price sits at the valid intersection of the revealed supply and demand curves.</li>
                  <li><strong className="text-foreground">Valuation Enforcement:</strong> No buyer order was matched if its bid price was below the clearing price, and no provider order was matched if its limit price was above the clearing price.</li>
                  <li><strong className="text-foreground">Conservation of Allocation:</strong> The sum of allocated compute units to buyers matches the sum of activated hardware capacity.</li>
                  <li><strong className="text-foreground">Escrow Integrity:</strong> The funds released to a provider do not exceed the clearing price rate multiplied by the allocated duration.</li>
                </ul>
                <p className="leading-relaxed">
                  The Solana Verifier Program validates this proof in a single transaction. If the proof is valid, the contract releases the USDC to the providers, keeping individual wallet connections and bid amounts private.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  5. Tokenomics ($OBSC) & Sovereign Agent Service (SAS)
                </h2>
                
                <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
                  5.1 Protocol Fee Dynamics & Deflationary Loops
                </h3>
                <p className="leading-relaxed mb-4">
                  Obscura collects a 2.5% protocol fee on all settled compute leases. This fee is routed through automated on-chain contracts:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li><strong className="text-foreground">20% Buyback and Burn:</strong> 20% of protocol fees are automatically converted to $OBSC tokens via decentralized exchanges (DEXs) and permanently burned, reducing supply.</li>
                  <li><strong className="text-foreground">80% USDC Staking Yield:</strong> 80% of protocol fees are distributed directly to $OBSC token stakers as real yield in USDC, aligning holders with protocol transaction volume.</li>
                </ul>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">
                  5.2 Node Operator Staking & SAS Passports
                </h3>
                <p className="leading-relaxed">
                  Operators running matching engines or hosting compute capacity are required to lock up a minimum stake of $OBSC. If an operator reports a fraudulent match, drops hardware availability during a lease, or breaches ZK constraints, their staked $OBSC is slashed.
                </p>
                <p className="leading-relaxed mt-4">
                  To support autonomous AI agents, Obscura provides programmatic access via the Sovereign Agent Service (SAS). Agents generate SAS Passports that enforce hard spending caps, lease limits, and GPU model policies. API access rate limits are determined by the agent's staked $OBSC balance (Bronze, Silver, Gold Tiers).
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  6. Screened Settlement & Zero-Knowledge Compliance
                </h2>
                <p className="leading-relaxed">
                  A major risk for private compute networks is regulatory compliance. Obscura addresses this using <strong className="text-foreground">Screened Settlement</strong> via Association-Set Proofs (ASPs). Before a wallet can withdraw settled funds or establish a lease, it must provide a zero-knowledge membership proof. This proof verifies that the user's wallet address belongs to a pre-screened list of compliant, non-sanctioned addresses. The proof is verified without exposing the wallet's identity, history, or balance, ensuring compliance while preserving privacy.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground border-b border-border/60 pb-2 mb-4">
                  7. Conclusion
                </h2>
                <p className="leading-relaxed">
                  Obscura bridges the gap between raw hardware markets and cutting-edge cryptography. By combining Solana's high-speed transaction speeds with commit-reveal protocols and zk-SNARK verifications, Obscura establishes a private, permissionless, and capital-efficient marketplace for the next generation of AI compute.
                </p>
              </div>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}

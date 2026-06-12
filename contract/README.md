# Obscura — Contract (`/contract`)

Solana **Anchor** programs for Obscura. This is the on-chain layer of the dark pool.

> **Is a smart contract strictly required to run Obscura?** No. The buildable
> product (frontend + backend) runs without a deployed program. This directory
> is scaffolded so the architecture is honored and the commit-reveal mechanic is
> real, but it is **not on the critical path** for the MVP.

## Scope (deliberate)

| Program / service | Status in this repo |
|---|---|
| `obscura_pool` | **Scaffolded** — commit-reveal order entrypoints + batch-settlement trigger (`initialize_pool`, `commit_order`, `reveal_order`, `trigger_batch`). |
| `obscura_escrow` | **Interface only** — USDC lock/release/refund. Out of scope by design. |
| association-set verifier | **Interface only, non-removable in production** — every external exit must carry a clean-provenance proof. |
| settlement verifier | **Interface only** — V1 relayer-signature; V2 Groth16 batch proof. |

The split mirrors Obscura's two privacy planes: **order privacy** (commit-reveal,
implemented here) and **fund privacy** (the money core — documented at interface
level only; see *Obscura Backend*, §9).

## Layout

```
contract/
  Anchor.toml
  Cargo.toml                      # workspace
  programs/obscura_pool/          # the dark-pool program (Rust)
  tests/obscura_pool.test.ts      # commit-reveal invariant tests
```

## Prerequisites

- Rust + Solana CLI
- Anchor 0.30.1 (`avm install 0.30.1 && avm use 0.30.1`)

## Build / test / deploy

```bash
anchor build
anchor test
anchor deploy --provider.cluster devnet   # IDs go into backend/.env + frontend .env
```

Program IDs are wired into `backend/.env` (`POOL_PROGRAM_ID`, …) and the
frontend `.env`. Production deploys are via multisig; all programs are
independently audited before mainnet, with a trusted-setup ceremony + published
transcripts for any ZK components.

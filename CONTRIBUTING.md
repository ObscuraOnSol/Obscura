# Contributing to Obscura

Thanks for helping build the dark pool for compute. This document covers what we
want right now, how to set up, and how to ship.

## What we want right now

- **Frontend surfaces** — fleshing out the scaffolded pages: the commit-reveal
  order flow UI, the activity feed (with CSV export), agent-mode dashboards, and
  settings (API-key generation, price alerts).
- **Backend read APIs** — anything that reads public on-chain state/aggregates
  and exposes no private material.
- **Matching engine + workers** — the scheduled ~45s batch auction, the
  price-oracle aggregator, and the reputation/staking indexer.
- **`obscura_pool` program** — hardening the commit-reveal entrypoints and tests.

## Out of scope

- The **fund-privacy money core** — escrow internals, the relayer/withdrawal
  path, the association-set verifier, and the settlement verifier. These are
  documented at the interface level only and are intentionally not built here.
  The association-set clean-provenance proof on every exit is **non-removable** —
  do not propose changes that bypass it.
- Anything that stores secrets, spend keys, or deanonymising data in the
  pool/settlement tables. These hold public-safe data only.
- KYC of any kind. Obscura is pseudonymous; wallet is identity.

## Setup

```bash
git clone https://github.com/ObscuraOnSol/Obscura.git && cd Obscura
bun install                       # frontend (root)
cp .env.example .env
docker compose up -d              # local Postgres
cd backend && bun install && cp .env.example .env
```

## Workflow

1. Fork → branch from `main`.
2. One concern per PR. Keep diffs surgical.
3. Add/maintain tests. Backend changes must pass `bun run check` and `bun test`.
4. Open a PR with a clear description of what and why.

For tech-update branches, follow the convention `feat/wave{N}-tu-{M}` (see
[`tech-updates.md`](tech-updates.md)).

## Commit style

Imperative, present tense, plain English. One logical change per commit.
Example: `add /api/market/stats endpoint`.

## Bug reports

Include: what you did (which page / endpoint / order), what you got, what you
expected, and repro steps. For anything security-sensitive, **do not open a
public issue** — see [`SECURITY.md`](SECURITY.md).

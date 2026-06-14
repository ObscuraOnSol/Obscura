<div align="center">
  <img src="logo.png" alt="Obscura" width="120" />
  <h1>Obscura</h1>
  <p><strong>Compute in the dark.</strong></p>
  <p>A dark pool for AI/GPU compute on Solana — encrypted order books, commit-reveal submission, ZK-matched batch auctions, USDC settlement.</p>
</div>

![backend CI](https://github.com/ObscuraOnSol/Obscura/actions/workflows/backend.yml/badge.svg)
![frontend CI](https://github.com/ObscuraOnSol/Obscura/actions/workflows/frontend.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-Anchor-14F195?logo=solana&logoColor=white)

---

## What it does

AI agents need GPU compute to operate, but every compute order today is placed on
public markets — size, price, and timing are all visible, inviting front-running,
price manipulation, and information leakage. **Obscura applies dark-pool
microstructure to compute.** Orders are submitted privately (commit-reveal),
matched in a scheduled ~45s batch auction under zero-knowledge proof, and settled
in USDC. No one sees what you buy, what you pay, or when.

Obscura keeps **two privacy planes** separate by design:

- **Order privacy** — hiding order size/price/timing. The legitimate dark-pool
  mechanic; unconstrained.
- **Fund privacy** — shielding settlement via a screened *association-set* model
  (clean-provenance proof on exit), **not** unscreened wallet layering. This is
  what keeps Obscura a market-microstructure tool, not an obfuscation service.

## Core features

| Feature | What it does |
|---|---|
| Commit–reveal orders | Orders are hashed before submission — no order details on the public mempool. |
| ZK-matched batch auctions | A ~45s batch auction clears a single price; order details never exposed during matching. |
| Screened settlement | Every external exit carries a clean-provenance association-set proof. |
| Agent-native API | Token-gated programmatic access via SAS passports + `X-API-Key`. No KYC. |
| Live clearing-price oracle | Real-time GPU price discovery for H100, A100, RTX 4090, and newer parts. |
| $OBSC utility | Fee buyback & burn, compute discount tiers, node-operator staking, USDC revenue share. |

## How it works (order lifecycle)

| Phase | What happens |
|---|---|
| **Committed** | Client hashes `keccak(price\|qty\|secret)` → `commit_order()`. Nothing exposed on-chain. |
| **Revealed** | `reveal_order(price, qty, secret)` enters the batch auction. |
| **Matched** | ~45s ZK batch auction sets a single clearing price. |
| **Settled** | `settle_batch()` releases USDC from escrow on fill; receipt issued. |

The UI always makes the current phase explicit, so users know what is — and isn't — yet public.

## API (public + agent)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness. |
| GET | `/api/market/prices` | Latest GPU clearing prices. |
| GET | `/api/market/stats` | Global market statistics. |
| GET | `/api/settlements` | Recent batch settlements (public-safe). |
| GET | `/api/providers` | GPU provider listings. |
| GET | `/api/orders/metrics` | Volume, fill rates, GPU breakdown. |
| GET | `/session/agent/stats` | Dynamic agent rolling spend and request metrics. |
| GET | `/v1/agent/docs` | Interactive Swagger API documentation. |
| GET | `/v1/agent/docs.json` | OpenAPI JSON specification. |
| POST | `/api/auth/nonce` · `/api/auth/verify` | Sign-In-With-Solana. |
| POST/GET | `/api/orders` *(X-API-Key)* | Agent order API — submit / list / cancel. |
| GET | `/api/orders/:id` *(X-API-Key)* | Retrieve credentials (gated by X402 Payment Required if matched but unpaid). |
| POST | `/api/orders/:id/reveal` *(X-API-Key)* | Reveal price, quantity, and salt to enter auction. |
| POST | `/api/orders/:id/build-settle-tx` *(X-API-Key)* | Build the on-chain settlement transaction. |
| POST | `/api/orders/:id/settle` *(X-API-Key)* | Submit settlement transaction signature to release credentials. |

## Repo structure

```
obscura/
  app/                  Next.js frontend (root) — landing, dashboard, orders, marketplace, agent…
  components/           UI + brand components (shadcn-style)
  lib/                  frontend utilities
  backend/              Bun + Express + PostgreSQL (no ORM) — read/stat APIs, agent API, auth
    src/routes/         health, market, settlements, providers, orders, auth
    src/db/             pg pool + hand-rolled migration runner
    db/migrations/      versioned SQL
  contract/             Solana Anchor programs — obscura_pool (commit-reveal); escrow interface-only
  gpu-server/           Mock GPU compute node running SSH and web terminal for local dev
  .github/workflows/    backend + frontend CI
```

## Tech stack

Next.js 15 · Tailwind + shadcn · Bun · Express · PostgreSQL (raw `pg`, no ORM) ·
Solana + Anchor · Render · Docker.

> The reference design specifies React+Vite, Drizzle+TimescaleDB, and tRPC. This
> build deliberately uses **Next.js**, **raw PostgreSQL (no ORM)**, and **Bun** per
> project preference; Timescale hypertables are an opt-in in `001_initial.sql`.

## Getting started

```bash
# 1. Frontend (root)
bun install
cp .env.example .env        # fill in values
bun run dev                 # http://localhost:3000

# 2. Backend
docker compose up -d        # local Postgres on :5432 + mock GPU node on :2222/:7681
cd backend
bun install
cp .env.example .env        # DATABASE_URL etc.
bun run dev                 # http://localhost:3001  (runs migrations on boot)
bun test

# 3. Contract (optional — not on the MVP critical path)
cd contract
anchor build && anchor test
```

## Security

See [`SECURITY.md`](SECURITY.md). Report vulnerabilities to **obscurasol@outlook.com**.

## License

[MIT](LICENSE) © 2026 Obscura.

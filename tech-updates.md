# Obscura — Build & Tech Plan

The strategy is **ship a real, working MVP first**, then iterate. The MVP is not
a demo with seeded numbers — the commit→reveal→match→settle lifecycle actually
runs end to end against PostgreSQL, providers are real rows, and every read API
reflects real activity. Everything after the MVP is an improvement wave.

---

## v1 — MVP (what actually ships)

The minimum that makes Obscura a *working product*, not a mockup. All of this is
real: data is produced by the system, not hand-seeded.

| Area | MVP scope |
|---|---|
| **Order lifecycle** | `commit → reveal → match → settle` runs for real. The matching-engine worker runs every `MATCHING_INTERVAL_SECONDS`, pulls revealed orders, clears a per-GPU batch price, writes `settlements` + `market_prices`, and advances orders to `matched`/`settled`. No seeded settlements. |
| **Auth** | Sign-In-With-Solana: nonce issue → wallet signs → ed25519 verify → short-TTL JWT session. Replaces the demo localStorage wallet. |
| **Providers** | Real provider registration (`POST /api/providers`, auth-gated). Marketplace depth + clearing prices are computed from real providers + matched batches. |
| **Orders UI** | Commit-reveal flow tied to the signed-in wallet; live phase per order, driven by the worker advancing state. |
| **Agent API** | Token-gated `X-API-Key` submit/list/cancel, tier-gated rate limits. |
| **Read APIs** | `market/prices`, `market/stats`, `providers`, `settlements`, `orders/metrics` — all reading live tables. |
| **Activity** | Real wallet timeline (orders + settlements) with CSV export. |
| **Infra** | Backend container on Render (`/health` check), frontend on Vercel, Postgres (Supabase). Migrations on boot. |

**Definition of done for v1:** a new wallet can sign in, commit an order, reveal
it, and watch the next batch actually match and settle it — with the dashboard,
marketplace, and activity feed all reflecting that real event.

---

## Post-launch improvement waves

Each feature is scoped to ship in a day. Branch convention: `feat/wave{N}-tu-{M}`.

### Wave 1 — Harden the lifecycle
- **Live fills via WebSocket** `#1` — push settlement events to the dashboard; no refresh. *Backend:* WS broadcast from the matching loop.
- **Configurable batch interval surfaced** `#2` — show the live countdown from `MATCHING_INTERVAL_SECONDS` via `/api/market/stats`.
- **Order receipts** `#3` — per-fill receipt (batch, clearing price, timestamp). *Backend:* `GET /api/orders/:id/receipt`.
- **Price sparklines** `#4` — 24h mini-charts on marketplace cards from `market_prices` history.
- **Reputation seed** `#5` — basic provider reputation (fill rate, uptime) surfaced on listings.

### Wave 2 — Engagement
- **Price alerts** `#6` — "notify when H100 < $X/hr"; `price_alerts` table + worker.
- **Notification prefs** `#7` — `notification_prefs` JSONB on `users`.
- **Paper-trading mode** `#8` — walletless practice + leaderboard.
- **Order templates** `#9` — saved GPU/price/qty presets.
- **Email/Telegram receipts** `#10` — push fills to a channel.

### Wave 3 — Market depth
- **Multi-region GPU types** `#11` — expand beyond H100/A100/4090/L40S.
- **Provider dashboard** `#12` — capacity, stake, slashing state, earnings.
- **Partial fills** `#13` — split large orders across providers in a batch.
- **Limit + market order types** `#14`.
- **Depth chart** `#15` — order-book-style depth per GPU.

### Wave 4 — Agent & business tier
- **API-key management UI** `#16` — generate/list/revoke (plaintext shown once).
- **Tier resolution from on-chain $OBSC** `#17` — live tier from token balance (5-min cache).
- **Rate-limit middleware** `#18` — per-IP + per-key tiers.
- **SAS agent passports** `#19` — spend caps, daily limits, policy enforcement.
- **OpenAPI + MCP** `#20` — `/api/v1/docs` (Scalar) + an MCP descriptor for agents.

### Wave 5 — Scale & onchain
- **Redis cache + pub/sub** `#21` — replace in-process state.
- **Anchor program integration** `#22` — wire `obscura_pool` commit/reveal/settle on devnet; IDs into env.
- **Escrow + screened settlement** `#23` — USDC lock/release with the association-set proof gate (money-core; audited before mainnet).
- **$OBSC staking dashboard** `#24` — buyback/burn stats, USDC yield (needs token live).
- **Reputation indexer** `#25` — score from on-chain events with decay.

---

## Notes for whoever builds this

- Read the codebase before adding a wave feature — don't invent services.
- The MVP matching engine is in-process and deterministic; the ZK/Anchor settlement is a Wave-5 swap-in, not a v1 blocker.
- Money-core (escrow, association-set verifier, settlement verifier) stays interface-level until audited — see `contract/README.md`.

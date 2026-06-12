# Obscura — Tech Updates

Post-launch shipping plan. 5 waves, 5 features each, one wave per day. Features
are numbered sequentially (#1–#25). Branch convention: `feat/wave{N}-tu-{M}`.

---

## Wave 1 — Polish what's live

- **Wire SIWS signature verification** `#1`
  - Frontend: Solana wallet-adapter sign flow against `/api/auth/nonce` + `/api/auth/verify`.
  - Backend: verify ed25519 signature of the statement in `auth.ts`, then mint a short-TTL JWT.
- **Configurable batch interval** `#2`
  - Frontend: show the live "next batch" countdown from a config value, not a hardcoded 45s.
  - Backend: already reads `MATCHING_INTERVAL_SECONDS`; expose it via `/api/market/stats`.
- **Real clearing prices on the landing/marketplace** `#3`
  - Frontend: replace the mock `CLEARING` array with a fetch to `GET /api/market/prices`.
  - Backend: seed `market_prices` and ensure the endpoint returns the latest per GPU type.
- **GPU type registry** `#4`
  - Frontend: dropdowns pull from a `/api/market/gpu-types` list instead of inline strings.
  - Backend: add `GET /api/market/gpu-types` deriving distinct types from `market_prices`/`providers`.
- **Health/version surface** `#5`
  - Frontend: tiny footer build-version readout from `/api/health`.
  - Backend: include git sha in `version` (already returns `npm_package_version`).

## Wave 2 — User-facing engagement

- **Commit-reveal order flow UI** `#6`
  - Frontend: build the real `/orders` flow — choose GPU/price/qty, client-side `keccak` commit, reveal step, phase chips.
  - Backend: `POST /api/orders` commit + `POST /api/orders/:id/reveal` for session users (not just agents).
- **Activity feed + CSV export** `#7`
  - Frontend: flesh out `/activity` — wallet timeline, filter by type, CSV download.
  - Backend: `GET /api/activity` unifying orders + settlements for a wallet.
- **Price alerts** `#8`
  - Frontend: "notify when H100 < $X/hr" form in `/settings`.
  - Backend: `price_alerts` table + a worker that checks thresholds against `market_prices`.
- **Transaction receipts** `#9`
  - Frontend: receipt modal on each fill — block, timestamp, compute cost, confirmations, explorer link.
  - Backend: `GET /api/orders/:id/receipt` returning settlement references.
- **Notification preferences** `#10`
  - Frontend: toggle channels (email/in-app) in `/settings`.
  - Backend: `notification_prefs` JSONB column on `users` + read/write endpoint.

## Wave 3 — Core product expansion

- **Live fills via WebSocket** `#11`
  - Frontend: subscribe to live fills/prices; update dashboard without refresh.
  - Backend: WS endpoint broadcasting settlement events (pub/sub over the matching loop).
- **Matching engine worker** `#12`
  - Frontend: "matching" phase animates while a batch runs.
  - Backend: scheduled batch auction that reads revealed orders, computes a clearing price, writes `settlements`.
- **Price-oracle aggregator** `#13`
  - Frontend: 24h sparkline on each marketplace card.
  - Backend: worker aggregating clearing prices into `market_prices` on an interval.
- **Provider onboarding** `#14`
  - Frontend: provider registration form (GPU type, capacity, stake).
  - Backend: `POST /api/providers` writing to the `providers` table (auth-gated).
- **Paper-trading mode** `#15`
  - Frontend: walletless "practice" toggle with a weekly leaderboard.
  - Backend: `paper_orders` table + `GET /api/leaderboard`.

## Wave 4 — Business / agent tier

- **API-key management UI** `#16`
  - Frontend: generate/list/revoke keys in `/settings` (plaintext shown once).
  - Backend: `POST/GET/DELETE /api/keys` using `generateApiKey()` + `api_keys` table.
- **Tier resolution from on-chain $OBSC** `#17`
  - Frontend: show current tier + rate limit in agent mode.
  - Backend: resolve `tier_cache` from on-chain $OBSC balance (5-min cache) instead of a static default.
- **Rate limiting middleware** `#18`
  - Frontend: surface 429s gracefully with retry-after.
  - Backend: per-IP (anonymous 60/min) and per-key tier limits (`TIER_LIMITS`) middleware.
- **SAS agent passports** `#19`
  - Frontend: agent passport status + policy (spend caps, daily limits) in `/agent`.
  - Backend: `agent_passports` read/write + policy enforcement on the order API.
- **Reputation ledger** `#20`
  - Frontend: reputation score (0–100) with signal ratio in agent mode.
  - Backend: reputation indexer worker updating scores from on-chain events with decay.

## Wave 5 — Scale + ecosystem

- **Redis cache + pub/sub** `#21`
  - Frontend: no change.
  - Backend: add Redis for tier cache + live-fill pub/sub (replace in-process state).
- **OpenAPI docs** `#22`
  - Frontend: link to `/api/v1/docs` from the footer.
  - Backend: generate an OpenAPI spec from the routes and serve a Scalar UI.
- **GPU cost calculator** `#23`
  - Frontend: walletless Obscura-vs-AWS/GCP calculator on a `/calculator` page.
  - Backend: `GET /api/market/compare` returning hyperscaler reference prices.
- **Agent MCP skill** `#24`
  - Frontend: docs page describing the MCP/programmatic surface.
  - Backend: publish an MCP descriptor + discovery metadata for the agent order API.
- **$OBSC staking dashboard** `#25`
  - Frontend: staking/yield view (USDC revenue share, buyback & burn stats).
  - Backend: `GET /api/staking/stats` — requires the staking program/token address (blocked until token live).

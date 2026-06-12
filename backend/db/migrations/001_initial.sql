-- Obscura initial schema.
-- Public-safe by design: the pool/settlement tables store only aggregate or
-- referenceable data — never spend keys, secrets, or anything that would
-- deanonymise a user. Private material stays client-side.
--
-- Time-series tables (orders, settlements, market_prices) are written here as
-- plain Postgres tables so the project deploys on any managed Postgres. If the
-- TimescaleDB extension is available, convert them to hypertables (see the
-- commented SELECT create_hypertable(...) lines at the bottom).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wallet-is-identity. Pseudonymous; no KYC.
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet         TEXT NOT NULL UNIQUE,
  handle         TEXT,
  last_signed_in TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commit-reveal orders. `commit_hash` is the only thing known before reveal.
CREATE TABLE IF NOT EXISTS orders (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet      TEXT NOT NULL,
  gpu_type    TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  revealed    BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'committed'
              CHECK (status IN ('committed','revealed','matched','settled','cancelled')),
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, ts)
);
CREATE INDEX IF NOT EXISTS orders_ts_idx ON orders (ts DESC);
CREATE INDEX IF NOT EXISTS orders_wallet_idx ON orders (wallet, ts DESC);
CREATE INDEX IF NOT EXISTS orders_gpu_idx ON orders (gpu_type, ts DESC);

-- Batch settlements — public-safe aggregates only.
CREATE TABLE IF NOT EXISTS settlements (
  ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id       BIGINT NOT NULL,
  gpu_type       TEXT NOT NULL,
  clearing_price NUMERIC(18,6) NOT NULL,
  fill_count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (batch_id, gpu_type, ts)
);
CREATE INDEX IF NOT EXISTS settlements_ts_idx ON settlements (ts DESC);

-- Clearing-price oracle, one row per gpu_type per tick.
CREATE TABLE IF NOT EXISTS market_prices (
  ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
  gpu_type       TEXT NOT NULL,
  clearing_price NUMERIC(18,6) NOT NULL,
  PRIMARY KEY (gpu_type, ts)
);
CREATE INDEX IF NOT EXISTS market_prices_ts_idx ON market_prices (ts DESC);

-- GPU providers / node operators. Stake is collateral; slashable for dishonesty.
CREATE TABLE IF NOT EXISTS providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet       TEXT NOT NULL,
  gpu_type     TEXT NOT NULL,
  capacity     INTEGER NOT NULL DEFAULT 0,
  stake_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','paused','slashed')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS providers_gpu_idx ON providers (gpu_type);

-- SAS agent passports — pseudonymous, owner-revocable programmatic access.
CREATE TABLE IF NOT EXISTS agent_passports (
  wallet          TEXT PRIMARY KEY,
  sas_attestation TEXT NOT NULL,
  policy_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys: only the SHA-256 hash is stored; plaintext is shown once.
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash     TEXT PRIMARY KEY,
  owner_wallet TEXT NOT NULL,
  tier_cache   TEXT NOT NULL DEFAULT 'anonymous',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_owner_idx ON api_keys (owner_wallet);

-- Single-use SIWS nonces, consumed on verify.
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      TEXT PRIMARY KEY,
  wallet     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed   BOOLEAN NOT NULL DEFAULT FALSE
);

-- --- TimescaleDB (optional) -------------------------------------------------
-- If the timescaledb extension is installed, uncomment to use hypertables:
-- CREATE EXTENSION IF NOT EXISTS timescaledb;
-- SELECT create_hypertable('orders', 'ts', if_not_exists => TRUE, migrate_data => TRUE);
-- SELECT create_hypertable('settlements', 'ts', if_not_exists => TRUE, migrate_data => TRUE);
-- SELECT create_hypertable('market_prices', 'ts', if_not_exists => TRUE, migrate_data => TRUE);

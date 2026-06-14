-- Add hourly rate and ping tracking to providers
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS rate_micro BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_pings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_pings INTEGER NOT NULL DEFAULT 0;

-- Add matching details to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_provider_wallet TEXT,
  ADD COLUMN IF NOT EXISTS clearing_price NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS hours INTEGER;

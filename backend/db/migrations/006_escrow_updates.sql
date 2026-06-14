-- Add lease tracking columns for escrow payments to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS lease_started_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payouts_completed INTEGER NOT NULL DEFAULT 0;

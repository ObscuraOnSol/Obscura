-- Price Alerts schema for Wave 2
CREATE TABLE IF NOT EXISTS price_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet         TEXT NOT NULL,
  gpu_type       TEXT NOT NULL,
  target_price   NUMERIC(18,6) NOT NULL,
  network        TEXT NOT NULL DEFAULT 'devnet',
  is_triggered   BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_alerts_wallet_idx ON price_alerts (wallet);
CREATE INDEX IF NOT EXISTS price_alerts_gpu_idx ON price_alerts (gpu_type, is_triggered);

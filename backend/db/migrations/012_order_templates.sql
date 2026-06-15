-- Order templates (saved GPU / price / qty presets) for Wave 2 (#9)
CREATE TABLE IF NOT EXISTS order_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet      TEXT NOT NULL,
  name        TEXT NOT NULL,
  gpu_type    TEXT NOT NULL,
  price_micro BIGINT NOT NULL,
  qty         INTEGER NOT NULL,
  network     TEXT NOT NULL DEFAULT 'devnet',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_templates_wallet_idx ON order_templates (wallet, network);

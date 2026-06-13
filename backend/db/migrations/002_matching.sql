-- Ephemeral matching intents.
--
-- When an order is revealed, its price/qty live here ONLY for the batch window
-- so the matching engine can clear a price. Filled intents are deleted on
-- settlement; the public `settlements` table keeps aggregate data only. This
-- keeps per-user price/size out of any durable, public-safe table.

CREATE TABLE IF NOT EXISTS order_intents (
  order_id    UUID PRIMARY KEY,
  wallet      TEXT NOT NULL,
  gpu_type    TEXT NOT NULL,
  price_micro BIGINT NOT NULL,
  qty         INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_intents_gpu_idx ON order_intents (gpu_type);

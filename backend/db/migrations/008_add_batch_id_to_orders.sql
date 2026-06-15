-- Add batch_id to orders to associate filled orders with their settlement batch
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS batch_id BIGINT;

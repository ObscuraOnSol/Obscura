-- Obscura dev seed — populates public-safe market data so the dashboard and
-- marketplace show real, end-to-end data. Idempotent: re-running replaces the
-- seeded market data and the demo wallet's orders, and never touches orders
-- created by real wallets.

-- 1. Clearing-price oracle: a tick every 15 min for the last 3 hours.
DELETE FROM market_prices;
INSERT INTO market_prices (ts, gpu_type, clearing_price)
SELECT
  now() - (g || ' minutes')::interval,
  x.gpu,
  round((x.base * (1 + (random() - 0.5) * 0.06))::numeric, 6)
FROM generate_series(0, 180, 15) AS g
CROSS JOIN (VALUES
  ('H100 80GB', 1.86),
  ('A100 80GB', 0.94),
  ('RTX 4090', 0.32),
  ('L40S', 0.68)
) AS x(gpu, base);

-- 2. GPU providers / node operators.
DELETE FROM providers;

-- 3. Recent batch settlements (one batch per GPU every ~45s, last 12 batches).
DELETE FROM settlements;
INSERT INTO settlements (ts, batch_id, gpu_type, clearing_price, fill_count)
SELECT
  now() - (b * 45 || ' seconds')::interval,
  100000 - b,
  x.gpu,
  round((x.base * (1 + (random() - 0.5) * 0.04))::numeric, 6),
  (random() * 6 + 1)::int
FROM generate_series(0, 11) AS b
CROSS JOIN (VALUES
  ('H100 80GB', 1.86),
  ('A100 80GB', 0.94),
  ('RTX 4090', 0.32),
  ('L40S', 0.68)
) AS x(gpu, base);

-- 4. A few demo orders under a fixed seed wallet (for /api/orders/metrics).
DELETE FROM orders WHERE wallet = 'SEED00000000000000000000000000000000000000';
INSERT INTO orders (wallet, gpu_type, commit_hash, revealed, status, ts)
VALUES
  ('SEED00000000000000000000000000000000000000', 'H100 80GB', repeat('a', 64), TRUE,  'settled',   now() - interval '40 minutes'),
  ('SEED00000000000000000000000000000000000000', 'H100 80GB', repeat('b', 64), TRUE,  'matched',   now() - interval '20 minutes'),
  ('SEED00000000000000000000000000000000000000', 'A100 80GB', repeat('c', 64), TRUE,  'settled',   now() - interval '32 minutes'),
  ('SEED00000000000000000000000000000000000000', 'A100 80GB', repeat('d', 64), FALSE, 'committed', now() - interval '3 minutes'),
  ('SEED00000000000000000000000000000000000000', 'RTX 4090', repeat('e', 64), TRUE,  'revealed',  now() - interval '1 minute'),
  ('SEED00000000000000000000000000000000000000', 'RTX 4090', repeat('f', 64), TRUE,  'settled',   now() - interval '50 minutes'),
  ('SEED00000000000000000000000000000000000000', 'L40S', repeat('1', 64), TRUE, 'settled',  now() - interval '12 minutes'),
  ('SEED00000000000000000000000000000000000000', 'L40S', repeat('2', 64), FALSE, 'committed', now() - interval '2 minutes');

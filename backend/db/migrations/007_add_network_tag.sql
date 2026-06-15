-- Add network column to database tables to support multiple networks simultaneously
ALTER TABLE orders ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'devnet';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'devnet';
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'devnet';
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'devnet';

-- Duplicate the 6 specific team-provided compute nodes for mainnet, so they are immediately rentable
INSERT INTO providers (wallet, gpu_type, capacity, stake_amount, status, host, port, username, password, rate_micro, network)
SELECT wallet, gpu_type, capacity, stake_amount, status, host, port, username, password, rate_micro, 'mainnet'
FROM providers
WHERE gpu_type IN (
  'HP ProLiant DL385 Gen11 (Dual AMD EPYC)',
  'AMD EPYC 7543 (32-Core)',
  'Dell PowerEdge R740 Server (Dual Intel Xeon)',
  'Intel Arc A580 8GB',
  'AMD Ryzen 9 7950X3D',
  'NVIDIA RTX 4090 24GB'
)
AND NOT EXISTS (
  SELECT 1 FROM providers p2
  WHERE p2.gpu_type = providers.gpu_type 
    AND p2.network = 'mainnet'
);

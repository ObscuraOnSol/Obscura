-- Add connection columns to providers table
ALTER TABLE providers 
  ADD COLUMN IF NOT EXISTS host TEXT,
  ADD COLUMN IF NOT EXISTS port TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Add connection columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_host TEXT,
  ADD COLUMN IF NOT EXISTS assigned_port TEXT,
  ADD COLUMN IF NOT EXISTS assigned_username TEXT,
  ADD COLUMN IF NOT EXISTS assigned_password TEXT;

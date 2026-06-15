-- Add is_paper flag to users for Paper Trading Mode
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT FALSE;

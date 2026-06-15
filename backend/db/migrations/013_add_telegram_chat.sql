-- Telegram link for fill receipts (#10).
-- chat_id is captured when the user /starts the bot with their one-time link code.
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;

CREATE INDEX IF NOT EXISTS users_telegram_link_code_idx ON users (telegram_link_code);

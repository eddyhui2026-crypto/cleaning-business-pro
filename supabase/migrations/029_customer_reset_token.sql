-- Add reset token fields for customer password reset flow
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_reset_token
  ON customer_profiles(reset_token);


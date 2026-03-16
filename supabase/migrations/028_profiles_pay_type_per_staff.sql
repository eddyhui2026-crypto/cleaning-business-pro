-- Per-staff default pay (used when job does not set pay). Company default used when staff has no setting.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pay_type TEXT CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS pay_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS pay_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS pay_fixed_amount NUMERIC;

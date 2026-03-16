-- Company defaults for cleaner pay (used when job does not override)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_pay_type TEXT NOT NULL DEFAULT 'hourly' CHECK (default_pay_type IN ('hourly', 'percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS default_pay_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS default_fixed_pay NUMERIC;

-- Per-job pay type and values (null = use company default)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS pay_type TEXT CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS pay_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS pay_percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS pay_fixed_amount NUMERIC;

-- Stored cleaner pay per attendance (calculated when job completed or on demand; owner can override)
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS cleaner_pay NUMERIC;

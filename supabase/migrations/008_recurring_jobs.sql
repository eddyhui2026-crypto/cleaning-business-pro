-- =============================================================================
-- Recurring jobs: templates + link from jobs to recurring schedule
-- =============================================================================

CREATE TABLE IF NOT EXISTS recurring_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_template_name TEXT NOT NULL,
  address TEXT,
  repeat_type TEXT NOT NULL CHECK (repeat_type IN ('weekly', 'biweekly', 'monthly')),
  repeat_interval INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  preferred_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_company_id ON recurring_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_start_end ON recurring_jobs(start_date, end_date);

-- Link generated jobs to their recurring template (for duplicate check)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurring_job_id UUID REFERENCES recurring_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_recurring_job_id ON jobs(recurring_job_id);

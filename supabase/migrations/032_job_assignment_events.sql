-- Records when a staff member accepts/declines a job assignment.
-- Used for: (1) admin push notifications + (2) Dashboard yellow prompts.

CREATE TABLE IF NOT EXISTS job_assignment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_status TEXT NOT NULL CHECK (response_status IN ('accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_assignment_events_company_id_created_at
  ON job_assignment_events(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_assignment_events_job_id
  ON job_assignment_events(job_id);


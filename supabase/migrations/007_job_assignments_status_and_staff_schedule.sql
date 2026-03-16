-- =============================================================================
-- Job scheduling: job_assignments status + staff_schedule
-- =============================================================================

-- job_assignments: add assigned_at and status (assigned | accepted | declined | completed)
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'assigned';

-- Allow only specified status values
ALTER TABLE job_assignments DROP CONSTRAINT IF EXISTS job_assignments_status_check;
ALTER TABLE job_assignments ADD CONSTRAINT job_assignments_status_check
  CHECK (status IN ('assigned', 'accepted', 'declined', 'completed'));

-- Backfill existing rows
UPDATE job_assignments SET status = 'assigned' WHERE status IS NULL OR status = '';

-- staff_schedule: staff work windows (for conflict detection / availability)
CREATE TABLE IF NOT EXISTS staff_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_staff_date ON staff_schedule(staff_id, work_date);

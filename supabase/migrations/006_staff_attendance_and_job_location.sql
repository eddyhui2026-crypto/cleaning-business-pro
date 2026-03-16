-- =============================================================================
-- GPS Clock In/Out + Timesheet: job location, start_time, staff_attendance
-- =============================================================================

-- Jobs: add location and optional scheduled start time for late_minutes calculation
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS job_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS job_start_time TIMESTAMPTZ;

COMMENT ON COLUMN jobs.job_start_time IS 'Optional job start time; if staff clocks in before this, late_minutes can be 0 or calculated.';
COMMENT ON COLUMN jobs.job_latitude IS 'Job location latitude for GPS clock-in radius check (≤100m).';
COMMENT ON COLUMN jobs.job_longitude IS 'Job location longitude for GPS clock-in radius check.';

-- Staff attendance: one row per clock-in/clock-out per staff per job per day
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  total_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'clocked_in', 'clocked_out')),
  late_minutes NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_job_id ON staff_attendance(job_id);
-- Index on clock_in_time supports date-range queries (e.g. WHERE clock_in_time >= date AND clock_in_time < date+1)
CREATE INDEX IF NOT EXISTS idx_staff_attendance_clock_in_time ON staff_attendance(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(staff_id, clock_in_time) WHERE status IN ('clocked_in', 'clocked_out');

-- Trigger for updated_at
CREATE TRIGGER staff_attendance_updated_at
  BEFORE UPDATE ON staff_attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

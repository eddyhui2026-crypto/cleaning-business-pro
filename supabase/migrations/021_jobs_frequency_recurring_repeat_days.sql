-- Jobs: optional frequency display and recurring flag (unified Add New Job)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

-- Recurring templates: which days of week to repeat (0=Sun, 1=Mon, ... 6=Sat). NULL = use start_date weekday only.
ALTER TABLE recurring_jobs
  ADD COLUMN IF NOT EXISTS repeat_days INTEGER[];

COMMENT ON COLUMN recurring_jobs.repeat_days IS 'For weekly: only generate on these weekdays (0-6). NULL = every interval from start_date.';

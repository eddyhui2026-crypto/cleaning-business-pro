-- =============================================================================
-- Recurring jobs: optional start_time / end_time (local time of day)
-- =============================================================================

ALTER TABLE recurring_jobs
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- Existing rows will continue to use the application default (09:00) when
-- start_time is NULL. New rows can set explicit times like '08:30', '18:00', etc.


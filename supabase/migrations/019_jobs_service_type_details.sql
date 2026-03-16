-- Jobs: link to service type and store structured pricing details
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';


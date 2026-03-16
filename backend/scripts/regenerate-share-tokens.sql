-- Regenerate share_token for jobs (missing or expired)
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run

-- 1. Ensure uuid-ossp extension is enabled (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Generate new share_token for jobs that need it
--    - share_token IS NULL (never set or legacy data)
--    - created_at older than 30 days (expired report links get a fresh token)
UPDATE jobs
SET share_token = uuid_generate_v4()
WHERE share_token IS NULL
   OR created_at < NOW() - INTERVAL '30 days';

-- Optional: see how many rows were updated
-- SELECT COUNT(*) FROM jobs WHERE share_token IS NOT NULL;

-- =============================================================================
-- SEED: One test company per plan (Starter, Standard, Premium) + jobs
-- After running: create Auth users in Supabase Dashboard, then link owner_id
--   and insert profiles (see RUN.md).
-- =============================================================================

-- Ensure share_tokens for any existing jobs (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Starter company: plan = starter (limits 20 staff, 100 jobs)
INSERT INTO companies (id, name, plan, subscription_status, trial_ends_at)
VALUES
  ('a0000001-0001-4000-8000-000000000001', 'Starter Clean Co', 'starter', 'trialing', NOW() + INTERVAL '14 days'),
  ('a0000002-0002-4000-8000-000000000002', 'Standard Clean Ltd', 'standard', 'trialing', NOW() + INTERVAL '14 days'),
  ('a0000003-0003-4000-8000-000000000003', 'Premium Clean Pro', 'premium', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

-- Jobs for Starter (5 jobs). Run this migration once; re-run 001_drop + 002_schema + 003 to reset.
INSERT INTO jobs (company_id, client_name, address, scheduled_at, status, price, notes)
SELECT 'a0000001-0001-4000-8000-000000000001', 'Client ' || i, 'Address ' || i, NOW() + (i || ' days')::INTERVAL, 'pending', '25.00', 'Seed job ' || i
FROM generate_series(1, 5) i;

INSERT INTO jobs (company_id, client_name, address, scheduled_at, status, price, notes)
SELECT 'a0000002-0002-4000-8000-000000000002', 'Client S' || i, 'Address S' || i, NOW() + (i || ' days')::INTERVAL, CASE WHEN i <= 3 THEN 'completed' ELSE 'pending' END, '30.00', 'Seed standard ' || i
FROM generate_series(1, 10) i;

INSERT INTO jobs (company_id, client_name, address, scheduled_at, status, price, notes)
SELECT 'a0000003-0003-4000-8000-000000000003', 'Client P' || i, 'Address P' || i, NOW() + (i || ' days')::INTERVAL, CASE WHEN i <= 5 THEN 'completed' ELSE 'in_progress' END, '50.00', 'Seed premium ' || i
FROM generate_series(1, 15) i;

-- Backfill share_token for any job that has NULL (e.g. if jobs inserted without default)
UPDATE jobs SET share_token = uuid_generate_v4() WHERE share_token IS NULL;

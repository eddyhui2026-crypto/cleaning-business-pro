-- =============================================================================
-- SAFE DROP: Remove tables in reverse dependency order (multi-tenant cleaning app)
-- Run in Supabase SQL Editor. Tables recreated in 002_schema.sql
-- =============================================================================

DROP TABLE IF EXISTS job_assignments CASCADE;
DROP TABLE IF EXISTS job_photos CASCADE;
DROP TABLE IF EXISTS job_checklists CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

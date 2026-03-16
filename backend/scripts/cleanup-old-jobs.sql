-- =============================================================================
-- Data retention
-- - Job PHOTOS: 90 days (3 months), in line with UK cleaning apps (e.g. My Cleaning App).
--   Use this to clear photo URLs from jobs and free storage.
-- - Full job RECORDS: 6 years (HMRC). Optional; run only if you need to delete
--   very old jobs entirely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Clear job photos (before_photos, after_photos) for jobs older than 90 days
--    Does NOT delete the job; only clears the photo URL arrays.
--    Run this regularly to match "photos kept 3 months" policy.
-- -----------------------------------------------------------------------------
-- UPDATE jobs
-- SET before_photos = '[]', after_photos = '[]', updated_at = NOW()
-- WHERE scheduled_at < NOW() - INTERVAL '90 days'
--   AND (before_photos != '[]' OR after_photos != '[]');

-- Preview: count jobs that would have photos cleared
SELECT COUNT(*) AS jobs_with_photos_to_clear
FROM jobs
WHERE scheduled_at < NOW() - INTERVAL '90 days'
  AND (before_photos != '[]'::jsonb OR after_photos != '[]'::jsonb);

-- Note: Files in Supabase Storage (buckets "job-photos", "cleaning-photos")
-- are not removed by the above. Delete objects in the bucket for paths
-- older than 90 days (e.g. job-photos/<job_id>/...) via Storage API or dashboard.

-- -----------------------------------------------------------------------------
-- 2. Optional: delete entire jobs older than 6 years (HMRC record retention)
--    CASCADE will remove job_assignments, job_checklists, job_photos table rows.
-- -----------------------------------------------------------------------------
-- DELETE FROM jobs WHERE scheduled_at < NOW() - INTERVAL '6 years';

-- SELECT COUNT(*) AS would_delete FROM jobs WHERE scheduled_at < NOW() - INTERVAL '6 years';

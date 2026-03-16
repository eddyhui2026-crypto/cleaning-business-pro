/**
 * Clear job photos older than 90 days (DB + optional Storage).
 * Run daily via cron or POST /api/admin/cleanup-old-photos.
 */
import { supabase } from '../lib/supabaseClient';

const PHOTO_RETENTION_DAYS = 90;

function getCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - PHOTO_RETENTION_DAYS);
  return d.toISOString();
}

async function deleteStorageFolder(bucket: string, prefix: string): Promise<number> {
  const { data: files, error: listErr } = await supabase.storage.from(bucket).list(prefix);
  if (listErr || !files?.length) return 0;
  const paths = files.map((f) => (prefix ? `${prefix}/${f.name}` : f.name));
  const { error: removeErr } = await supabase.storage.from(bucket).remove(paths);
  if (removeErr) {
    console.warn('cleanupOldJobPhotos: storage remove failed', bucket, prefix, removeErr.message);
    return 0;
  }
  return paths.length;
}

export async function cleanupOldJobPhotos(): Promise<{ jobsUpdated: number; storageDeleted: number }> {
  const cutoff = getCutoffDate();
  let jobsUpdated = 0;
  let storageDeleted = 0;

  // 1. Find jobs older than 90 days and which have photos
  const { data: oldJobs, error: fetchErr } = await supabase
    .from('jobs')
    .select('id, before_photos, after_photos')
    .lt('scheduled_at', cutoff);

  if (fetchErr) {
    console.error('cleanupOldJobPhotos: fetch jobs failed', fetchErr);
    return { jobsUpdated: 0, storageDeleted: 0 };
  }

  const idsToClear = (oldJobs || []).filter((j: any) => {
    const before = j.before_photos;
    const after = j.after_photos;
    const beforeLen = Array.isArray(before) ? before.length : 0;
    const afterLen = Array.isArray(after) ? after.length : 0;
    return beforeLen > 0 || afterLen > 0;
  }).map((j: any) => j.id);

  if (idsToClear.length === 0) return { jobsUpdated: 0, storageDeleted: 0 };

  // 3. Clear photo URLs in DB (batch update per id to avoid huge payload)
  for (const id of idsToClear) {
    const { error: upErr } = await supabase
      .from('jobs')
      .update({ before_photos: [], after_photos: [], updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!upErr) jobsUpdated++;
  }

  // 4. Optionally delete files from Storage (buckets: job-photos, cleaning-photos)
  for (const jobId of idsToClear) {
    try {
      storageDeleted += await deleteStorageFolder('job-photos', jobId);
      storageDeleted += await deleteStorageFolder('cleaning-photos', `job-photos/${jobId}`);
    } catch (e) {
      // Bucket may not exist or names may differ; ignore
    }
  }

  if (jobsUpdated > 0) {
    console.log('cleanupOldJobPhotos: cleared photos for', jobsUpdated, 'jobs, deleted', storageDeleted, 'storage files');
  }
  return { jobsUpdated, storageDeleted };
}

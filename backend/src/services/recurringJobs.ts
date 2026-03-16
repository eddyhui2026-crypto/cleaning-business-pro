import { supabase } from '../lib/supabaseClient';

const DEFAULT_JOB_HOUR = 9; // 09:00 local when creating from recurring

/** Returns YYYY-MM-DD for server local date. */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of calendar days between two YYYY-MM-DD strings. */
function daysBetween(a: string, b: string): number {
  const t = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(t / (24 * 60 * 60 * 1000));
}

/** True if this recurring row should generate a job on todayStr (YYYY-MM-DD). repeat_days: 0=Sun..6=Sat, only for weekly. */
function matchesToday(row: {
  start_date: string;
  end_date: string | null;
  repeat_type: string;
  repeat_interval: number;
  repeat_days?: number[] | null;
}, todayStr: string): boolean {
  if (row.start_date > todayStr) return false;
  if (row.end_date != null && row.end_date < todayStr) return false;

  const days = daysBetween(row.start_date, todayStr);
  const dayOfWeek = new Date(todayStr + 'T12:00:00').getDay(); // 0=Sun .. 6=Sat

  switch (row.repeat_type) {
    case 'weekly': {
      if (row.repeat_days != null && row.repeat_days.length > 0) {
        return row.repeat_days.includes(dayOfWeek);
      }
      return days % (7 * Math.max(1, row.repeat_interval)) === 0;
    }
    case 'biweekly':
      return days % 14 === 0;
    case 'monthly': {
      const start = new Date(row.start_date);
      const today = new Date(todayStr);
      if (start.getUTCDate() !== today.getUTCDate()) return false;
      const months =
        (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (today.getUTCMonth() - start.getUTCMonth());
      return months >= 0 && months % Math.max(1, row.repeat_interval) === 0;
    }
    default:
      return false;
  }
}

/**
 * Find recurring_jobs that match today, create jobs (and job_assignments if preferred_staff_id).
 * Skips creation if a job already exists for that recurring_job_id and date (STEP 8).
 */
export async function generateRecurringJobs(companyFilter?: string): Promise<void> {
  const today = new Date();
  const todayStr = toDateStr(today);

  let query = supabase
    .from('recurring_jobs')
    .select('id, company_id, job_template_name, address, preferred_staff_id, start_date, end_date, repeat_type, repeat_interval, repeat_days, start_time, end_time')
    .lte('start_date', todayStr);

  if (companyFilter) {
    query = query.eq('company_id', companyFilter);
  }

  const { data: rows, error: fetchErr } = await query;

  if (fetchErr) {
    console.error('generateRecurringJobs: fetch recurring_jobs', fetchErr);
    return;
  }

  const candidates = (rows ?? []).filter((r: any) => {
    const end = (r as any).end_date ?? null;
    if (end != null && end < todayStr) return false;
    return matchesToday(
      {
        start_date: (r as any).start_date,
        end_date: end,
        repeat_type: (r as any).repeat_type,
        repeat_interval: (r as any).repeat_interval ?? 1,
        repeat_days: (r as any).repeat_days ?? null,
      },
      todayStr
    );
  });

  for (const row of candidates) {
    const recurringJobId = (row as any).id;
    const companyId = (row as any).company_id;
    const jobTemplateName = (row as any).job_template_name;
    const address = (row as any).address ?? null;
    const preferredStaffId = (row as any).preferred_staff_id ?? null;

    // Determine start time for today's job
    let hour = DEFAULT_JOB_HOUR;
    let minute = 0;
    const startTime = (row as any).start_time as string | null;
    if (startTime) {
      const [h, m] = startTime.split(':').map((v) => Number(v) || 0);
      hour = Number.isFinite(h) ? h : DEFAULT_JOB_HOUR;
      minute = Number.isFinite(m) ? m : 0;
    }
    const scheduledAt = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hour,
      minute,
      0,
      0
    );

    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('recurring_job_id', recurringJobId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    const repeatType = (row as any).repeat_type as string;
    const { data: newJob, error: insertJobErr } = await supabase
      .from('jobs')
      .insert({
        company_id: companyId,
        client_name: jobTemplateName,
        address,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        recurring_job_id: recurringJobId,
        is_recurring: true,
        frequency: repeatType || null,
      })
      .select('id')
      .single();

    if (insertJobErr) {
      console.error('generateRecurringJobs: insert job', insertJobErr);
      continue;
    }

    if (preferredStaffId && newJob?.id) {
      await supabase.from('job_assignments').insert({
        job_id: newJob.id,
        staff_id: preferredStaffId,
        status: 'assigned',
      });
    }
  }
}

/**
 * Generate jobs for a single recurring template for the next `daysAhead` days (including today).
 * Used when a recurring job is first created so the owner can immediately see upcoming work in the Schedule.
 */
export async function generateJobsForRecurringTemplate(
  recurringJobId: string,
  companyId: string,
  daysAhead = 28
): Promise<void> {
  const today = new Date();
  const end = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const startStr = toDateStr(today);
  const endStr = toDateStr(end);

  const { data: row, error } = await supabase
    .from('recurring_jobs')
    .select('id, company_id, job_template_name, address, preferred_staff_id, start_date, end_date, repeat_type, repeat_interval, repeat_days, start_time, end_time')
    .eq('id', recurringJobId)
    .eq('company_id', companyId)
    .lte('start_date', endStr)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error('generateJobsForRecurringTemplate: fetch recurring', error);
    return;
  }

  const preferredStaffId = (row as any).preferred_staff_id ?? null;
  const jobTemplateName = (row as any).job_template_name;
  const address = (row as any).address ?? null;
  const recurringId = (row as any).id;

  for (let offset = 0; offset < daysAhead; offset++) {
    const d = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    const dateStr = toDateStr(d);
    if (dateStr < startStr) continue;

    const shouldCreate = matchesToday(
      {
        start_date: (row as any).start_date,
        end_date: (row as any).end_date ?? null,
        repeat_type: (row as any).repeat_type,
        repeat_interval: (row as any).repeat_interval ?? 1,
        repeat_days: (row as any).repeat_days ?? null,
      },
      dateStr
    );
    if (!shouldCreate) continue;

    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('recurring_job_id', recurringId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    let hour = DEFAULT_JOB_HOUR;
    let minute = 0;
    const startTime = (row as any).start_time as string | null;
    if (startTime) {
      const [h, m] = startTime.split(':').map((v) => Number(v) || 0);
      hour = Number.isFinite(h) ? h : DEFAULT_JOB_HOUR;
      minute = Number.isFinite(m) ? m : 0;
    }

    const scheduledAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0);

    const repeatType = (row as any).repeat_type as string;
    const { data: newJob, error: insertJobErr } = await supabase
      .from('jobs')
      .insert({
        company_id: companyId,
        client_name: jobTemplateName,
        address,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        recurring_job_id: recurringId,
        is_recurring: true,
        frequency: repeatType || null,
      })
      .select('id')
      .single();

    if (insertJobErr) {
      console.error('generateJobsForRecurringTemplate: insert job', insertJobErr);
      continue;
    }

    if (preferredStaffId && newJob?.id) {
      await supabase.from('job_assignments').insert({
        job_id: newJob.id,
        staff_id: preferredStaffId,
        status: 'assigned',
      });
    }
  }
}

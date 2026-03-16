import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { ensureCustomerForCompany, sendWelcomeEmail } from '../services/customerService';
import { notifyCustomer } from '../services/pushNotificationService';
import { generateRecurringJobs, generateJobsForRecurringTemplate } from '../services/recurringJobs';
import { UK_STANDARD_SERVICES, BOOKING_DEFAULT_SERVICES } from '../constants/services';
import { roundHoursForPayroll } from '../lib/payrollRound';
import { calculateCleanerPayForJob } from '../services/cleanerPay';
import { generatePayrollReportPdf, generatePayslipsPdf } from '../services/payrollPdf';
import { cleanupOldJobPhotos } from '../services/cleanupOldJobPhotos';

const router = Router();

async function nextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('company_id', companyId)
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1);
  const last = (data ?? [])[0] as any;
  const lastNum = last?.quote_number ? parseInt(last.quote_number.replace(prefix, ''), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

const REPEAT_TYPES = ['weekly', 'biweekly', 'monthly'] as const;

/** GET /api/admin/recurring-jobs — List recurring jobs for company (admin only). */
router.get('/recurring-jobs', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('recurring_jobs')
      .select(`
        id,
        job_template_name,
        address,
        repeat_type,
        repeat_interval,
        start_date,
        end_date,
        start_time,
        end_time,
        preferred_staff_id,
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const staffIds = [...new Set((data ?? []).map((r: any) => r.preferred_staff_id).filter(Boolean))];
    const { data: profiles } = staffIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', staffIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const list = (data ?? []).map((r: any) => ({
      ...r,
      preferred_staff_name: r.preferred_staff_id ? profileMap.get(r.preferred_staff_id)?.full_name ?? null : null,
    }));

    res.json(list);
  } catch (err: any) {
    console.error('GET recurring-jobs:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/recurring-job — Create recurring job (admin only). */
router.post('/recurring-job', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const {
    job_template_name,
    address,
    repeat_type,
    repeat_interval,
    start_date,
    end_date,
    start_time,
    end_time,
    preferred_staff_id,
    repeat_days,
  } = req.body;

  if (!job_template_name || !repeat_type || !start_date) {
    res.status(400).json({ error: 'job_template_name, repeat_type, and start_date are required' });
    return;
  }
  if (!REPEAT_TYPES.includes(repeat_type)) {
    res.status(400).json({ error: 'repeat_type must be weekly, biweekly, or monthly' });
    return;
  }

  const interval = repeat_interval != null ? Number(repeat_interval) : 1;
  if (!Number.isInteger(interval) || interval < 1) {
    res.status(400).json({ error: 'repeat_interval must be a positive integer' });
    return;
  }

  try {
    const repeatDaysArr =
      repeat_days != null && Array.isArray(repeat_days)
        ? repeat_days.filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
        : null;
    const { data, error } = await supabase
      .from('recurring_jobs')
      .insert({
        company_id: companyId,
        job_template_name: String(job_template_name).trim(),
        address: address != null ? String(address).trim() : null,
        repeat_type,
        repeat_interval: interval,
        start_date,
        end_date: end_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        preferred_staff_id: preferred_staff_id || null,
        repeat_days: repeatDaysArr?.length ? repeatDaysArr : null,
      })
      .select()
      .single();

    if (error) throw error;

    // After creating a recurring template, immediately generate jobs for the next 4 weeks for this template.
    await generateJobsForRecurringTemplate(data.id, companyId, 28);

    res.status(201).json(data);
  } catch (err: any) {
    console.error('POST recurring-job:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/recurring-job/:id — Update recurring job (admin only). */
router.patch('/recurring-job/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const id = req.params.id;
  const {
    job_template_name,
    address,
    repeat_type,
    repeat_interval,
    start_date,
    end_date,
    start_time,
    end_time,
    preferred_staff_id,
    repeat_days,
  } = req.body;

  try {
    const updates: Record<string, unknown> = {};
    if (job_template_name !== undefined) updates.job_template_name = String(job_template_name).trim();
    if (address !== undefined) updates.address = address == null ? null : String(address).trim();
    if (repeat_type !== undefined) {
      if (!REPEAT_TYPES.includes(repeat_type)) {
        res.status(400).json({ error: 'repeat_type must be weekly, biweekly, or monthly' });
        return;
      }
      updates.repeat_type = repeat_type;
    }
    if (repeat_interval !== undefined) {
      const interval = Number(repeat_interval);
      if (!Number.isInteger(interval) || interval < 1) {
        res.status(400).json({ error: 'repeat_interval must be a positive integer' });
        return;
      }
      updates.repeat_interval = interval;
    }
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date || null;
    if (start_time !== undefined) updates.start_time = start_time || null;
    if (end_time !== undefined) updates.end_time = end_time || null;
    if (preferred_staff_id !== undefined) updates.preferred_staff_id = preferred_staff_id || null;
    if (repeat_days !== undefined) {
      const arr =
        repeat_days != null && Array.isArray(repeat_days)
          ? repeat_days.filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
          : null;
      updates.repeat_days = arr?.length ? arr : null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const { data, error } = await supabase
      .from('recurring_jobs')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Recurring job not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    console.error('PATCH recurring-job:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** DELETE /api/admin/recurring-job/:id — Delete recurring job (admin only). */
router.delete('/recurring-job/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const id = req.params.id;
  try {
    const { error } = await supabase
      .from('recurring_jobs')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    console.error('DELETE recurring-job:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/assign-staff — Assign staff to a job (admin only). Inserts job_assignments. Conflict: same staff, same date, another job. */
router.post('/assign-staff', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { job_id, staff_ids: bodyStaffIds } = req.body;
  const staffIds = Array.isArray(bodyStaffIds) ? bodyStaffIds : [];

  if (!job_id || staffIds.length === 0) {
    res.status(400).json({ error: 'job_id and staff_ids array required' });
    return;
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, company_id, scheduled_at')
      .eq('id', job_id)
      .eq('company_id', companyId)
      .single();

    if (jobErr || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const jobDate = new Date(job.scheduled_at).toISOString().slice(0, 10);

    const { data: companyStaff } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['staff', 'supervisor']);
    const allowedIds = new Set((companyStaff ?? []).map((p: any) => p.id));

    for (const sid of staffIds) {
      if (!allowedIds.has(sid)) {
        res.status(400).json({ error: `Staff ${sid} not in your company` });
        return;
      }
    }

    const { data: otherAssignments } = await supabase
      .from('job_assignments')
      .select('staff_id, job_id')
      .in('staff_id', staffIds)
      .neq('job_id', job_id);

    if ((otherAssignments ?? []).length > 0) {
      const otherJobIds = [...new Set((otherAssignments ?? []).map((a: any) => a.job_id))];
      const { data: otherJobs } = await supabase
        .from('jobs')
        .select('id, scheduled_at')
        .in('id', otherJobIds)
        .eq('company_id', companyId);

      const otherByJob = new Map((otherJobs ?? []).map((j: any) => [j.id, j.scheduled_at]));

      for (const a of otherAssignments ?? []) {
        const otherDate = otherByJob.get(a.job_id) ? new Date(otherByJob.get(a.job_id)).toISOString().slice(0, 10) : '';
        if (otherDate === jobDate) {
          res.status(409).json({
            error: 'Staff conflict',
            message: 'One or more staff already have another job on the same date. Remove them or choose a different date.',
          });
          return;
        }
      }
    }

    await supabase.from('job_assignments').delete().eq('job_id', job_id);

    const rows = staffIds.map((staff_id: string) => ({
      job_id,
      staff_id,
      status: 'assigned',
    }));

    const { error: insertErr } = await supabase.from('job_assignments').insert(rows);

    if (insertErr) {
      console.error('assign-staff insert:', insertErr);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.json({ success: true, message: 'Staff assigned' });
  } catch (err: any) {
    console.error('assign-staff error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/attendance — List attendance with filters (admin only). */
router.get('/attendance', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { date_from, date_to, staff_id, job_id, page, page_size } = req.query;

  // Simple pagination with sane defaults
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    // Base query with server-side filters for date/staff/job where possible
    let attQuery = supabase
      .from('staff_attendance')
      .select('*')
      .order('clock_in_time', { ascending: false });

    if (date_from) {
      const from = new Date(date_from as string);
      from.setUTCHours(0, 0, 0, 0);
      attQuery = attQuery.gte('clock_in_time', from.toISOString());
    }
    if (date_to) {
      const to = new Date(date_to as string);
      to.setUTCHours(23, 59, 59, 999);
      attQuery = attQuery.lte('clock_in_time', to.toISOString());
    }
    if (staff_id) attQuery = attQuery.eq('staff_id', staff_id as string);
    if (job_id) attQuery = attQuery.eq('job_id', job_id as string);

    attQuery = attQuery.range(fromIndex, toIndex);

    const { data: attendances, error: attErr } = await attQuery;

    if (attErr) throw attErr;

    const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
    const jobIds = [...new Set((attendances ?? []).map((a: any) => a.job_id))];

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_id').in('id', staffIds);
    const { data: jobs } = await supabase.from('jobs').select('id, client_name, company_id').in('id', jobIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j]));

    let list = (attendances ?? []).filter((a: any) => {
      const p = profileMap.get(a.staff_id);
      const j = jobMap.get(a.job_id);
      return p?.company_id === companyId && j?.company_id === companyId;
    });

    const result = list.map((a: any) => ({
      id: a.id,
      staff_id: a.staff_id,
      staff_name: profileMap.get(a.staff_id)?.full_name ?? 'Unknown',
      job_id: a.job_id,
      job_name: jobMap.get(a.job_id)?.client_name ?? 'Unknown',
      clock_in_time: a.clock_in_time,
      clock_out_time: a.clock_out_time,
      clock_in_lat: a.clock_in_lat,
      clock_in_lng: a.clock_in_lng,
      clock_out_lat: a.clock_out_lat,
      clock_out_lng: a.clock_out_lng,
      total_hours: a.total_hours,
      cleaner_pay: a.cleaner_pay != null ? Number(a.cleaner_pay) : null,
      status: a.status,
      late_minutes: a.late_minutes,
    }));

    res.json(result);
  } catch (err: any) {
    console.error('Admin attendance error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/attendance/:id — Admin sets clock-out time (for forgotten/late clock-out). Payroll uses this time for total_hours. */
router.patch('/attendance/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId || !id) {
    res.status(403).json({ error: 'No company or attendance id' });
    return;
  }
  const { clock_out_time: bodyClockOut, cleaner_pay: bodyCleanerPay } = req.body ?? {};
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('staff_attendance')
      .select('id, staff_id, job_id, clock_in_time, clock_out_time, status')
      .eq('id', id)
      .single();
    if (fetchErr || !row) {
      res.status(404).json({ error: 'Attendance not found' });
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', row.staff_id).single();
    const { data: job } = await supabase.from('jobs').select('company_id').eq('id', row.job_id).single();
    if (profile?.company_id !== companyId || job?.company_id !== companyId) {
      res.status(403).json({ error: 'Not your company' });
      return;
    }
    const clockIn = new Date(row.clock_in_time);
    const clockOutTime = bodyClockOut ? new Date(bodyClockOut) : new Date();
    if (clockOutTime.getTime() < clockIn.getTime()) {
      res.status(400).json({ error: 'Clock-out time must be after clock-in' });
      return;
    }
    const rawHours = (clockOutTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    let roundMinutes = 15;
    const { data: companyRow } = await supabase
      .from('companies')
      .select('payroll_round_minutes')
      .eq('id', companyId)
      .maybeSingle();
    const val = (companyRow as any)?.payroll_round_minutes;
    if ([5, 10, 15, 60].includes(Number(val))) roundMinutes = Number(val);
    const totalHours = roundHoursForPayroll(rawHours, roundMinutes);
    const updatePayload: Record<string, unknown> = {
      clock_out_time: clockOutTime.toISOString(),
      total_hours: totalHours,
      status: 'clocked_out',
    };
    if (bodyCleanerPay !== undefined) {
      const v = Number(bodyCleanerPay);
      updatePayload.cleaner_pay = Number.isNaN(v) ? null : Math.round(v * 100) / 100;
    }
    const { data: updated, error: updateErr } = await supabase
      .from('staff_attendance')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    console.error('Admin attendance PATCH error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/payroll-hours — Total hours grouped by staff (admin only). */
router.get('/payroll-hours', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { date_from, date_to } = req.query;

  try {
    const { data: attendances, error: attErr } = await supabase
      .from('staff_attendance')
      .select('staff_id, job_id, total_hours, cleaner_pay, clock_in_time')
      .eq('status', 'clocked_out');

    if (attErr) throw attErr;

    const jobIds = [...new Set((attendances ?? []).map((a: any) => a.job_id))];
    const { data: jobs } = await supabase.from('jobs').select('id, company_id').in('id', jobIds);
    const companyJobIds = new Set((jobs ?? []).filter((j: any) => j.company_id === companyId).map((j: any) => j.id));

    const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_id').in('id', staffIds);
    const inCompany = new Set((profiles ?? []).filter((p: any) => p.company_id === companyId).map((p: any) => p.id));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    let list = (attendances ?? []).filter((a: any) =>
      inCompany.has(a.staff_id) && companyJobIds.has(a.job_id) && a.total_hours != null
    );

    if (date_from) {
      const from = new Date(date_from as string);
      from.setUTCHours(0, 0, 0, 0);
      list = list.filter((a: any) => new Date(a.clock_in_time) >= from);
    }
    if (date_to) {
      const to = new Date(date_to as string);
      to.setUTCHours(23, 59, 59, 999);
      list = list.filter((a: any) => new Date(a.clock_in_time) <= to);
    }

    const byStaff: Record<string, { total_hours: number; total_pay: number }> = {};
    for (const a of list) {
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = { total_hours: 0, total_pay: 0 };
      byStaff[a.staff_id].total_hours += Number(a.total_hours);
      if (a.cleaner_pay != null) byStaff[a.staff_id].total_pay += Number(a.cleaner_pay);
    }

    const result = Object.entries(byStaff).map(([sid, v]) => ({
      staff_id: sid,
      staff_name: profileMap.get(sid)?.full_name ?? 'Unknown',
      total_hours: Math.round(v.total_hours * 100) / 100,
      total_pay: Math.round(v.total_pay * 100) / 100,
    }));

    res.json(result);
  } catch (err: any) {
    console.error('Admin payroll-hours error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/report — Aggregated report data for a period (admin only). Query: date_from, date_to (YYYY-MM-DD). */
router.get('/report', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { date_from, date_to } = req.query;
  if (!companyId || !date_from || !date_to) {
    res.status(400).json({ error: 'date_from and date_to required (YYYY-MM-DD)' });
    return;
  }
  try {
    const from = new Date(date_from as string);
    const to = new Date(date_to as string);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const periodDays = Math.round((toTime - fromTime) / (24 * 60 * 60 * 1000)) + 1;
    const prevTo = new Date(from);
    prevTo.setUTCHours(0, 0, 0, 0);
    prevTo.setUTCDate(prevTo.getUTCDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - periodDays + 1);
    prevFrom.setUTCHours(0, 0, 0, 0);
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const prevToStr = prevTo.toISOString().slice(0, 10);

    async function getPeriodData(dateFromStr: string, dateToStr: string) {
      const dFrom = new Date(dateFromStr);
      const dTo = new Date(dateToStr);
      dFrom.setUTCHours(0, 0, 0, 0);
      dTo.setUTCHours(23, 59, 59, 999);

      const { data: jobs, error: jErr } = await supabase
        .from('jobs')
        .select('id, client_name, status, price, scheduled_at')
        .eq('company_id', companyId)
        .not('scheduled_at', 'is', null);
      if (jErr) throw jErr;
      const jobList = (jobs ?? []).filter((j: any) => {
        const t = new Date(j.scheduled_at).getTime();
        return t >= dFrom.getTime() && t <= dTo.getTime();
      });

      const byStatus: Record<string, { count: number; value: number }> = { pending: { count: 0, value: 0 }, in_progress: { count: 0, value: 0 }, completed: { count: 0, value: 0 }, cancelled: { count: 0, value: 0 } };
      let revenue = 0;
      const customerRevenue: Record<string, number> = {};
      for (const j of jobList) {
        const status = (j.status && byStatus[j.status]) ? j.status : 'pending';
        byStatus[status].count += 1;
        const price = Number(j.price) || 0;
        if (status === 'completed') {
          byStatus[status].value += price;
          revenue += price;
          const name = (j.client_name || 'Unknown').trim() || 'Unknown';
          customerRevenue[name] = (customerRevenue[name] || 0) + price;
        }
      }

      const order: Array<'pending' | 'in_progress' | 'completed' | 'cancelled'> = ['pending', 'in_progress', 'completed', 'cancelled'];
      const labels: Record<string, string> = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
      const jobsByStatus = order.map((status) => {
        const v = byStatus[status] || { count: 0, value: 0 };
        return {
          status: labels[status] || status,
          count: v.count,
          value: v.count ? (v.value > 0 ? `£${Number(v.value).toFixed(2)}` : '—') : '—',
        };
      });

      const topCustomers = Object.entries(customerRevenue)
        .map(([name, value]) => ({ name, jobs: jobList.filter((j: any) => ((j.client_name || '').trim() || 'Unknown') === name && j.status === 'completed').length, revenue: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((c) => ({ name: c.name, jobs: c.jobs, revenue: `£${c.revenue.toFixed(2)}` }));

      const { data: attendances, error: attErr } = await supabase
        .from('staff_attendance')
        .select('staff_id, job_id, total_hours, cleaner_pay, clock_in_time')
        .eq('status', 'clocked_out');
      if (attErr) throw attErr;
      const jobIds = [...new Set((attendances ?? []).map((a: any) => a.job_id))];
      const { data: jobRows } = await supabase.from('jobs').select('id, company_id').in('id', jobIds);
      const companyJobIds = new Set((jobRows ?? []).filter((j: any) => j.company_id === companyId).map((j: any) => j.id));
      const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, company_id').in('id', staffIds);
      const inCompany = new Set((profiles ?? []).filter((p: any) => p.company_id === companyId).map((p: any) => p.id));
      let attList = (attendances ?? []).filter((a: any) => inCompany.has(a.staff_id) && companyJobIds.has(a.job_id) && a.total_hours != null);
      attList = attList.filter((a: any) => {
        const t = new Date(a.clock_in_time).getTime();
        return t >= dFrom.getTime() && t <= dTo.getTime();
      });
      let totalHours = 0;
      let labourCost = 0;
      for (const a of attList) {
        totalHours += Number(a.total_hours) || 0;
        if (a.cleaner_pay != null) labourCost += Number(a.cleaner_pay);
      }
      totalHours = Math.round(totalHours * 100) / 100;
      labourCost = Math.round(labourCost * 100) / 100;

      return {
        revenue: Math.round(revenue * 100) / 100,
        jobsCompleted: byStatus.completed.count,
        jobsByStatus,
        totalHours,
        labourCost,
        netProfit: Math.round((revenue - labourCost) * 100) / 100,
        topCustomers,
      };
    }

    const [current, previous] = await Promise.all([
      getPeriodData((date_from as string).slice(0, 10), (date_to as string).slice(0, 10)),
      getPeriodData(prevFromStr, prevToStr),
    ]);

    res.json({
      date_from: (date_from as string).slice(0, 10),
      date_to: (date_to as string).slice(0, 10),
      prev_date_from: prevFromStr,
      prev_date_to: prevToStr,
      current,
      previous,
    });
  } catch (err: any) {
    console.error('Admin report error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/payroll-report-pdf — PDF summary for accountants (period, staff, hours, pay, total). */
router.get('/payroll-report-pdf', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { date_from, date_to } = req.query;
  if (!companyId || !date_from || !date_to) {
    res.status(400).json({ error: 'date_from and date_to required' });
    return;
  }
  try {
    const { data: company } = await supabase.from('companies').select('name').eq('id', companyId).single();
    const from = new Date(date_from as string);
    const to = new Date(date_to as string);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);

    const { data: attendances } = await supabase
      .from('staff_attendance')
      .select('staff_id, job_id, total_hours, cleaner_pay, clock_in_time')
      .eq('status', 'clocked_out');
    const jobIds = [...new Set((attendances ?? []).map((a: any) => a.job_id))];
    const { data: jobs } = await supabase.from('jobs').select('id, company_id').in('id', jobIds);
    const companyJobIds = new Set((jobs ?? []).filter((j: any) => j.company_id === companyId).map((j: any) => j.id));
    const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_id').in('id', staffIds);
    const inCompany = new Set((profiles ?? []).filter((p: any) => p.company_id === companyId).map((p: any) => p.id));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    let list = (attendances ?? []).filter((a: any) =>
      inCompany.has(a.staff_id) && companyJobIds.has(a.job_id) && a.total_hours != null
    );
    list = list.filter((a: any) => {
      const t = new Date(a.clock_in_time).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });

    const byStaff: Record<string, { total_hours: number; total_pay: number }> = {};
    for (const a of list) {
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = { total_hours: 0, total_pay: 0 };
      byStaff[a.staff_id].total_hours += Number(a.total_hours);
      if (a.cleaner_pay != null) byStaff[a.staff_id].total_pay += Number(a.cleaner_pay);
    }
    const rows = Object.entries(byStaff).map(([sid, v]) => ({
      staff_name: profileMap.get(sid)?.full_name ?? 'Unknown',
      total_hours: Math.round(v.total_hours * 100) / 100,
      total_pay: Math.round(v.total_pay * 100) / 100,
    }));

    const buffer = await generatePayrollReportPdf({
      companyName: (company as any)?.name ?? 'Company',
      dateFrom: (date_from as string).slice(0, 10),
      dateTo: (date_to as string).slice(0, 10),
      rows,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-report-${(date_from as string).slice(0, 10)}-to-${(date_to as string).slice(0, 10)}.pdf`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/payroll-payslips-pdf — One-page payslip per staff for the period. Optional staff_id = only that employee's payslip. */
router.get('/payroll-payslips-pdf', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { date_from, date_to, staff_id: queryStaffId } = req.query;
  if (!companyId || !date_from || !date_to) {
    res.status(400).json({ error: 'date_from and date_to required' });
    return;
  }
  try {
    const { data: company } = await supabase.from('companies').select('name').eq('id', companyId).single();
    const from = new Date(date_from as string);
    const to = new Date(date_to as string);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);

    const { data: attendances } = await supabase
      .from('staff_attendance')
      .select('staff_id, job_id, total_hours, cleaner_pay, clock_in_time')
      .eq('status', 'clocked_out');
    const jobIds = [...new Set((attendances ?? []).map((a: any) => a.job_id))];
    const { data: jobs } = await supabase.from('jobs').select('id, company_id').in('id', jobIds);
    const companyJobIds = new Set((jobs ?? []).filter((j: any) => j.company_id === companyId).map((j: any) => j.id));
    const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_id, pay_type, pay_hourly_rate, pay_percentage, pay_fixed_amount').in('id', staffIds);
    const inCompany = new Set((profiles ?? []).filter((p: any) => p.company_id === companyId).map((p: any) => p.id));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const { data: companyRow } = await supabase.from('companies').select('default_pay_type, default_hourly_rate, default_pay_percentage, default_fixed_pay').eq('id', companyId).single();

    let list = (attendances ?? []).filter((a: any) =>
      inCompany.has(a.staff_id) && companyJobIds.has(a.job_id) && a.total_hours != null
    );
    list = list.filter((a: any) => {
      const t = new Date(a.clock_in_time).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });

    type StaffAcc = { total_hours: number; total_pay: number; daily: { date: string; hours: number; pay: number }[] };
    const byStaff: Record<string, StaffAcc> = {};
    for (const a of list) {
      const dateKey = new Date(a.clock_in_time).toISOString().slice(0, 10);
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = { total_hours: 0, total_pay: 0, daily: [] };
      byStaff[a.staff_id].total_hours += Number(a.total_hours);
      const pay = a.cleaner_pay != null ? Number(a.cleaner_pay) : 0;
      byStaff[a.staff_id].total_pay += pay;
      const dayEntry = byStaff[a.staff_id].daily.find((d) => d.date === dateKey);
      if (dayEntry) {
        dayEntry.hours += Number(a.total_hours);
        dayEntry.pay += pay;
      } else {
        byStaff[a.staff_id].daily.push({ date: dateKey, hours: Number(a.total_hours), pay });
      }
    }
    for (const sid of Object.keys(byStaff)) {
      const acc = byStaff[sid];
      acc.daily.sort((a, b) => a.date.localeCompare(b.date));
      acc.total_hours = Math.round(acc.total_hours * 100) / 100;
      acc.total_pay = Math.round(acc.total_pay * 100) / 100;
      acc.daily.forEach((d) => {
        d.hours = Math.round(d.hours * 100) / 100;
        d.pay = Math.round(d.pay * 100) / 100;
      });
    }

    function payRateLabel(p: any): string {
      const type = p?.pay_type ?? (companyRow as any)?.default_pay_type ?? 'hourly';
      if (type === 'hourly') {
        const rate = p?.pay_hourly_rate ?? (companyRow as any)?.default_hourly_rate;
        return rate != null ? `£${Number(rate).toFixed(2)} per hour` : 'Hourly (rate not set)';
      }
      if (type === 'percentage') {
        const rate = p?.pay_percentage ?? (companyRow as any)?.default_pay_percentage;
        return rate != null ? `${Number(rate)}% of job price` : 'Percentage (rate not set)';
      }
      const rate = p?.pay_fixed_amount ?? (companyRow as any)?.default_fixed_pay;
      return rate != null ? `£${Number(rate).toFixed(2)} per job` : 'Fixed (rate not set)';
    }

    let rows = Object.entries(byStaff).map(([sid, v]) => {
      const p = profileMap.get(sid);
      return {
        staff_name: p?.full_name ?? 'Unknown',
        total_hours: v.total_hours,
        total_pay: v.total_pay,
        dailyBreakdown: v.daily,
        payMethod: (p as any)?.pay_type ?? (companyRow as any)?.default_pay_type ?? 'hourly',
        payRateLabel: payRateLabel(p),
      };
    });
    if (queryStaffId && typeof queryStaffId === 'string') {
      const sid = queryStaffId;
      if (!inCompany.has(sid)) {
        res.status(404).json({ error: 'Staff not found or not in your company' });
        return;
      }
      const staffName = profileMap.get(sid)?.full_name ?? 'Unknown';
      const p = profileMap.get(sid);
      const data = byStaff[sid];
      rows = data
        ? [{ staff_name: staffName, total_hours: data.total_hours, total_pay: data.total_pay, dailyBreakdown: data.daily, payMethod: (p as any)?.pay_type ?? (companyRow as any)?.default_pay_type ?? 'hourly', payRateLabel: payRateLabel(p) }]
        : [{ staff_name: staffName, total_hours: 0, total_pay: 0, dailyBreakdown: [], payMethod: (companyRow as any)?.default_pay_type ?? 'hourly', payRateLabel: payRateLabel(null) }];
    }

    const buffer = await generatePayslipsPdf({
      companyName: (company as any)?.name ?? 'Company',
      dateFrom: (date_from as string).slice(0, 10),
      dateTo: (date_to as string).slice(0, 10),
      rows,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslips-${(date_from as string).slice(0, 10)}-to-${(date_to as string).slice(0, 10)}.pdf`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/payroll-recalculate — Recalculate total_hours for clocked_out attendance in date range using company payroll round setting. */
router.post('/payroll-recalculate', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { date_from, date_to } = req.body ?? req.query ?? {};
  const dateFrom = date_from ? new Date(date_from as string) : null;
  const dateTo = date_to ? new Date(date_to as string) : null;
  if (!dateFrom || !dateTo || Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    res.status(400).json({ error: 'date_from and date_to required (YYYY-MM-DD or ISO date)' });
    return;
  }

  try {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('payroll_round_minutes')
      .eq('id', companyId)
      .maybeSingle();
    const roundMinutes = [5, 10, 15, 60].includes(Number((companyRow as any)?.payroll_round_minutes))
      ? Number((companyRow as any).payroll_round_minutes)
      : 15;

    const { data: jobIds } = await supabase
      .from('jobs')
      .select('id')
      .eq('company_id', companyId);
    const ids = (jobIds ?? []).map((j: any) => j.id);
    if (ids.length === 0) {
      res.json({ updated: 0, message: 'No jobs for company' });
      return;
    }

    const fromStart = new Date(dateFrom);
    fromStart.setUTCHours(0, 0, 0, 0);
    const toEnd = new Date(dateTo);
    toEnd.setUTCHours(23, 59, 59, 999);

    const { data: rows, error: fetchErr } = await supabase
      .from('staff_attendance')
      .select('id, job_id, clock_in_time, clock_out_time')
      .in('job_id', ids)
      .eq('status', 'clocked_out')
      .not('clock_out_time', 'is', null);

    if (fetchErr) throw fetchErr;

    const filtered = (rows ?? []).filter((r: any) => {
      const t = new Date(r.clock_in_time).getTime();
      return t >= fromStart.getTime() && t <= toEnd.getTime();
    });

    let updated = 0;
    for (const r of filtered) {
      const clockIn = new Date(r.clock_in_time);
      const clockOut = new Date(r.clock_out_time);
      const rawHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const totalHours = roundHoursForPayroll(rawHours, roundMinutes);
      const { error: upErr } = await supabase
        .from('staff_attendance')
        .update({ total_hours: totalHours })
        .eq('id', r.id);
      if (!upErr) updated++;
    }

    // Recalculate cleaner_pay for all jobs in this period (backfills pay when it was never set)
    const jobIdsInPeriod = [...new Set((filtered as any[]).map((r: any) => r.job_id).filter(Boolean))];
    let payUpdated = 0;
    for (const jobId of jobIdsInPeriod) {
      try {
        const result = await calculateCleanerPayForJob(jobId, companyId);
        payUpdated += result.updated;
      } catch (payErr: any) {
        console.error('Payroll recalculate cleaner_pay for job', jobId, payErr);
      }
    }

    res.json({ updated, total: filtered.length, round_minutes: roundMinutes, pay_recalculated: payUpdated });
  } catch (err: any) {
    console.error('Payroll recalculate error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/jobs/:id/calculate-cleaner-pay — Calculate and save cleaner_pay for all clocked_out attendances of this job (admin only). */
router.post('/jobs/:id/calculate-cleaner-pay', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const jobId = req.params.id;
  if (!companyId || !jobId) {
    res.status(403).json({ error: 'No company or job id' });
    return;
  }
  try {
    const { data: job } = await supabase.from('jobs').select('id, company_id').eq('id', jobId).eq('company_id', companyId).single();
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const { updated } = await calculateCleanerPayForJob(jobId, companyId);
    res.json({ updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/staff-locations — latest known GPS location per staff (admin only). */
router.get('/staff-locations', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: attendances, error: attErr } = await supabase
      .from('staff_attendance')
      .select('staff_id, job_id, clock_in_time, clock_out_time, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, status')
      .order('clock_in_time', { ascending: false });
    if (attErr) throw attErr;

    const staffIds = [...new Set((attendances ?? []).map((a: any) => a.staff_id))];
    if (staffIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, company_id')
      .in('id', staffIds);
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, client_name, address, company_id')
      .in(
        'id',
        [...new Set((attendances ?? []).map((a: any) => a.job_id).filter(Boolean))] as string[],
      );

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j]));

    const latestByStaff: Record<
      string,
      {
        staff_id: string;
        staff_name: string;
        staff_phone?: string | null;
        last_lat: number | null;
        last_lng: number | null;
        last_time: string | null;
        job_client_name?: string | null;
        job_address?: string | null;
      }
    > = {};

    for (const a of attendances ?? []) {
      const profile = profileMap.get(a.staff_id);
      if (!profile || profile.company_id !== companyId) continue;
      if (latestByStaff[a.staff_id]) continue; // already have newest
      const job = a.job_id ? jobMap.get(a.job_id) : null;
      const hasClockOutCoords =
        a.clock_out_lat != null &&
        a.clock_out_lng != null &&
        !Number.isNaN(Number(a.clock_out_lat)) &&
        !Number.isNaN(Number(a.clock_out_lng));
      const hasClockInCoords =
        a.clock_in_lat != null &&
        a.clock_in_lng != null &&
        !Number.isNaN(Number(a.clock_in_lat)) &&
        !Number.isNaN(Number(a.clock_in_lng));
      const last_lat = hasClockOutCoords
        ? Number(a.clock_out_lat)
        : hasClockInCoords
        ? Number(a.clock_in_lat)
        : null;
      const last_lng = hasClockOutCoords
        ? Number(a.clock_out_lng)
        : hasClockInCoords
        ? Number(a.clock_in_lng)
        : null;
      const last_time =
        a.clock_out_time ??
        a.clock_in_time ??
        null;
      latestByStaff[a.staff_id] = {
        staff_id: a.staff_id,
        staff_name: profile.full_name ?? 'Unknown',
        staff_phone: profile.phone ?? null,
        last_lat,
        last_lng,
        last_time,
        job_client_name: job?.client_name ?? null,
        job_address: job?.address ?? null,
      };
    }

    res.json(Object.values(latestByStaff));
  } catch (err: any) {
    console.error('Admin staff-locations error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers — List customers for company (admin only). */
router.get('/customers', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('id, full_name, phone, email, address, notes, created_at, welcome_email_sent_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    console.error('Admin customers:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/bookings — List bookings for company (admin only; e.g. pending online bookings). */
router.get('/bookings', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, preferred_date, service_type, address, notes, status, payment_status, created_at, job_id,
        customer:customer_profiles(id, full_name, phone)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    console.error('Admin bookings:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/bookings/:bookingId/convert-to-job — Create job from booking and link it. */
router.post('/bookings/:bookingId/convert-to-job', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const bookingId = req.params.bookingId;
  if (!companyId || !bookingId) {
    res.status(400).json({ error: 'Missing company or booking id' });
    return;
  }
  try {
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .select('*, customer:customer_profiles(id, full_name, address)')
      .eq('id', bookingId)
      .eq('company_id', companyId)
      .single();
    if (bookErr || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if ((booking as any).job_id) {
      res.status(400).json({ error: 'Booking already converted to a job' });
      return;
    }
    const customer = (booking as any).customer;
    const clientName = customer?.full_name || 'Customer';
    const address = (booking as any).address || customer?.address || '';
    const preferredDate = (booking as any).preferred_date;
    const scheduledAt = preferredDate ? new Date(preferredDate + 'T09:00:00').toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const staffId = (booking as any).preferred_staff_id;

    const { data: newJob, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        company_id: companyId,
        customer_id: (booking as any).customer_id,
        client_name: clientName,
        address,
        scheduled_at: scheduledAt,
        status: 'pending',
        notes: (booking as any).notes || '',
        price: '0',
        share_token: crypto.randomUUID(),
      })
      .select()
      .single();
    if (jobErr) throw jobErr;

    if (staffId) {
      await supabase.from('job_assignments').insert({ job_id: newJob.id, staff_id: staffId });
    }

    await supabase
      .from('bookings')
      .update({ job_id: newJob.id, status: 'confirmed' })
      .eq('id', bookingId)
      .eq('company_id', companyId);

    res.status(201).json({ job: newJob, booking: { ...booking, job_id: newJob.id, status: 'confirmed' } });
  } catch (err: any) {
    console.error('Convert booking to job:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/bookings/:bookingId/quote — Create or update quote for this booking; set booking status to 'quoted' and notify customer. */
router.post('/bookings/:bookingId/quote', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const bookingId = req.params.bookingId;
  if (!companyId || !bookingId) {
    res.status(400).json({ error: 'Missing company or booking id' });
    return;
  }
  const { total_price, unit_price, quantity, service_type, notes } = req.body;
  const total = total_price != null ? Number(total_price) : (Number(quantity) || 1) * (Number(unit_price) || 0);
  if (Number.isNaN(total) || total < 0) {
    res.status(400).json({ error: 'Valid total_price (or unit_price and quantity) required' });
    return;
  }
  try {
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .select('id, customer_id, company_id, service_type, status')
      .eq('id', bookingId)
      .eq('company_id', companyId)
      .single();
    if (bookErr || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    const custId = (booking as any).customer_id;
    const qty = Math.max(0.01, Number(quantity) || 1);
    const unit = Math.round((total / qty) * 100) / 100;
    const service = typeof service_type === 'string' && service_type.trim() ? service_type.trim() : ((booking as any).service_type || 'Cleaning service');

    const { data: existing } = await supabase
      .from('quotes')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('quotes')
        .update({
          service_type: service,
          quantity: qty,
          unit_price: unit,
          total_price: total,
          notes: notes ?? null,
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id);
    } else {
      const quoteNumber = await nextQuoteNumber(companyId);
      await supabase.from('quotes').insert({
        company_id: companyId,
        customer_id: custId,
        booking_id: bookingId,
        quote_number: quoteNumber,
        service_type: service,
        quantity: qty,
        unit_price: unit,
        total_price: total,
        notes: notes ?? null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    }

    await supabase
      .from('bookings')
      .update({ status: 'quoted' })
      .eq('id', bookingId)
      .eq('company_id', companyId);

    if (custId) {
      notifyCustomer(custId, companyId, {
        title: 'Quote received',
        body: `Your quote is ready. View and accept in the app.`,
        url: '/customer',
        tag: `quote-booking-${bookingId}`,
      }).catch(() => {});
    }

    const { data: quoteList } = await supabase
      .from('quotes')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1);
    const quote = (quoteList ?? [])[0];
    res.status(201).json({ quote, booking: { ...booking, status: 'quoted' } });
  } catch (err: any) {
    console.error('Admin booking quote:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/push-subscription — Save Web Push subscription for company (admin) notifications. */
router.post('/push-subscription', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const subscription = req.body?.subscription;
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'Subscription object with endpoint required' });
    return;
  }
  try {
    const { saveSubscription } = await import('../services/pushNotificationService');
    await saveSubscription(companyId, subscription, null);
    res.status(204).end();
  } catch (err: any) {
    console.error('Save admin push subscription:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/vapid-public-key — Return VAPID public key for Web Push (frontend subscribe). */
router.get('/vapid-public-key', requireAdmin, (_req: AuthRequest, res: Response): Promise<void> => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.status(503).json({ error: 'VAPID not configured' });
    return Promise.resolve();
  }
  res.json({ vapidPublicKey: key });
  return Promise.resolve();
});

/** GET /api/admin/services — List company_services for the company (Service Catalog). */
router.get('/services', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('company_services')
      .select('id, name, slug, description, price_type, base_price, suggested_price_min, suggested_price_max, display_order')
      .eq('company_id', companyId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/services — Create a new service (boss adds own cleaning item + price). */
router.post('/services', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { name, description, price_type, base_price } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const priceType = price_type === 'fixed' ? 'fixed' : 'hourly';
  const basePrice = base_price === '' || base_price === null || base_price === undefined || Number(base_price) === 0
    ? null
    : Math.max(0, Number(base_price));
  const slug = (name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'service').slice(0, 80);
  try {
    const { data: maxOrder } = await supabase
      .from('company_services')
      .select('display_order')
      .eq('company_id', companyId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    const displayOrder = (maxOrder as any)?.display_order != null ? (maxOrder as any).display_order + 1 : 0;
    const { data, error } = await supabase
      .from('company_services')
      .insert({
        company_id: companyId,
        name: name.trim(),
        slug: slug + '_' + Date.now().toString(36),
        description: description?.trim() || null,
        price_type: priceType,
        base_price: basePrice,
        display_order: displayOrder,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/services/ensure-booking-defaults — Add only "Provide cleaning supplies" and "Pet Hair Removal Surcharge" if missing (top of catalog). */
router.post('/services/ensure-booking-defaults', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: existing } = await supabase
      .from('company_services')
      .select('slug')
      .eq('company_id', companyId);
    const existingSlugs = new Set((existing ?? []).map((r: any) => r.slug));
    const toInsert = BOOKING_DEFAULT_SERVICES.filter((s) => !existingSlugs.has(s.slug)).map((s) => ({
      company_id: companyId,
      name: s.name,
      slug: s.slug,
      description: s.description,
      price_type: s.price_type,
      base_price: s.base_price,
      display_order: s.display_order,
    }));
    if (toInsert.length === 0) {
      res.json({ message: 'Booking defaults already in catalog', count: 0 });
      return;
    }
    const { data: inserted, error } = await supabase
      .from('company_services')
      .insert(toInsert)
      .select('id');
    if (error) throw error;
    res.status(201).json({ message: 'Booking options added', count: (inserted ?? []).length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/services/import-uk-standard — Batch insert UK standard price list for this company. */
router.post('/services/import-uk-standard', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: existing } = await supabase
      .from('company_services')
      .select('slug')
      .eq('company_id', companyId);
    const existingSlugs = new Set((existing ?? []).map((r: any) => r.slug));
    const toInsert = UK_STANDARD_SERVICES.filter((s) => !existingSlugs.has(s.slug)).map((s) => ({
      company_id: companyId,
      name: s.name,
      slug: s.slug,
      description: s.description,
      price_type: s.price_type,
      base_price: s.base_price,
      display_order: s.display_order,
    }));
    if (toInsert.length === 0) {
      res.json({ message: 'All UK standard services already in catalog', count: 0 });
      return;
    }
    const { data: inserted, error } = await supabase
      .from('company_services')
      .insert(toInsert)
      .select('id');
    if (error) throw error;
    res.status(201).json({ message: 'UK standard services imported successfully', count: (inserted ?? []).length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/services/:id — Update base_price (null if blank/0). */
router.patch('/services/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId || !id) {
    res.status(400).json({ error: 'Missing company or service id' });
    return;
  }
  const raw = req.body?.base_price;
  const basePrice = raw === '' || raw === null || raw === undefined || Number(raw) === 0 ? null : Math.max(0, Number(raw));
  try {
    const { data, error } = await supabase
      .from('company_services')
      .update({ base_price: basePrice })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** DELETE /api/admin/services/:id — Delete a service from the catalog. */
router.delete('/services/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId || !id) {
    res.status(400).json({ error: 'Missing company or service id' });
    return;
  }
  try {
    const { error } = await supabase
      .from('company_services')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) throw error;
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/customers — Create customer; auto-generate password and send welcome email. */
router.post('/customers', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { full_name, phone, email, address, notes } = req.body;
  if (!phone?.trim()) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  try {
    const result = await ensureCustomerForCompany(companyId, {
      full_name: full_name || 'Customer',
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    });
    const company = await supabase.from('companies').select('name').eq('id', companyId).single();
    const companyName = (company.data as any)?.name ?? 'Your cleaning company';
    const loginUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/customer/login` : '/customer/login';
    if (result.isNew && result.plainPassword) {
      await sendWelcomeEmail(result.customer, result.plainPassword, companyName, loginUrl);
      await supabase.from('customer_profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', result.customer.id);
    }
    const out: any = { ...result.customer };
    delete out.password_hash;
    res.status(201).json({
      customer: out,
      is_new: result.isNew,
      temporary_password: result.isNew ? result.plainPassword : undefined,
    });
  } catch (err: any) {
    console.error('Admin customers create:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId — Get one customer with booking count, invoice count. */
router.get('/customers/:customerId', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: customer, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .single();
    if (error || !customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const { password_hash, ...rest } = customer as any;
    const [{ count: bookingsCount }, { count: invoicesCount }] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('customer_id', customerId).eq('company_id', companyId),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('customer_id', customerId).eq('company_id', companyId),
    ]);
    res.json({ ...rest, bookings_count: bookingsCount ?? 0, invoices_count: invoicesCount ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/customers/:customerId — Update customer. */
router.patch('/customers/:customerId', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  const { full_name, phone, email, address, notes } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = String(full_name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim().replace(/\s+/g, '');
    if (email !== undefined) updates.email = email?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const { data, error } = await supabase
      .from('customer_profiles')
      .update(updates)
      .eq('id', customerId)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const { password_hash, ...rest } = data as any;
    res.json(rest);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** DELETE /api/admin/customers/:customerId — Delete customer (cascades to notes, invoices, etc.). */
router.delete('/customers/:customerId', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { error } = await supabase
      .from('customer_profiles')
      .delete()
      .eq('id', customerId)
      .eq('company_id', companyId);
    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId/notes — List notes for customer. */
router.get('/customers/:customerId/notes', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('customer_notes')
      .select('id, content, created_by, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const createdByIds = [...new Set((data ?? []).map((n: any) => n.created_by).filter(Boolean))];
    const { data: profiles } = createdByIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', createdByIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const list = (data ?? []).map((n: any) => ({ ...n, created_by_name: n.created_by ? profileMap.get(n.created_by)?.full_name : null }));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/customers/:customerId/notes — Add note. */
router.post('/customers/:customerId/notes', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const userId = req.user?.id;
  const customerId = req.params.customerId;
  const { content } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  if (!content?.trim()) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }
  try {
    const { data: customer } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const { data, error } = await supabase
      .from('customer_notes')
      .insert({ company_id: companyId, customer_id: customerId, content: content.trim(), created_by: userId || null })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId/bookings — Booking history for customer. */
router.get('/customers/:customerId/bookings', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, preferred_date, service_type, address, status, payment_status, job_id, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId/invoices — Invoices for customer. */
router.get('/customers/:customerId/invoices', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, currency, issued_at, due_at, sent_at, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId/quotes — Quote history for customer (CRM). */
router.get('/customers/:customerId/quotes', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, service_type, quantity, unit_price, total_price, status, sent_at, approved_at, job_id, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/customers/:customerId/payments — Payments for customer. */
router.get('/customers/:customerId/payments', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('id, invoice_id, amount, method, status, paid_at, reference, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

const PAYMENT_METHODS = ['self_collect', 'payment_link', 'stripe_connect'] as const;

/** GET /api/admin/customers/:customerId/payment-settings — Get payment settings for a customer. */
router.get('/customers/:customerId/payment-settings', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('customer_payment_settings')
      .select('payment_method, payment_link_url, instructions')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (error) throw error;
    res.json(data ?? { payment_method: 'self_collect', payment_link_url: null, instructions: null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/customers/:customerId/payment-settings — Set payment method for customer. */
router.patch('/customers/:customerId/payment-settings', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const customerId = req.params.customerId;
  const { payment_method, payment_link_url, instructions } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  if (payment_method !== undefined && !PAYMENT_METHODS.includes(payment_method)) {
    res.status(400).json({ error: 'payment_method must be self_collect, payment_link, or stripe_connect' });
    return;
  }
  try {
    const { data: customer } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('id', customerId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const payload: Record<string, unknown> = {};
    if (payment_method !== undefined) payload.payment_method = payment_method;
    if (payment_link_url !== undefined) payload.payment_link_url = payment_link_url ?? null;
    if (instructions !== undefined) payload.instructions = instructions ?? null;
    const { data, error } = await supabase
      .from('customer_payment_settings')
      .upsert({ company_id: companyId, customer_id: customerId, ...payload }, { onConflict: 'company_id,customer_id' })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error('Admin payment-settings:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/admin/company-booking-slug — Set booking_slug for company (admin only). */
router.patch('/company-booking-slug', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { booking_slug } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const slug = booking_slug == null ? null : String(booking_slug).trim() || null;
    const { data, error } = await supabase
      .from('companies')
      .update({ booking_slug: slug })
      .eq('id', companyId)
      .select('id, booking_slug')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/admin/daily-remarks — List daily remarks for date range (Overview calendar). */
router.get('/daily-remarks', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { from, to } = req.query;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    let q = supabase
      .from('daily_remarks')
      .select('date, note')
      .eq('company_id', companyId);
    if (from && typeof from === 'string') q = q.gte('date', from);
    if (to && typeof to === 'string') q = q.lte('date', to);
    const { data, error } = await q.order('date', { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    console.error('GET daily-remarks:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** PUT /api/admin/daily-remarks — Upsert remark for one day (body: { date, note }). */
router.put('/daily-remarks', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { date, note } = req.body;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  if (!date || typeof date !== 'string') {
    res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    return;
  }
  try {
    const dateOnly = date.slice(0, 10);
    const noteStr = note == null ? '' : String(note).trim();
    const { data, error } = await supabase
      .from('daily_remarks')
      .upsert(
        { company_id: companyId, date: dateOnly, note: noteStr || null, updated_at: new Date().toISOString() },
        { onConflict: 'company_id,date' }
      )
      .select('date, note')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error('PUT daily-remarks:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/admin/cleanup-old-photos — Clear job photos older than 90 days (DB + storage). Also runs daily via cron. */
router.post('/cleanup-old-photos', requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await cleanupOldJobPhotos();
    res.json(result);
  } catch (err: any) {
    console.error('cleanup-old-photos:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;

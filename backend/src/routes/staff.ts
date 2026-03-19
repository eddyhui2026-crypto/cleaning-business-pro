import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';
import { checkStaffLimit } from '../middleware/planLimits';
import { requireAdmin } from '../middleware/requireAdmin';
import { distanceMeters, CLOCK_IN_RADIUS_METERS } from '../lib/distance';
import { roundHoursForPayroll } from '../lib/payrollRound';
import { notifyCompany, saveSubscription } from '../services/pushNotificationService';

const router = Router();

/** Only staff or supervisor can clock in/out (not admin). */
function requireStaffOrSupervisor(req: AuthRequest, res: Response, next: () => void): void {
  if (req.role === 'admin') {
    res.status(403).json({ success: false, message: 'Only staff can clock in or clock out' });
    return;
  }
  next();
}

/** Normalise UK phone for uniqueness check (store as +44...) */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) return `+${digits}`;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  return `+44${digits}`;
}

function generateTempPassword(): string {
  // 12-char random temp password: letters + digits
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * POST /api/staff — 老闆新增員工（僅 admin，Plan 限制已由 checkStaffLimit 處理）
 * Body: full_name, phone, role (optional, default staff)
 * System: id (from Auth), email (generated), password (generated), created_at, updated_at
 * Returns: profile + temporaryPassword (只回傳一次，請老闆轉交員工)
 */
router.post(
  '/',
  requireAdmin,
  checkStaffLimit,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const companyId = req.companyId;
    if (!companyId) {
      res.status(403).json({ error: 'No company associated with user' });
      return;
    }

    const { full_name, phone, role: bodyRole } = req.body;
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      res.status(400).json({ error: 'full_name is required' });
      return;
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      res.status(400).json({ error: 'phone is required' });
      return;
    }

    const normalisedPhone = normalisePhone(phone.trim());
    // 只允許建立 staff 或 supervisor，不建立 admin
    const role = (bodyRole === 'supervisor' ? 'supervisor' : 'staff') as 'staff' | 'supervisor';

    try {
      // 1. 檢查同一公司內 phone 是否已存在
      const { data: existing, error: existErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('phone', normalisedPhone)
        .maybeSingle();

      if (existErr) {
        console.error('Staff create: check phone error', existErr);
        res.status(500).json({
          error: 'Check failed',
          message: existErr.message,
          details: existErr.details,
        });
        return;
      }
      if (existing) {
        res.status(409).json({
          error: 'Phone already registered',
          code: 'PHONE_DUPLICATE',
          message: 'This phone number is already used by another staff member in your company.',
        });
        return;
      }

      // 2. Staff login by phone: Auth email = {phone}@phone.cleaning.local, temporary password (random)
      const authEmail = `${normalisedPhone}@phone.cleaning.local`;
      const tempPassword = generateTempPassword();

      // 3. Supabase Auth create user (service role required for admin.createUser)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: authEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim(), role },
      });

      if (authErr) {
        console.error('Auth createUser error:', authErr);
        res.status(500).json({
          error: 'Failed to create login account',
          message: authErr.message,
          details: (authErr as any).status ? String((authErr as any).status) : undefined,
        });
        return;
      }
      if (!authUser.user) {
        res.status(500).json({ error: 'Failed to create user', message: 'Auth returned no user' });
        return;
      }

      const userId = authUser.user.id;

      // 4. 插入 profiles（id = Auth user id；created_at/updated_at 由 DB 自動）
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            company_id: companyId,
            full_name: full_name.trim(),
            phone: normalisedPhone,
            email: authEmail,
            role,
          },
        ])
        .select()
        .single();

      if (profileErr) {
        console.error('Profile insert error:', profileErr);
        res.status(500).json({
          error: 'Account created but profile failed',
          message: profileErr.message,
          details: profileErr.details,
          code: profileErr.code,
        });
        return;
      }

      // 5. Return profile + login phone and temporary password (staff log in at /staff-login with phone + this password)
      res.status(201).json({
        ...profile,
        name: profile.full_name || 'Unnamed Staff',
        loginPhone: normalisedPhone,
        loginEmail: authEmail,
        temporaryPassword: tempPassword,
        message:
          'Staff can log in at Staff Login with this phone number and the temporary password shown here. ' +
          'Ask them to change their password after first login.',
      });
    } catch (err: any) {
      console.error('Create staff error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err?.message || String(err),
      });
    }
  }
);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company associated with user' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone, company_id, created_at, pay_type, pay_hourly_rate, pay_percentage, pay_fixed_amount')
      .eq('company_id', companyId)
      .neq('role', 'admin');

    if (error) throw error;

    const formattedData = (data ?? []).map((s: any) => ({
      ...s,
      name: s.full_name || 'Unnamed Staff',
    }));

    res.json(formattedData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/staff/:id/reset-password — Admin resets a staff member's password
 * Returns: { temporaryPassword, loginPhone }
 */
router.post('/:id/reset-password', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const staffId = req.params.id;
  if (!companyId) {
    res.status(403).json({ error: 'No company associated with user' });
    return;
  }
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, company_id, full_name, phone, email, role')
      .eq('id', staffId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('Reset staff password: load profile error', error);
      res.status(500).json({ error: 'Failed to load staff profile', message: error.message });
      return;
    }
    if (!profile) {
      res.status(404).json({ error: 'Staff not found' });
      return;
    }
    if (profile.role === 'admin') {
      res.status(403).json({ error: 'Cannot reset admin password from this endpoint' });
      return;
    }

    const tempPassword = generateTempPassword();
    const authRes = await supabase.auth.admin.updateUserById(profile.id, { password: tempPassword });
    if (authRes.error) {
      console.error('Reset staff password: auth error', authRes.error);
      res.status(500).json({ error: 'Failed to reset password', message: authRes.error.message });
      return;
    }

    res.json({
      temporaryPassword: tempPassword,
      loginPhone: profile.phone,
      full_name: profile.full_name || 'Staff',
    });
  } catch (err: any) {
    console.error('Reset staff password error:', err);
    res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  }
});

// --- GPS Clock In / Clock Out ---

/** POST /api/staff/clock-in — Staff clocks in for a job (GPS required, within 100m of job). */
router.post('/clock-in', requireStaffOrSupervisor, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const staffId = req.user!.id;
  if (!companyId) {
    res.status(403).json({ success: false, message: 'No company associated with user' });
    return;
  }

  const { job_id, latitude, longitude } = req.body;
  if (!job_id || latitude == null || longitude == null) {
    res.status(400).json({ success: false, message: 'job_id, latitude, and longitude are required' });
    return;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({ success: false, message: 'Invalid latitude or longitude' });
    return;
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, company_id, job_latitude, job_longitude, job_start_time, client_name')
      .eq('id', job_id)
      .single();

    if (jobErr || !job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }
    if (job.company_id !== companyId) {
      res.status(403).json({ success: false, message: 'Job not in your company' });
      return;
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, status')
      .eq('job_id', job_id)
      .eq('staff_id', staffId)
      .maybeSingle();

    if (!assignment) {
      res.status(403).json({ success: false, message: 'You are not assigned to this job' });
      return;
    }

    // Only accepted assignments are allowed to clock in.
    if (assignment.status !== 'accepted') {
      res
        .status(403)
        .json({ success: false, message: 'You must accept this job before you can clock in.' });
      return;
    }

    if (job.job_latitude == null || job.job_longitude == null) {
      res.status(400).json({
        success: false,
        message: 'Job location is not set. Ask admin to set job coordinates to allow clock in.',
      });
      return;
    }
    const dist = distanceMeters(lat, lng, Number(job.job_latitude), Number(job.job_longitude));
    if (dist > CLOCK_IN_RADIUS_METERS) {
      res.status(400).json({
        success: false,
        message: 'You must be near the job location to clock in',
      });
      return;
    }

    // One open attendance at a time (supports overnight: e.g. clock in 22:00, clock out 04:00 next day)
    const { data: existingClockedIn } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('staff_id', staffId)
      .eq('status', 'clocked_in')
      .maybeSingle();

    if (existingClockedIn) {
      res.status(400).json({ success: false, message: 'You are already clocked in. Clock out first.' });
      return;
    }

    const clockInTime = new Date();
    let lateMinutes: number | null = null;
    if (job.job_start_time) {
      const start = new Date(job.job_start_time);
      const diffMs = clockInTime.getTime() - start.getTime();
      lateMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    const { data: attendance, error: insertErr } = await supabase
      .from('staff_attendance')
      .insert({
        staff_id: staffId,
        job_id: job_id,
        clock_in_time: clockInTime.toISOString(),
        clock_in_lat: lat,
        clock_in_lng: lng,
        status: 'clocked_in',
        late_minutes: lateMinutes ?? 0,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Clock-in insert error:', insertErr);
      res.status(500).json({ success: false, message: insertErr.message });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Clock in successful',
      attendance_id: attendance.id,
      clock_in_time: attendance.clock_in_time,
    });
  } catch (err: any) {
    console.error('Clock-in error:', err);
    res.status(500).json({ success: false, message: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/staff/my-jobs — Jobs assigned to current user with assignment id and status (for Accept/Decline). */
router.get('/my-jobs', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const staffId = req.user!.id;
  const role = req.role ?? '';

  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  if (role !== 'admin' && role !== 'staff' && role !== 'supervisor') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const { data: assignments, error: aErr } = await supabase
      .from('job_assignments')
      .select('id, job_id, status')
      .eq('staff_id', staffId)
      .order('assigned_at', { ascending: false });

    if (aErr) throw aErr;

    const jobIds = [...new Set((assignments ?? []).map((a: any) => a.job_id))];
    if (jobIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: jobs, error: jErr } = await supabase
      .from('jobs')
      .select('id, client_name, address, scheduled_at, status')
      .in('id', jobIds)
      .eq('company_id', companyId);

    if (jErr) throw jErr;

    const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j]));
    const assignMap = new Map((assignments ?? []).map((a: any) => [a.job_id, a]));

    const result = (assignments ?? []).map((a: any) => {
      const j = jobMap.get(a.job_id);
      if (!j) return null;
      const scheduled = j.scheduled_at ? new Date(j.scheduled_at) : null;
      return {
        assignment_id: a.id,
        job_id: j.id,
        job_name: j.client_name,
        job_address: j.address,
        job_date: scheduled ? scheduled.toISOString().slice(0, 10) : null,
        start_time: scheduled ? scheduled.toTimeString().slice(0, 5) : null,
        end_time: null,
        status: a.status,
        job_status: j.status,
      };
    }).filter(Boolean);

    res.json(result);
  } catch (err: any) {
    console.error('my-jobs error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/staff/job-response — Staff accept or decline an assignment. */
router.post('/job-response', async (req: AuthRequest, res: Response): Promise<void> => {
  const staffId = req.user!.id;
  const companyId = req.companyId;
  const { assignment_id, response } = req.body;

  if (!assignment_id || !response) {
    res.status(400).json({ error: 'assignment_id and response (accepted or declined) required' });
    return;
  }
  const status = response === 'accepted' ? 'accepted' : response === 'declined' ? 'declined' : null;
  if (!status) {
    res.status(400).json({ error: 'response must be accepted or declined' });
    return;
  }

  try {
    const { data: row, error: fetchErr } = await supabase
      .from('job_assignments')
      .select('id, staff_id, job_id')
      .eq('id', assignment_id)
      .eq('staff_id', staffId)
      .single();

    if (fetchErr || !row) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    if (!companyId) {
      res.status(403).json({ error: 'No company' });
      return;
    }

    const { error: updateErr } = await supabase
      .from('job_assignments')
      .update({ status })
      .eq('id', assignment_id)
      .eq('staff_id', staffId);

    if (updateErr) throw updateErr;

    // 1) Persist an event for Dashboard prompts.
    await supabase.from('job_assignment_events').insert({
      company_id: companyId,
      job_id: row.job_id,
      staff_id: staffId,
      response_status: status,
    });

    // 2) Push notification to admins with deep-link to the job.
    const [jobRes, staffRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, client_name, address, scheduled_at')
        .eq('id', row.job_id)
        .maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', staffId).maybeSingle(),
    ]);

    const job = jobRes.data;
    const staffProfile = staffRes.data;
    const staffFullName = (staffProfile as any)?.full_name || 'Staff';
    const clientName = (job as any)?.client_name || 'Job';
    const jobAddress = (job as any)?.address ? String((job as any).address) : '';
    const jobDateStr = (job as any)?.scheduled_at ? String((job as any).scheduled_at).slice(0, 10) : '';

    const title = status === 'declined' ? 'Job declined' : 'Job accepted';
    const body = `${staffFullName} ${status === 'declined' ? 'declined' : 'accepted'}: ${clientName}${jobAddress ? ` — ${jobAddress}` : ''}`;
    const url = `/admin/schedule?jobId=${row.job_id}&view=timeGridDay&date=${encodeURIComponent(jobDateStr)}`;

    await notifyCompany(companyId, {
      title,
      body,
      url,
      tag: `job-response:${row.job_id}:${status}`,
    }).catch(() => {});

    res.json({ success: true, message: `Job ${status}` });
  } catch (err: any) {
    console.error('job-response error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

// GET /api/staff/job-assignment-events — Admin reads recent accept/decline events
router.get('/job-assignment-events', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;

  try {
    const { data: events, error } = await supabase
      .from('job_assignment_events')
      .select('id, created_at, response_status, job_id, staff_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const jobIds = [...new Set((events ?? []).map((e: any) => String(e.job_id)))];
    const staffIds = [...new Set((events ?? []).map((e: any) => String(e.staff_id)))];

    const [{ data: jobs }, { data: staff }] = await Promise.all([
      jobIds.length
        ? supabase.from('jobs').select('id, client_name, address, scheduled_at').in('id', jobIds)
        : Promise.resolve({ data: [] }),
      staffIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', staffIds)
        : Promise.resolve({ data: [] }),
    ]);

    const jobMap = new Map((jobs ?? []).map((j: any) => [String(j.id), j]));
    const staffMap = new Map((staff ?? []).map((s: any) => [String(s.id), s]));

    const mapped = (events ?? []).map((e: any) => {
      const job = jobMap.get(String(e.job_id));
      const staffMember = staffMap.get(String(e.staff_id));
      return {
        id: e.id,
        created_at: e.created_at,
        response_status: e.response_status,
        job_id: e.job_id,
        job_client_name: job?.client_name ?? null,
        job_address: job?.address ?? null,
        job_scheduled_at: job?.scheduled_at ?? null,
        staff_full_name: staffMember?.full_name ?? null,
      };
    });

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** GET /api/staff/attendance/me — Staff's own attendance records (for timesheet / today status). */
router.get('/attendance/me', async (req: AuthRequest, res: Response): Promise<void> => {
  const staffId = req.user!.id;
  const role = req.role ?? '';
  const { date_from, date_to } = req.query;

  if (role !== 'admin' && role !== 'staff' && role !== 'supervisor') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    let query = supabase
      .from('staff_attendance')
      .select(`
        id,
        job_id,
        clock_in_time,
        clock_out_time,
        clock_in_lat,
        clock_in_lng,
        clock_out_lat,
        clock_out_lng,
        total_hours,
        status,
        late_minutes
      `)
      .eq('staff_id', staffId)
      .order('clock_in_time', { ascending: false });

    const { data: rows, error } = await query;
    if (error) throw error;

    let list = rows ?? [];
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

    const jobIds = [...new Set(list.map((a: any) => a.job_id))];
    const { data: jobs } = await supabase.from('jobs').select('id, client_name').in('id', jobIds);
    const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, j.client_name]));

    const result = list.map((a: any) => ({
      ...a,
      job_name: jobMap.get(a.job_id) ?? 'Unknown',
    }));

    res.json(result);
  } catch (err: any) {
    console.error('Staff attendance/me error:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** POST /api/staff/clock-out — Staff clocks out (updates existing attendance). */
router.post('/clock-out', requireStaffOrSupervisor, async (req: AuthRequest, res: Response): Promise<void> => {
  const staffId = req.user!.id;

  const { attendance_id, latitude, longitude } = req.body;
  if (!attendance_id) {
    res.status(400).json({ success: false, message: 'attendance_id is required' });
    return;
  }

  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;

  try {
    const { data: row, error: fetchErr } = await supabase
      .from('staff_attendance')
      .select('id, staff_id, clock_in_time, job_id')
      .eq('id', attendance_id)
      .eq('staff_id', staffId)
      .eq('status', 'clocked_in')
      .single();

    if (fetchErr || !row) {
      res.status(400).json({
        success: false,
        message: 'Attendance not found or already clocked out. You must clock in first.',
      });
      return;
    }

    let roundMinutes = 15;
    if ((row as any).job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('company_id')
        .eq('id', (row as any).job_id)
        .maybeSingle();
      if (job?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('payroll_round_minutes')
          .eq('id', (job as any).company_id)
          .maybeSingle();
        const val = (company as any)?.payroll_round_minutes;
        if ([5, 10, 15, 60].includes(Number(val))) roundMinutes = Number(val);
      }
    }

    const clockOutTime = new Date();
    const clockIn = new Date(row.clock_in_time);
    const rawHours = (clockOutTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const totalHours = roundHoursForPayroll(rawHours, roundMinutes);

    const updatePayload: Record<string, any> = {
      clock_out_time: clockOutTime.toISOString(),
      total_hours: totalHours,
      status: 'clocked_out',
    };
    if (lat != null && !Number.isNaN(lat)) updatePayload.clock_out_lat = lat;
    if (lng != null && !Number.isNaN(lng)) updatePayload.clock_out_lng = lng;

    const { error: updateErr } = await supabase
      .from('staff_attendance')
      .update(updatePayload)
      .eq('id', attendance_id)
      .eq('staff_id', staffId);

    if (updateErr) {
      console.error('Clock-out update error:', updateErr);
      res.status(500).json({ success: false, message: updateErr.message });
      return;
    }

    res.json({
      success: true,
      message: 'Clock out successful',
      clock_out_time: clockOutTime.toISOString(),
      total_hours: totalHours,
    });
  } catch (err: any) {
    console.error('Clock-out error:', err);
    res.status(500).json({ success: false, message: err?.message ?? 'Internal server error' });
  }
});

/** PATCH /api/staff/:id — Admin updates this staff's pay only. Updates ONLY this profile row; does NOT touch company default_pay_*. */
router.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { pay_type, pay_hourly_rate, pay_percentage, pay_fixed_amount } = req.body ?? {};
  try {
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchErr || !profile) {
      res.status(404).json({ error: 'Staff not found or not in your company' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (pay_type !== undefined) {
      updates.pay_type = pay_type === null || pay_type === '' || ['hourly', 'percentage', 'fixed'].includes(pay_type) ? (pay_type || null) : null;
    }
    if (pay_hourly_rate !== undefined) {
      if (pay_hourly_rate === null || pay_hourly_rate === '') updates.pay_hourly_rate = null;
      else { const v = Number(pay_hourly_rate); updates.pay_hourly_rate = Number.isNaN(v) ? null : v; }
    }
    if (pay_percentage !== undefined) {
      if (pay_percentage === null || pay_percentage === '') updates.pay_percentage = null;
      else { const v = Number(pay_percentage); updates.pay_percentage = Number.isNaN(v) ? null : v; }
    }
    if (pay_fixed_amount !== undefined) {
      if (pay_fixed_amount === null || pay_fixed_amount === '') updates.pay_fixed_amount = null;
      else { const v = Number(pay_fixed_amount); updates.pay_fixed_amount = Number.isNaN(v) ? null : v; }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No pay fields to update' });
      return;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    res.json({
      id: updated.id,
      pay_type: (updated as any).pay_type ?? null,
      pay_hourly_rate: (updated as any).pay_hourly_rate ?? null,
      pay_percentage: (updated as any).pay_percentage ?? null,
      pay_fixed_amount: (updated as any).pay_fixed_amount ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

/** DELETE /api/staff/:id — 僅 admin，且只能刪除自己公司內的員工 */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchErr || !profile) {
      res.status(404).json({ error: 'Staff not found or not in your company' });
      return;
    }
    if (profile.role === 'admin') {
      res.status(403).json({ error: 'Cannot delete company admin' });
      return;
    }

    const { error: deleteErr } = await supabase.from('profiles').delete().eq('id', id).eq('company_id', companyId);
    if (deleteErr) throw deleteErr;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/staff/push-subscription/self — Staff device registers for job notifications. */
router.post('/push-subscription/self', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const staffId = req.user?.id;
  if (!companyId || !staffId) {
    res.status(403).json({ error: 'No company or user' });
    return;
  }
  const subscription = (req.body as any)?.subscription;
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'Subscription object with endpoint required' });
    return;
  }
  try {
    await saveSubscription(companyId, subscription, null, staffId);
    res.status(204).end();
  } catch (err: any) {
    console.error('Save staff push subscription:', err);
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;

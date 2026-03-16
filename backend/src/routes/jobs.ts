import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';
import { checkJobLimit } from '../middleware/planLimits';
import { ensureCustomerForCompany, sendWelcomeEmail } from '../services/customerService';
import { notifyCustomerJobCompleted } from '../services/notifications';
import { calculateCleanerPayForJob } from '../services/cleanerPay';

const router = Router();

const JOB_UPDATE_WHITELIST = [
  'client_name',
  'address',
  'scheduled_at',
  'job_start_time',
  'job_latitude',
  'job_longitude',
  'notes',
  'status',
  'price',
  'price_includes_vat',
  'pay_type',
  'pay_hourly_rate',
  'pay_percentage',
  'pay_fixed_amount',
  'before_photos',
  'after_photos',
  'service_type',
  'details',
] as const;

function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, any> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out as Partial<T>;
}

async function getJobAndAssertCompany(
  jobId: string,
  companyId: string | null,
  userId: string,
  role: string
): Promise<{ job: any; error?: string }> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, staff_members:job_assignments(staff_id)')
    .eq('id', jobId)
    .single();

  if (error || !job) return { job: null, error: 'Job not found' };
  if (job.company_id !== companyId) return { job: null, error: 'Forbidden' };

  return { job };
}

// GET /api/jobs — list jobs for user's company (paginated)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { page, page_size } = req.query;

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        staff_members:job_assignments(staff:profiles(id, full_name))
      `)
      .eq('company_id', companyId)
      .order('scheduled_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (error) throw error;

    const formattedData = (data ?? []).map((job: any) => ({
      ...job,
      staff_members: (job.staff_members ?? [])
        .map((sm: any) => (sm.staff ? { id: sm.staff.id, name: sm.staff.full_name } : null))
        .filter(Boolean),
    }));

    const jobIds = (formattedData as any[]).map((j: any) => j.id).filter(Boolean);
    let invoiceByJobId: Record<string, { id: string; invoice_number: string; status: string }> = {};
    if (jobIds.length > 0) {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, job_id, invoice_number, status')
        .eq('company_id', companyId)
        .in('job_id', jobIds);
      (invoices ?? []).forEach((inv: any) => {
        if (inv.job_id) invoiceByJobId[inv.job_id] = { id: inv.id, invoice_number: inv.invoice_number, status: inv.status };
      });
    }
    const withInvoice = (formattedData as any[]).map((job: any) => ({
      ...job,
      invoice: job.id ? invoiceByJobId[job.id] || null : null,
    }));

    res.json(withInvoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/staff/:staffId — jobs assigned to this staff (paginated)
router.get('/staff/:staffId', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const role = req.role;
  const userId = req.user!.id;
  const { staffId } = req.params;

  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  if (role !== 'admin' && staffId !== userId) {
    res.status(403).json({ error: 'Can only view own jobs' });
    return;
  }

  const { page, page_size } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeRaw = Number(page_size) || 200;
  const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
  const fromIndex = (pageNum - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  try {
    const { data: assignments, error: assignErr } = await supabase
      .from('job_assignments')
      .select('job_id')
      .eq('staff_id', staffId);

    if (assignErr) throw assignErr;

    const jobIds = (assignments ?? []).map((a: any) => a.job_id);
    if (jobIds.length === 0) {
      res.json([]);
      return;
    }

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .in('id', jobIds)
      .eq('company_id', companyId)
      .order('scheduled_at', { ascending: true })
      .range(fromIndex, toIndex);

    if (error) throw error;
    res.json(jobs ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs — create job (company_id from middleware); plan job limit enforced
router.post('/', checkJobLimit, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const {
    client_name,
    address,
    scheduled_at,
    staffIds,
    status,
    price,
    price_includes_vat,
    pay_type,
    pay_hourly_rate,
    pay_percentage,
    pay_fixed_amount,
    notes,
    job_latitude,
    job_longitude,
    job_start_time,
    client_phone,
    client_email,
    service_type,
    details,
    customer_id: bodyCustomerId,
  } = req.body;

  try {
    let customerId: string | null = null;
    if (bodyCustomerId && typeof bodyCustomerId === 'string') {
      const { data: cust } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('id', bodyCustomerId)
        .eq('company_id', companyId)
        .single();
      if (cust) customerId = (cust as any).id;
    }
    if (!customerId && client_phone?.trim()) {
      const result = await ensureCustomerForCompany(companyId, {
        full_name: client_name || 'Customer',
        phone: client_phone.trim(),
        email: client_email?.trim() || null,
      });
      customerId = result.customer.id;
      if (result.isNew && result.plainPassword) {
        const company = await supabase.from('companies').select('name').eq('id', companyId).single();
        const loginUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/customer/login` : '/customer/login';
        await sendWelcomeEmail(result.customer, result.plainPassword, (company.data as any)?.name ?? 'Your cleaning company', loginUrl);
        await supabase.from('customer_profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', result.customer.id);
      }
    }

    const insertPayload: Record<string, any> = {
      client_name,
      address,
      scheduled_at,
      company_id: companyId,
      status: status || 'pending',
      notes: notes ?? '',
      price: price ?? '0',
      share_token: crypto.randomUUID(),
    };
    if (typeof service_type === 'string' && service_type.trim()) {
      insertPayload.service_type = service_type.trim();
    }
    if (details && typeof details === 'object') {
      insertPayload.details = details;
    }
    if (customerId) insertPayload.customer_id = customerId;
    if (job_latitude != null && !Number.isNaN(Number(job_latitude))) insertPayload.job_latitude = Number(job_latitude);
    if (job_longitude != null && !Number.isNaN(Number(job_longitude))) insertPayload.job_longitude = Number(job_longitude);
    if (job_start_time) insertPayload.job_start_time = job_start_time;
    if (typeof price_includes_vat === 'boolean') insertPayload.price_includes_vat = price_includes_vat;
    if (pay_type !== undefined && (pay_type === null || ['hourly', 'percentage', 'fixed'].includes(pay_type))) {
      insertPayload.pay_type = pay_type;
    }
    if (pay_hourly_rate !== undefined) {
      const v = Number(pay_hourly_rate);
      insertPayload.pay_hourly_rate = Number.isNaN(v) ? null : v;
    }
    if (pay_percentage !== undefined) {
      const v = Number(pay_percentage);
      insertPayload.pay_percentage = Number.isNaN(v) ? null : v;
    }
    if (pay_fixed_amount !== undefined) {
      const v = Number(pay_fixed_amount);
      insertPayload.pay_fixed_amount = Number.isNaN(v) ? null : v;
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert([insertPayload])
      .select();

    if (jobError) throw jobError;
    const newJob = jobData![0];

    const ids = Array.isArray(staffIds) ? staffIds : [];
    if (ids.length > 0) {
      const assignments = ids.map((sId: string) => ({
        job_id: newJob.id,
        staff_id: sId,
      }));
      const { error: assignError } = await supabase.from('job_assignments').insert(assignments);
      if (assignError) throw assignError;
    }

    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id — single job with staff + details
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const jobId = req.params.id;
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
        *,
        staff_members:job_assignments(staff:profiles(id, full_name))
      `,
      )
      .eq('id', jobId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const job = {
      ...data,
      staff_members: (data.staff_members ?? [])
        .map((sm: any) => (sm.staff ? { id: sm.staff.id, full_name: sm.staff.full_name } : null))
        .filter(Boolean),
    };
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('company_id', companyId)
      .eq('job_id', jobId)
      .maybeSingle();
    (job as any).invoice = inv ? { id: inv.id, invoice_number: inv.invoice_number, status: inv.status } : null;
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/check-in/:jobId
router.post('/check-in/:jobId', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const userId = req.user!.id;
  const role = req.role ?? '';
  const { jobId } = req.params;

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId ?? null, userId, role);
  if (err || !job) {
    const status = err === 'Forbidden' ? 403 : 404;
    res.status(status).json({ error: err ?? 'Job not found' });
    return;
  }

  const isAssigned = (job.staff_members ?? []).some((a: any) => a.staff_id === userId);
  if (role !== 'admin' && !isAssigned) {
    res.status(403).json({ error: 'Not assigned to this job' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'in_progress' })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jobs/complete/:jobId
router.post('/complete/:jobId', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const userId = req.user!.id;
  const role = req.role ?? '';
  const { jobId } = req.params;

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId ?? null, userId, role);
  if (err || !job) {
    const status = err === 'Forbidden' ? 403 : 404;
    res.status(status).json({ error: err ?? 'Job not found' });
    return;
  }

  const isAssigned = (job.staff_members ?? []).some((a: any) => a.staff_id === userId);
  if (role !== 'admin' && !isAssigned) {
    res.status(403).json({ error: 'Not assigned to this job' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    if (data?.customer_id) {
      notifyCustomerJobCompleted(data.customer_id, jobId).catch(() => {});
    }
    // Auto-calculate cleaner_pay when staff marks job complete (same as PATCH job → completed)
    if (companyId) {
      calculateCleanerPayForJob(jobId, companyId).catch((e) => console.warn('calculateCleanerPayForJob after complete:', e));
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jobs/:jobId/photos
router.post('/:jobId/photos', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const userId = req.user!.id;
  const role = req.role ?? '';
  const { jobId } = req.params;
  const { url, type } = req.body;

  if (!url || !type || !['before', 'after'].includes(type)) {
    res.status(400).json({ error: 'url and type (before|after) required' });
    return;
  }

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId ?? null, userId, role);
  if (err || !job) {
    const status = err === 'Forbidden' ? 403 : 404;
    res.status(status).json({ error: err ?? 'Job not found' });
    return;
  }

  const isAssigned = (job.staff_members ?? []).some((a: any) => a.staff_id === userId);
  if (role !== 'admin' && !isAssigned) {
    res.status(403).json({ error: 'Not assigned to this job' });
    return;
  }

  const field = type === 'before' ? 'before_photos' : 'after_photos';
  const current = Array.isArray(job[field]) ? job[field] : [];
  const updated = [...current, url];

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ [field]: updated })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/jobs/:id — single job (must be after /staff/:staffId and other specific routes)
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        staff_members:job_assignments(staff:profiles(id, full_name))
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      const code = error?.code === 'PGRST116' ? 404 : 500;
      res.status(code).json({ error: 'Job not found' });
      return;
    }

    const job = {
      ...data,
      staff_members: (data.staff_members ?? [])
        .map((sm: any) => (sm.staff ? { id: sm.staff.id, name: sm.staff.full_name } : null))
        .filter(Boolean),
    };
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id — whitelist fields + staff assignments
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { id } = req.params;
  const { staffIds, staff_ids, ...rest } = req.body;
  const staffIdsToSet = Array.isArray(staffIds) ? staffIds : Array.isArray(staff_ids) ? staff_ids : undefined;
  const updatePayload = pick(rest, [...JOB_UPDATE_WHITELIST]);

  try {
    const { data: existing, error: existErr } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (existErr || !existing) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update(updatePayload)
        .eq('id', id)
        .eq('company_id', companyId);
      if (updateError) throw updateError;
      if (updatePayload.status === 'completed') {
        await calculateCleanerPayForJob(id, companyId);
      }
    }

    if (staffIdsToSet !== undefined) {
      await supabase.from('job_assignments').delete().eq('job_id', id);
      if (staffIdsToSet.length > 0) {
        const assignments = staffIdsToSet.map((sId: string) => ({ job_id: id, staff_id: sId }));
        const { error: assignError } = await supabase.from('job_assignments').insert(assignments);
        if (assignError) throw assignError;
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

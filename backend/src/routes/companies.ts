import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { getPlanLimit } from '../config/plans';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Prefer company the user belongs to (req.companyId) so Payroll settings load/save the same company
    if (req.companyId) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', req.companyId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      res.json(data || {});
      return;
    }
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', req.user!.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/companies/usage — plan limits and current counts for UI (upgrade prompts). */
router.get('/usage', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const plan = req.companyPlan ?? 'starter';
    const limits = getPlanLimit(plan);
    const [staffRes, jobsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId).neq('role', 'admin'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    ]);
    res.json({
      plan,
      staffCount: staffRes.count ?? 0,
      jobCount: jobsRes.count ?? 0,
      staffLimit: limits.staff === Infinity ? null : limits.staff,
      jobLimit: limits.jobs === Infinity ? null : limits.jobs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/companies/checklist-templates — return company checklist templates (or empty; frontend uses defaults when empty). */
router.get('/checklist-templates', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('checklist_templates')
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      if ((error as any).code === '42703') {
        res.json({ templates: [] });
        return;
      }
      throw error;
    }
    const templates = (data as any)?.checklist_templates;
    res.json({ templates: Array.isArray(templates) ? templates : [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/companies/checklist-templates — save company checklist templates. */
router.put('/checklist-templates', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const { templates } = req.body ?? {};
  if (!Array.isArray(templates)) {
    res.status(400).json({ error: 'templates array required' });
    return;
  }
  try {
    const { error } = await supabase
      .from('companies')
      .update({ checklist_templates: templates })
      .eq('id', companyId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/companies — update company settings (e.g. default payment settings). */
router.patch('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }

  const {
    default_payment_method,
    default_payment_instructions,
    default_payment_terms_days,
    invoice_number_prefix,
    payroll_round_minutes,
    default_pay_type,
    default_hourly_rate,
    default_pay_percentage,
    default_fixed_pay,
  } = req.body ?? {};

  const updates: Record<string, unknown> = {};
  if (default_payment_method !== undefined) {
    updates.default_payment_method = default_payment_method;
  }
  if (default_payment_instructions !== undefined) {
    updates.default_payment_instructions = default_payment_instructions;
  }
  if (default_payment_terms_days !== undefined) {
    updates.default_payment_terms_days = default_payment_terms_days;
  }
  if (payroll_round_minutes !== undefined) {
    const val = Number(payroll_round_minutes);
    if ([5, 10, 15, 60].includes(val)) updates.payroll_round_minutes = val;
  }
  if (default_pay_type !== undefined && ['hourly', 'percentage', 'fixed'].includes(default_pay_type)) {
    updates.default_pay_type = default_pay_type;
  }
  if (default_hourly_rate !== undefined) {
    const v = Number(default_hourly_rate);
    updates.default_hourly_rate = Number.isNaN(v) ? null : v;
  }
  if (default_pay_percentage !== undefined) {
    const v = Number(default_pay_percentage);
    updates.default_pay_percentage = Number.isNaN(v) ? null : v;
  }
  if (default_fixed_pay !== undefined) {
    const v = Number(default_fixed_pay);
    updates.default_fixed_pay = Number.isNaN(v) ? null : v;
  }
  if (invoice_number_prefix !== undefined) {
    const prefix = typeof invoice_number_prefix === 'string'
      ? invoice_number_prefix.replace(/[^A-Za-z0-9-_]/g, '').toUpperCase().slice(0, 20) || null
      : null;
    updates.invoice_number_prefix = prefix;
  }
  if (req.body?.checklist_templates !== undefined) {
    updates.checklist_templates = req.body.checklist_templates;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

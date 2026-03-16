import { Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { getPlanLimit } from '../config/plans';
import { AuthRequest } from './auth';

/** Require req.companyId and req.companyPlan (set by resolveCompany). Check staff count vs plan limit. */
export async function checkStaffLimit(req: AuthRequest, res: Response, next: () => void): Promise<void> {
  const companyId = req.companyId;
  const plan = req.companyPlan ?? 'starter';
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const limit = getPlanLimit(plan);
  if (limit.staff === Infinity) {
    next();
    return;
  }
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .neq('role', 'admin');
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const current = count ?? 0;
  if (current >= limit.staff) {
    res.status(403).json({
      error: 'Plan limit reached',
      limit: 'staff',
      current,
      max: limit.staff,
      message: `Your plan allows up to ${limit.staff} staff. Upgrade to add more.`,
    });
    return;
  }
  next();
}

/** Check job count vs plan limit before creating a job. */
export async function checkJobLimit(req: AuthRequest, res: Response, next: () => void): Promise<void> {
  const companyId = req.companyId;
  const plan = req.companyPlan ?? 'starter';
  if (!companyId) {
    res.status(403).json({ error: 'No company' });
    return;
  }
  const limit = getPlanLimit(plan);
  if (limit.jobs === Infinity) {
    next();
    return;
  }
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const current = count ?? 0;
  if (current >= limit.jobs) {
    res.status(403).json({
      error: 'Plan limit reached',
      limit: 'jobs',
      current,
      max: limit.jobs,
      message: `Your plan allows up to ${limit.jobs} jobs. Upgrade to add more.`,
    });
    return;
  }
  next();
}

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';

export interface AuthRequest extends Request {
  user?: { id: string; email?: string; [key: string]: any };
  companyId?: string | null;
  role?: string | null;
  companyPlan?: string | null;
  trialEndsAt?: string | null;
  subscriptionStatus?: string | null;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'This endpoint requires a valid Bearer token. Please sign in again.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token?.trim()) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'This endpoint requires a valid Bearer token. Please sign in again.',
    });
    return;
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;
    req.user = user;
    next();
  } catch {
    res.status(401).json({
      error: 'Invalid Session',
      message: 'This endpoint requires a valid Bearer token. Please sign in again.',
    });
  }
};

/** Call after verifyToken. Sets req.companyId, req.role, req.companyPlan, req.trialEndsAt, req.subscriptionStatus. */
export const resolveCompany = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', req.user.id)
      .maybeSingle();

    if (pErr) throw pErr;
    req.companyId = profile?.company_id ?? null;
    req.role = profile?.role ?? null;

    if (profile?.company_id) {
      const { data: company, error: cErr } = await supabase
        .from('companies')
        .select('plan, trial_ends_at, subscription_status')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (!cErr && company) {
        req.companyPlan = company.plan ?? 'starter';
        req.trialEndsAt = company.trial_ends_at ?? null;
        req.subscriptionStatus = company.subscription_status ?? null;
      }
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

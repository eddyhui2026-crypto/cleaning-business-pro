import { Router, Response } from 'express';
import { createCheckoutSession } from '../services/stripe';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/billing/create-checkout-session — frontend expects this path
router.post('/create-checkout-session', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company associated with user' });
    return;
  }

  const email = req.body.email ?? req.user?.email;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // plan can be 'small' | 'medium' | 'large' from frontend; default handled in service
  const plan = typeof req.body.plan === 'string' ? req.body.plan : null;
  // interval can be 'monthly' | 'yearly'
  const interval = req.body.interval === 'yearly' ? 'yearly' : 'monthly';

  try {
    const { data: company } = await supabase
      .from('companies')
      .select('trial_ends_at')
      .eq('id', companyId)
      .single();

    const session = await createCheckoutSession(companyId, email, plan, interval, {
      appTrialEndsAtIso: company?.trial_ends_at ?? null,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/status/:companyId — only allow own company
router.get('/status/:companyId', async (req: AuthRequest, res: Response): Promise<void> => {
  const userCompanyId = req.companyId;
  const paramCompanyId = req.params.companyId;

  if (!userCompanyId || userCompanyId !== paramCompanyId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('subscription_status')
      .eq('id', paramCompanyId)
      .single();

    if (error) throw error;
    const status = data?.subscription_status === 'active' ? 'active' : 'inactive';
    res.json({ status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

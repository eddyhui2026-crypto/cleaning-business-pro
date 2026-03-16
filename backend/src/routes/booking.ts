import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { rateLimitAuth } from '../middleware/rateLimitAuth';

const router = Router();

/** GET /api/booking/company-by-slug/:slug — public; resolve company for booking portal */
router.get('/company-by-slug/:slug', rateLimitAuth(15 * 60 * 1000, 60), async (req, res: Response): Promise<void> => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    res.status(400).json({ error: 'Slug required' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, booking_slug')
      .eq('booking_slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json({ company_id: data.id, name: data.name, booking_slug: data.booking_slug });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/booking/company/:companyId/booking-info — public; company name + service catalog for customer booking form */
router.get('/company/:companyId/booking-info', rateLimitAuth(15 * 60 * 1000, 60), async (req, res: Response): Promise<void> => {
  const companyId = req.params.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Company ID required' });
    return;
  }
  try {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle();
    if (companyErr || !company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    const { data: services, error: servicesErr } = await supabase
      .from('company_services')
      .select('id, name, slug, description, price_type, base_price, suggested_price_min, suggested_price_max, display_order')
      .eq('company_id', companyId)
      .order('display_order', { ascending: true });
    if (servicesErr) throw servicesErr;
    res.json({ company: { id: company.id, name: company.name }, services: services ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/booking/company/:companyId/staff — public; staff list for booking (preferred staff dropdown) */
router.get('/company/:companyId/staff', rateLimitAuth(15 * 60 * 1000, 60), async (req, res: Response): Promise<void> => {
  const companyId = req.params.companyId;
  if (!companyId) {
    res.status(400).json({ error: 'Company ID required' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .in('role', ['staff', 'supervisor'])
      .order('full_name');
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

/** GET /api/booking/vapid-public-key — public; VAPID public key for Web Push (customer & admin frontends). */
router.get('/vapid-public-key', (_req, res: Response): void => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.status(503).json({ error: 'VAPID not configured' });
    return;
  }
  res.json({ vapidPublicKey: key });
});

export default router;

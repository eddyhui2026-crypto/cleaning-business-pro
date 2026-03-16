import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';

const router = Router();

const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim();

function requireInternalSecret(req: Request, res: Response, next: () => void): void {
  if (!INTERNAL_SECRET) {
    res.status(503).json({
      error: 'Internal API not configured',
      message: 'Set INTERNAL_API_SECRET in environment.',
    });
    return;
  }
  const headerSecret = req.headers['x-internal-secret'] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const secret = headerSecret || bearerSecret;
  if (secret !== INTERNAL_SECRET) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing internal secret.',
    });
    return;
  }
  next();
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/** Map staff count to plan (matches landing page: 1–10 starter, 11–20 standard, 21–30 premium) */
function planFromStaffCount(staffCount: number): 'starter' | 'standard' | 'premium' {
  if (staffCount <= 10) return 'starter';
  if (staffCount <= 20) return 'standard';
  return 'premium';
}

/**
 * POST /api/internal/create-trial-account
 * Headers: X-Internal-Secret: <INTERNAL_API_SECRET>  OR  Authorization: Bearer <INTERNAL_API_SECRET>
 * Body: { companyName, contactName, email, phone?, staffCount?, trialDays? }
 * Creates: Supabase Auth user → companies row → profiles (admin), returns login URL + temp password.
 */
router.post(
  '/create-trial-account',
  requireInternalSecret,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyName, contactName, email, phone, staffCount, trialDays } = req.body as {
        companyName?: string;
        contactName?: string;
        email?: string;
        phone?: string;
        staffCount?: number;
        trialDays?: number;
      };

      const name = (companyName || '').trim();
      const contact = (contactName || '').trim();
      const emailTrim = (email || '').trim().toLowerCase();

      if (!name || !contact || !emailTrim) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'companyName, contactName, and email are required.',
        });
        return;
      }

      const count = typeof staffCount === 'number' ? staffCount : 10;
      const plan = planFromStaffCount(count);
      const days = typeof trialDays === 'number' && trialDays > 0 ? trialDays : 14;
      const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const tempPassword = generateTempPassword();

      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: emailTrim,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: contact, company_name: name },
      });

      if (authErr) {
        console.error('Internal create-trial createUser error:', authErr);
        res.status(400).json({
          error: 'Failed to create login account',
          message: authErr.message,
        });
        return;
      }
      if (!authUser.user) {
        res.status(500).json({ error: 'Auth returned no user' });
        return;
      }

      const userId = authUser.user.id;

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .insert({
          name,
          plan,
          owner_id: userId,
          subscription_status: 'trialing',
          trial_ends_at: trialEndsAt,
          contact_email: emailTrim,
        })
        .select('id')
        .single();

      if (companyErr || !company) {
        console.error('Internal create-trial company insert error:', companyErr);
        res.status(500).json({
          error: 'Company creation failed',
          message: (companyErr as any)?.message ?? 'Insert failed',
        });
        return;
      }

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: userId,
        company_id: company.id,
        full_name: contact,
        email: emailTrim,
        phone: (phone || '').trim() || null,
        role: 'admin',
      });

      if (profileErr) {
        console.error('Internal create-trial profile insert error:', profileErr);
        res.status(500).json({
          error: 'Profile creation failed',
          message: (profileErr as any)?.message ?? 'Insert failed',
        });
        return;
      }

      const baseUrl = (process.env.FRONTEND_URL || 'https://cleaning-business-pro.vercel.app').replace(/\/$/, '');
      const loginUrl = `${baseUrl}/login`;

      res.status(201).json({
        loginUrl,
        email: emailTrim,
        temporaryPassword: tempPassword,
        companyName: name,
        companyId: company.id,
        trialEndsAt,
        plan,
        message: 'Trial account created. Send the customer the login URL, email, and temporary password.',
      });
    } catch (err: any) {
      console.error('Internal create-trial-account error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err?.message ?? String(err),
      });
    }
  }
);

export default router;

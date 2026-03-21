import { Router, Request, Response } from 'express';
import { createTrialAccount } from '../services/trialAccountService';
import { sendOwnerWelcomeEmail } from '../services/ownerWelcomeEmail';

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

/**
 * POST /api/internal/create-trial-account
 * Headers: X-Internal-Secret: <INTERNAL_API_SECRET>  OR  Authorization: Bearer <INTERNAL_API_SECRET>
 * Body: { companyName, contactName, email, phone?, staffCount?, trialDays? }
 * Creates: Supabase Auth user → companies row → profiles (admin).
 * Sends welcome email when RESEND_API_KEY + EMAIL_FROM are set.
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

      const result = await createTrialAccount({
        companyName: companyName || '',
        contactName: contactName || '',
        email: email || '',
        phone: phone || null,
        staffCount: typeof staffCount === 'number' ? staffCount : undefined,
        trialDays: typeof trialDays === 'number' ? trialDays : undefined,
      });

      const emailResult = await sendOwnerWelcomeEmail({
        to: result.email,
        contactName: result.contactName,
        companyName: result.companyName,
        loginUrl: result.loginUrl,
        temporaryPassword: result.temporaryPassword,
        trialEndsAt: result.trialEndsAt,
      });

      if (!emailResult.ok) {
        console.warn('[internal create-trial] Welcome email not sent:', emailResult.error);
      }

      res.status(201).json({
        loginUrl: result.loginUrl,
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        companyName: result.companyName,
        companyId: result.companyId,
        trialEndsAt: result.trialEndsAt,
        plan: result.plan,
        emailSent: emailResult.ok,
        message: emailResult.ok
          ? 'Trial account created. Login details were emailed to the customer.'
          : 'Trial account created. Email not sent (configure RESEND_API_KEY + EMAIL_FROM) — send login URL, email, and temporary password manually.',
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 500;
      const msg = err?.message || String(err);
      if (status === 400) {
        res.status(400).json({
          error: 'Failed to create login account',
          message: msg,
        });
        return;
      }
      console.error('Internal create-trial-account error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: msg,
      });
    }
  }
);

export default router;

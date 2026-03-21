import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createTrialAccount } from '../services/trialAccountService';
import { sendOwnerWelcomeEmail } from '../services/ownerWelcomeEmail';

const router = Router();

const isProd = process.env.NODE_ENV === 'production';

const registerTrialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many attempts', message: 'Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/public/register-trial
 * Self-service trial: creates admin + company + profile, emails login details (Resend).
 * Body: { companyName, contactName, email, phone?, staffCount? }
 * Honeypot: if "website" is non-empty, reject (bots).
 */
router.post('/register-trial', registerTrialLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      staffCount?: number | string;
      website?: string;
    };

    if (body.website && String(body.website).trim() !== '') {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const emailReady =
      !!(process.env.RESEND_API_KEY || '').trim() && !!(process.env.EMAIL_FROM || '').trim();
    if (isProd && !emailReady) {
      res.status(503).json({
        error: 'Registration temporarily unavailable',
        message: 'Please try again later or contact support.',
      });
      return;
    }

    let staffNum = 10;
    if (body.staffCount !== undefined && body.staffCount !== '') {
      const n = typeof body.staffCount === 'number' ? body.staffCount : parseInt(String(body.staffCount), 10);
      if (!Number.isNaN(n) && n > 0) staffNum = n;
    }

    const result = await createTrialAccount({
      companyName: body.companyName || '',
      contactName: body.contactName || '',
      email: body.email || '',
      phone: body.phone || null,
      staffCount: staffNum,
    });

    const emailResult = await sendOwnerWelcomeEmail({
      to: result.email,
      contactName: result.contactName,
      companyName: result.companyName,
      loginUrl: result.loginUrl,
      temporaryPassword: result.temporaryPassword,
      trialEndsAt: result.trialEndsAt,
    });

    if (!isProd && !emailResult.ok) {
      console.warn(
        '[register-trial] Email not sent (dev). Credentials:',
        result.email,
        result.temporaryPassword,
        result.loginUrl
      );
    }

    if (isProd && !emailResult.ok) {
      console.error('[register-trial] Account created but email failed:', result.email, emailResult.error);
    }

    res.status(201).json({
      ok: true,
      emailSent: emailResult.ok,
      message: emailResult.ok
        ? 'Check your inbox for your login details and welcome message.'
        : 'Your account was created but email could not be sent. Please contact support with this email address so we can send your login details.',
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const msg = err?.message || 'Registration failed';

    if (status === 400) {
      const lower = String(msg).toLowerCase();
      const taken =
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('exists') ||
        err?.code === 'EMAIL_TAKEN';
      if (taken) {
        res.status(409).json({
          error: 'Email already registered',
          message: 'An account with this email already exists. Try logging in or use Forgot password.',
        });
        return;
      }
      res.status(400).json({ error: 'Invalid registration', message: msg });
      return;
    }

    console.error('public register-trial error:', err);
    res.status(status).json({
      error: 'Registration failed',
      message: isProd ? 'Something went wrong. Please try again later.' : msg,
    });
  }
});

export default router;

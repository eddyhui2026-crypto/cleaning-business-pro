import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notifyCompany } from '../services/pushNotificationService';
import { supabase } from '../lib/supabaseClient';

const router = Router();

function pickSnippet(s: string, max = 180): string {
  const txt = (s || '').trim();
  if (!txt) return '';
  if (txt.length <= max) return txt;
  return txt.slice(0, max - 3) + '...';
}

/**
 * POST /api/support/report
 * Saves a support report (bug/feature/other) and notifies company admins via web push.
 *
 * Body:
 * - category: 'bug' | 'feature' | 'other'
 * - subject?: string
 * - message: string
 * - context_url?: string
 */
router.post('/report', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({ error: 'No company for this user' });
    return;
  }

  const { category, subject, message, context_url } = req.body ?? {};

  const safeCategory =
    typeof category === 'string' && ['bug', 'feature', 'other'].includes(category) ? category : 'bug';

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const reporterId = req.user?.id;
    const reporterEmail = req.user?.email ?? null;
    const contextUrl = typeof context_url === 'string' && context_url.trim() ? context_url.trim() : null;

    const { data: inserted, error: insertErr } = await supabase
      .from('support_reports')
      .insert({
        company_id: companyId,
        reporter_id: reporterId ?? null,
        category: safeCategory,
        subject: typeof subject === 'string' && subject.trim() ? subject.trim() : null,
        message: message.trim(),
        reporter_email: reporterEmail,
        context_url: contextUrl,
      })
      .select('id')
      .single();

    if (insertErr || !inserted?.id) {
      res.status(500).json({ error: 'Failed to save report', message: insertErr?.message ?? undefined });
      return;
    }

    const title = safeCategory === 'bug' ? 'New bug report' : safeCategory === 'feature' ? 'New feature request' : 'New support report';
    const body = [
      subject && subject.trim() ? `Subject: ${subject.trim()}` : `Category: ${safeCategory}`,
      pickSnippet(message),
      '',
      reporterEmail ? `From: ${reporterEmail}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await notifyCompany(companyId, {
      title,
      body,
      url: '/admin/settings',
      tag: `support-report-${inserted.id}`,
    });

    res.status(201).json({ success: true, id: inserted.id });
  } catch (err: any) {
    console.error('support/report error:', err);
    res.status(500).json({ error: 'Internal server error', message: err?.message ?? String(err) });
  }
});

export default router;


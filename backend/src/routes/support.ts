import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notifyCompany } from '../services/pushNotificationService';
import { supabase } from '../lib/supabaseClient';

const router = Router();

function requireSupportViewer(req: AuthRequest, res: Response, next: () => void): void {
  const env = (process.env.SUPPORT_VIEWER_EMAILS || 'eddyhui2026@gmail.com').toLowerCase();
  const allowed = env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const email = (req.user?.email || '').toLowerCase();
  if (!email || !allowed.includes(email)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

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

/**
 * GET /api/support/reports?limit=50
 * Viewer-only page for the person who maintains bugs.
 */
router.get('/reports', requireSupportViewer, async (req: AuthRequest, res: Response): Promise<void> => {
  const limitRaw = req.query.limit;
  const limit = (() => {
    const n = typeof limitRaw === 'string' ? Number(limitRaw) : Number(limitRaw);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(200, Math.floor(n)));
  })();

  try {
    const { data: reports, error } = await supabase
      .from('support_reports')
      .select('id, created_at, company_id, category, subject, message, reporter_email, context_url')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const companyIds = Array.from(new Set((reports ?? []).map((r: any) => r.company_id).filter(Boolean)));
    if (!companyIds.length) {
      res.json({ reports: [] });
      return;
    }

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    const companyNameMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));

    const mapped = (reports ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      company_id: r.company_id,
      company_name: companyNameMap.get(r.company_id) ?? 'Company',
      category: r.category,
      subject: r.subject,
      message: r.message,
      reporter_email: r.reporter_email,
      context_url: r.context_url,
    }));

    res.json({ reports: mapped });
  } catch (err: any) {
    console.error('support/reports error:', err);
    res.status(500).json({ error: 'Internal server error', message: err?.message ?? String(err) });
  }
});

export default router;


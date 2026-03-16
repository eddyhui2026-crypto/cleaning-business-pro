import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { verifyToken, resolveCompany } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { rateLimitReport } from '../middleware/rateLimitReport';
import { generateJobReportPdf } from '../services/reportPdf';

const router = Router();

// Public: GET /api/reports/report/:token — rate-limited; lookup by jobs.share_token only; 404 if invalid
router.get('/report/:token', rateLimitReport, async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  if (!token?.trim()) {
    res.status(404).json({ error: 'Report Not Found' });
    return;
  }

  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        company:companies (*)
      `)
      .eq('share_token', token.trim())
      .maybeSingle();

    if (error) {
      console.error('Report fetch error:', error);
      res.status(404).json({ error: 'Report Not Found' });
      return;
    }

    if (!job) {
      res.status(404).json({ error: 'Report Not Found' });
      return;
    }

    res.json(job);
  } catch (err: any) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Report Not Found' });
  }
});

// Public: GET /api/reports/report/:token/pdf — same as report but returns PDF (rate-limited)
router.get('/report/:token/pdf', rateLimitReport, async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  if (!token?.trim()) {
    res.status(404).json({ error: 'Report Not Found' });
    return;
  }
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, company:companies(name, logo_url)')
      .eq('share_token', token.trim())
      .maybeSingle();

    if (error || !job) {
      res.status(404).json({ error: 'Report Not Found' });
      return;
    }

    const company = (job as any).company || {};
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reportUrl = `${baseUrl}/report/${token}`;
    const scheduledAt = (job as any).scheduled_at
      ? new Date((job as any).scheduled_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    const details = (job as any).details || {};
    const checklistRaw = details.checklist;
    const checklist =
      checklistRaw?.tasks?.length > 0
        ? {
            template_name: checklistRaw.template_name || 'Checklist',
            tasks: (checklistRaw.tasks as any[]).map((t: any) => ({ label: t.label || '', completed: !!t.completed })),
          }
        : undefined;

    const pdfBuffer = await generateJobReportPdf({
      companyName: company.name || 'Company',
      clientName: (job as any).client_name || 'Customer',
      address: (job as any).address || undefined,
      scheduledAt,
      notes: (job as any).notes || undefined,
      checklist,
      beforePhotoCount: Array.isArray((job as any).before_photos) ? (job as any).before_photos.length : 0,
      afterPhotoCount: Array.isArray((job as any).after_photos) ? (job as any).after_photos.length : 0,
      reportUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=service-report-${(job as any).client_name || 'job'}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Report PDF error:', err);
    res.status(500).json({ error: 'Report Not Found' });
  }
});

// Protected: GET /api/reports/stats/:companyId — only allow own company
router.get('/stats/:companyId', verifyToken, resolveCompany, async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const paramCompanyId = req.params.companyId;

  if (!companyId || companyId !== paramCompanyId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const [jobsRes, staffRes] = await Promise.all([
      supabase.from('jobs').select('status, price').eq('company_id', companyId),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('role', ['staff', 'supervisor']),
    ]);

    const jobs = jobsRes.data ?? [];
    const completedJobs = jobs.filter((j: any) => j.status === 'completed');
    const revenue = completedJobs.reduce((sum: number, j: any) => sum + (parseFloat(j.price) || 0), 0);

    res.json({
      revenue,
      completionRate: jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0,
      totalJobs: jobs.length,
      activeStaff: staffRes.count ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

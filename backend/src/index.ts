import express from 'express';
import cors from 'cors';
import path from 'path';
import cron from 'node-cron';
import * as dotenv from 'dotenv';

import { verifyToken, resolveCompany } from './middleware/auth';
import { supabase } from './lib/supabaseClient';
import { generateRecurringJobs } from './services/recurringJobs';
import { cleanupOldJobPhotos } from './services/cleanupOldJobPhotos';
import companiesRouter from './routes/companies';
import staffRouter from './routes/staff';
import jobsRouter from './routes/jobs';
import reportsRouter from './routes/reports';
import billingRouter from './routes/billing';
import webhooksRouter from './routes/webhooks';
import adminRouter from './routes/admin';
import invoicesRouter from './routes/invoices';
import quotesRouter from './routes/quotes';
import customerRouter from './routes/customer';
import bookingRouter from './routes/booking';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

// CORS: restrict origin in production
const corsOptions = isProd && process.env.FRONTEND_URL
  ? { origin: process.env.FRONTEND_URL, optionsSuccessStatus: 200 }
  : {};
app.use(cors(corsOptions));

// Webhook must receive raw body — mount before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

// JSON for all other routes
app.use(express.json());

// Health check (no auth) — for debugging "can't get database data"
app.get('/api/health', async (_req, res) => {
  try {
    const { error } = await supabase.from('companies').select('id').limit(1);
    if (error) {
      res.status(503).json({ ok: false, error: 'Database error', detail: error.message });
      return;
    }
    res.json({ ok: true, database: 'connected' });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e?.message ?? 'Backend error' });
  }
});

// Auth + company resolution for API routes
const apiAuth = [verifyToken, resolveCompany];

app.use('/api/companies', apiAuth, companiesRouter);
app.use('/api/staff', apiAuth, staffRouter);
app.use('/api/jobs', apiAuth, jobsRouter);
// Reports: public GET /report/:token + protected GET /stats/:companyId (auth applied in router)
app.use('/api/reports', reportsRouter);
app.use('/api/billing', apiAuth, billingRouter);
app.use('/api/admin', apiAuth, adminRouter);
app.use('/api/admin/invoices', apiAuth, invoicesRouter);
app.use('/api/admin/quotes', apiAuth, quotesRouter);
app.use('/api/customer', customerRouter);
app.use('/api/booking', bookingRouter);

// Global error handler (optional)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: isProd ? 'Internal server error' : err?.message ?? 'Internal server error' });
});

// Recurring jobs: run every day at 08:00 (server local time)
cron.schedule('0 8 * * *', () => {
  generateRecurringJobs().catch((err) => console.error('Cron generateRecurringJobs:', err));
});

// Old job photos: run every day at 03:00 — clear photos older than 90 days (DB + storage)
cron.schedule('0 3 * * *', () => {
  cleanupOldJobPhotos().catch((err) => console.error('Cron cleanupOldJobPhotos:', err));
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
});

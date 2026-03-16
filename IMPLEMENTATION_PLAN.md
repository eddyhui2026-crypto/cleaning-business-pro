# Cleaning Business Pro – Step-by-Step Implementation Plan

This document provides exact file changes, code snippets, and folder structure to make the SaaS fully functional with Stripe billing, missing APIs, security fixes, route refactor, and environment configuration.

---

## Recommended Folder Structure (Backend)

```
backend/
├── .env
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # App entry: middleware, mount routes, listen
│   ├── middleware/
│   │   └── auth.ts              # verifyToken + getCompanyId helpers
│   ├── routes/
│   │   ├── companies.ts         # GET /api/companies
│   │   ├── staff.ts             # GET + POST /api/staff
│   │   ├── jobs.ts              # GET list, GET :id, GET staff/:staffId, POST, PATCH, DELETE, check-in, complete, photos
│   │   ├── reports.ts           # GET /api/reports/stats
│   │   ├── billing.ts           # POST /api/billing/create-checkout-session, GET status
│   │   └── webhooks.ts          # POST /api/webhooks/stripe (raw body)
│   ├── services/
│   │   ├── stripe.ts            # (existing) createCheckoutSession
│   │   └── reports.ts           # (existing) generateJobReport
│   └── lib/
│       └── supabaseClient.ts    # Export supabase (alias supabaseAdmin) for routes
```

---

## Step 1: Fix lib/supabaseClient and webhook import

### 1.1 File: `backend/src/lib/supabaseClient.ts`

**Change:** Export `supabase` so route files can use the same name (keep `supabaseAdmin` as alias for clarity).

```ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Backend Supabase credentials missing in .env');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { supabase };
export const supabaseAdmin = supabase;
```

### 1.2 File: `backend/src/routes/webhooks.ts`

**Change:** Import from lib so webhook can update DB.

```ts
import { supabase } from '../lib/supabaseClient';
```

(Replace `import { supabase } from '../lib/supabaseClient'` if it currently says `supabaseAdmin` or fix the lib export as above so `supabase` exists.)

---

## Step 2: Auth middleware with company resolution

### 2.1 Create: `backend/src/middleware/auth.ts`

```ts
import { Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';

export interface AuthRequest {
  user?: any;
  companyId?: string | null;
  role?: string;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = (req as any).headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid Session' });
  }
};

/** Call after verifyToken. Sets req.companyId and req.role from profiles. */
export const resolveCompany = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', (req as any).user.id)
      .maybeSingle();

    if (error) throw error;
    (req as any).companyId = profile?.company_id ?? null;
    (req as any).role = profile?.role ?? null;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
```

---

## Step 3: Route files (security: derive companyId, whitelist job fields)

### 3.1 Create: `backend/src/routes/companies.ts`

```ts
import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', (req as any).user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

---

### 3.2 Create: `backend/src/routes/staff.ts`

**GET /api/staff** – Use `req.companyId` from middleware (do not read from query).  
**POST /api/staff** – Create profile for the company; body: `name`, `role`, optional `phone`. Company comes from `req.companyId`.

```ts
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    return res.status(403).json({ error: 'No company associated with user' });
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone, company_id')
      .eq('company_id', companyId)
      .eq('role', 'cleaner');

    if (error) throw error;

    const formattedData = (data ?? []).map((s: any) => ({
      ...s,
      name: s.full_name || 'Unnamed Staff',
    }));

    res.json(formattedData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    return res.status(403).json({ error: 'No company associated with user' });
  }

  const { name, role = 'cleaner', phone } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          full_name: name.trim(),
          role: role === 'manager' ? 'manager' : 'cleaner',
          phone: phone || null,
          company_id: companyId,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

**Note:** If `profiles.id` is tied to `auth.users.id` (e.g. via trigger), you must create the user with Supabase Auth Admin first and then insert the profile with that `id`. The snippet above assumes profiles can be inserted without an auth user (e.g. invite-only or magic-link later). Adjust if your schema requires `profiles.id = auth.users.id`.

---

### 3.3 Create: `backend/src/routes/jobs.ts`

- Derive `companyId` from middleware for all job operations.
- Whitelist job update fields: `client_name`, `address`, `notes`, `status`, `price`, `before_photos`, `after_photos`. Handle `staffIds` or `staff_ids` for assignments only.
- **GET /api/jobs** – List jobs for `companyId` (from middleware).
- **GET /api/jobs/:id** – Single job; ensure `job.company_id === companyId`.
- **GET /api/jobs/staff/:staffId** – Jobs assigned to staff; require `staffId === req.user.id` (or admin same company) and filter by company.
- **POST /api/jobs** – Create job with `company_id = req.companyId`; ignore body `companyId`.
- **PATCH /api/jobs/:id** – Update only whitelisted fields + assignments; ensure job belongs to company.
- **DELETE /api/jobs/:id** – Ensure job belongs to company.
- **POST /api/jobs/check-in/:jobId** – Set status to `in_progress`; ensure requester is assigned staff or admin for that company.
- **POST /api/jobs/complete/:jobId** – Set status to `completed`; same auth.
- **POST /api/jobs/:jobId/photos** – Append `url` to `before_photos` or `after_photos`; ensure job belongs to company (or requester is assigned).

Use a shared helper to “load job and assert company” to avoid duplication.

```ts
import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const JOB_UPDATE_WHITELIST = [
  'client_name',
  'address',
  'notes',
  'status',
  'price',
  'before_photos',
  'after_photos',
] as const;

function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: any = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

async function getJobAndAssertCompany(
  jobId: string,
  companyId: string | null,
  userId: string,
  role: string
) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, staff_members:job_assignments(staff_id)')
    .eq('id', jobId)
    .single();

  if (error || !job) return { job: null, error: 'Job not found' };
  if (job.company_id !== companyId) return { job: null, error: 'Forbidden' };

  const isAssigned = (job.staff_members ?? []).some((a: any) => a.staff_id === userId);
  const canEdit = role === 'admin' || isAssigned;

  return { job, canEdit };
}

// GET /api/jobs — list jobs for user's company
router.get('/', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) return res.status(403).json({ error: 'No company' });

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        staff_members:job_assignments(staff:profiles(id, full_name))
      `)
      .eq('company_id', companyId)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;

    const formattedData = (data ?? []).map((job: any) => ({
      ...job,
      staff_members: (job.staff_members ?? [])
        .map((sm: any) => (sm.staff ? { id: sm.staff.id, name: sm.staff.full_name } : null))
        .filter(Boolean),
    }));

    res.json(formattedData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/staff/:staffId — jobs assigned to this staff (staffId must be current user for staff role)
router.get('/staff/:staffId', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  const role = (req as any).role;
  const userId = (req as any).user.id;
  const { staffId } = req.params;

  if (!companyId) return res.status(403).json({ error: 'No company' });
  if (role !== 'admin' && staffId !== userId) {
    return res.status(403).json({ error: 'Can only view own jobs' });
  }

  try {
    const { data: assignments } = await supabase
      .from('job_assignments')
      .select('job_id')
      .eq('staff_id', staffId);

    const jobIds = (assignments?.data ?? []).map((a: any) => a.job_id);
    if (jobIds.length === 0) return res.json([]);

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .in('id', jobIds)
      .eq('company_id', companyId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.json(jobs ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs — create job (company_id from middleware)
router.post('/', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) return res.status(403).json({ error: 'No company' });

  const { client_name, address, scheduled_at, staffIds, status, price, notes } = req.body;

  try {
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert([
        {
          client_name,
          address,
          scheduled_at,
          company_id: companyId,
          status: status || 'pending',
          notes: notes ?? '',
          price: price ?? '0',
          share_token: crypto.randomUUID(),
        },
      ])
      .select();

    if (jobError) throw jobError;
    const newJob = jobData![0];

    const ids = Array.isArray(staffIds) ? staffIds : [];
    if (ids.length > 0) {
      const assignments = ids.map((sId: string) => ({
        job_id: newJob.id,
        staff_id: sId,
      }));
      const { error: assignError } = await supabase.from('job_assignments').insert(assignments);
      if (assignError) throw assignError;
    }

    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id — whitelist fields + staff assignments
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) return res.status(403).json({ error: 'No company' });

  const { id } = req.params;
  const { staffIds, staff_ids, ...rest } = req.body;
  const staffIdsToSet = Array.isArray(staffIds) ? staffIds : Array.isArray(staff_ids) ? staff_ids : undefined;
  const updatePayload = pick(rest, JOB_UPDATE_WHITELIST);

  try {
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Job not found' });

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update(updatePayload)
        .eq('id', id)
        .eq('company_id', companyId);
      if (updateError) throw updateError;
    }

    if (staffIdsToSet !== undefined) {
      await supabase.from('job_assignments').delete().eq('job_id', id);
      if (staffIdsToSet.length > 0) {
        const assignments = staffIdsToSet.map((sId: string) => ({ job_id: id, staff_id: sId }));
        const { error: assignError } = await supabase.from('job_assignments').insert(assignments);
        if (assignError) throw assignError;
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) return res.status(403).json({ error: 'No company' });

  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/check-in/:jobId
router.post('/check-in/:jobId', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.id;
  const role = (req as any).role;
  const { jobId } = req.params;

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId, userId, role ?? '');
  if (err || !job) return res.status(err === 'Forbidden' ? 403 : 404).json({ error: err ?? 'Job not found' });
  if (!(role === 'admin' || (job.staff_members ?? []).some((a: any) => a.staff_id === userId))) {
    return res.status(403).json({ error: 'Not assigned to this job' });
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'in_progress' })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jobs/complete/:jobId
router.post('/complete/:jobId', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.id;
  const role = (req as any).role;
  const { jobId } = req.params;

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId, userId, role ?? '');
  if (err || !job) return res.status(err === 'Forbidden' ? 403 : 404).json({ error: err ?? 'Job not found' });
  if (!(role === 'admin' || (job.staff_members ?? []).some((a: any) => a.staff_id === userId))) {
    return res.status(403).json({ error: 'Not assigned to this job' });
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jobs/:jobId/photos — append photo URL to before_photos or after_photos
router.post('/:jobId/photos', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  const userId = (req as any).user.id;
  const role = (req as any).role;
  const { jobId } = req.params;
  const { url, type } = req.body;

  if (!url || !type || !['before', 'after'].includes(type)) {
    return res.status(400).json({ error: 'url and type (before|after) required' });
  }

  const { job, error: err } = await getJobAndAssertCompany(jobId, companyId, userId, role ?? '');
  if (err || !job) return res.status(err === 'Forbidden' ? 403 : 404).json({ error: err ?? 'Job not found' });
  if (!(role === 'admin' || (job.staff_members ?? []).some((a: any) => a.staff_id === userId))) {
    return res.status(403).json({ error: 'Not assigned to this job' });
  }

  const field = type === 'before' ? 'before_photos' : 'after_photos';
  const current = Array.isArray(job[field]) ? job[field] : [];
  const updated = [...current, url];

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ [field]: updated })
      .eq('id', jobId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/jobs/:id — single job (must be after /staff/:staffId and other specific routes)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) return res.status(403).json({ error: 'No company' });

  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        staff_members:job_assignments(staff:profiles(id, full_name))
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return res.status(error?.code === 'PGRST116' ? 404 : 500).json({ error: 'Job not found' });
    }

    const job = {
      ...data,
      staff_members: (data.staff_members ?? [])
        .map((sm: any) => (sm.staff ? { id: sm.staff.id, name: sm.staff.full_name } : null))
        .filter(Boolean),
    };
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Route order in `jobs.ts` is critical.** Define in this order so Express matches specific paths before generic `:id`:
1. `get('/')` — list
2. `get('/staff/:staffId')` — staff job list
3. `post('/')` — create
4. `post('/check-in/:jobId')` — check-in
5. `post('/complete/:jobId')` — complete
6. `post('/:jobId/photos')` — add photo
7. `get('/:id')` — single job
8. `patch('/:id')` — update
9. `delete('/:id')` — delete

---

### 3.4 Create: `backend/src/routes/reports.ts`

```ts
import { Router, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats/:companyId', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  const paramCompanyId = req.params.companyId;

  if (!companyId || companyId !== paramCompanyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const [jobsRes, staffRes] = await Promise.all([
      supabase.from('jobs').select('status, price').eq('company_id', companyId),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('role', 'cleaner'),
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
```

---

### 3.5 Update: `backend/src/routes/billing.ts`

- Add **POST /api/billing/create-checkout-session** (frontend calls this). Require auth; get `companyId` from middleware and email from body (or `req.user.email`).
- Add **GET /api/billing/status/:companyId** (or **GET /api/billing/status** and derive company). Return `{ status: 'active' | 'inactive' }` from `companies.subscription_status`; enforce that param `companyId` matches `req.companyId`.

```ts
import { Router, Response } from 'express';
import { createCheckoutSession } from '../services/stripe';
import { supabase } from '../lib/supabaseClient';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/billing/create-checkout-session — frontend expects this path
router.post('/create-checkout-session', async (req: AuthRequest, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    return res.status(403).json({ error: 'No company associated with user' });
  }

  const email = req.body.email ?? (req as any).user?.email;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const session = await createCheckoutSession(companyId, email);
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/status/:companyId — SubscriptionGuard; only allow own company
router.get('/status/:companyId', async (req: AuthRequest, res: Response) => {
  const userCompanyId = (req as any).companyId;
  const paramCompanyId = req.params.companyId;

  if (!userCompanyId || userCompanyId !== paramCompanyId) {
    return res.status(403).json({ error: 'Forbidden' });
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
```

---

### 3.6 Update: `backend/src/routes/webhooks.ts`

- Use **raw body** for Stripe (handled in index with `express.raw` for this path only).
- Import `supabase` from `../lib/supabaseClient` (after Step 1).
- Handle **customer.subscription.deleted** by setting `companies.subscription_status = 'inactive'` (get company from subscription metadata or customer if needed). Example below uses `metadata.companyId` if you store it on the subscription; otherwise you may need to look up by Stripe customer/subscription id.

```ts
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const router = Router();

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;

      if (companyId) {
        const { error } = await supabase
          .from('companies')
          .update({ subscription_status: 'active' })
          .eq('id', companyId);

        if (error) {
          console.error(`❌ DB Update Failed for Company ${companyId}:`, error);
          return res.status(500).json({ error: 'Database update failed' });
        }
        console.log(`✅ Subscription Activated for Company: ${companyId}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = (sub.metadata as any)?.companyId;
      if (companyId) {
        await supabase
          .from('companies')
          .update({ subscription_status: 'inactive' })
          .eq('id', companyId);
        console.log(`✅ Subscription set inactive for Company: ${companyId}`);
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

export default router;
```

**Note:** For `customer.subscription.deleted`, Stripe often does not send `companyId` in subscription metadata unless you set it when creating the subscription. If you don’t have it, you can store `company_id` in your DB when checkout completes (e.g. in a `subscriptions` table keyed by Stripe subscription id) and look it up here.

---

## Step 4: Mount routes and webhook raw body in `index.ts`

### 4.1 File: `backend/src/index.ts`

- Remove all inline route handlers.
- Apply `verifyToken` and `resolveCompany` to API routes that need auth; do **not** use `resolveCompany` for the webhook.
- Mount webhook route with `express.raw({ type: 'application/json' })` so Stripe signature verification works.
- Use a single `express.json()` for other routes; ensure the webhook path is registered **before** `express.json()` for the webhook path only (so the webhook gets raw body). Common pattern: create a dedicated app or route for the webhook that only has `express.raw()`.

**Recommended approach:**  
- Use `express.json()` globally.  
- For `POST /api/webhooks/stripe`, use a separate middleware stack that only parses raw body for that path. In Express you can do:  
  `app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhooksRouter)`  
  and mount the webhooks router only there. But then `webhooksRouter` must be the one that receives the raw body. So the order should be:

1. `cors()`
2. `express.json()` — for all other routes
3. Webhook route: mount with a middleware that replaces body with raw for that path, or mount the webhook path first with `express.raw()` and then the webhook router.

Actually in Express, if you do:

```ts
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhooksRouter);
```

then for requests to `/api/webhooks/stripe`, the raw body is in `req.body` (as Buffer) when it hits the router. So Stripe’s `constructEvent(req.body, sig, endpointSecret)` needs the raw Buffer — and `express.raw()` puts the raw body in `req.body`. So we must **not** run `express.json()` before the webhook route for that path. So order should be:

1. `cors()`
2. Webhook: `app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter)` — and in webhookRouter the route is `post('/stripe', ...)` so full path is `POST /api/webhooks/stripe`.
3. `app.use(express.json())` — for everything else.
4. Mount all other API routes (with verifyToken + resolveCompany where needed).

So the final index looks like this:

```ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import * as dotenv from 'dotenv';

import { verifyToken, resolveCompany } from './middleware/auth';
import companiesRouter from './routes/companies';
import staffRouter from './routes/staff';
import jobsRouter from './routes/jobs';
import reportsRouter from './routes/reports';
import billingRouter from './routes/billing';
import webhooksRouter from './routes/webhooks';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 4000;

// CORS first
app.use(cors());

// Webhook must receive raw body — mount before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

// JSON for all other routes
app.use(express.json());

// Auth + company resolution for all /api/* except webhooks
const apiAuth = [verifyToken, resolveCompany];

app.use('/api/companies', verifyToken, companiesRouter);
app.use('/api/staff', apiAuth, staffRouter);
app.use('/api/jobs', apiAuth, jobsRouter);
app.use('/api/reports', apiAuth, reportsRouter);
app.use('/api/billing', apiAuth, billingRouter);

app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
});
```

**Path alignment:**

- Frontend Billing calls `POST http://localhost:4000/api/create-checkout-session`. So either:
  - Mount billing at `app.use('/api', billingRouter)` and in billing define `router.post('/create-checkout-session', ...)`, or
  - Mount billing at `app.use('/api/billing', billingRouter)` and define `router.post('/create-checkout-session', ...)` so path is `/api/billing/create-checkout-session`.

The plan above uses **/api/billing** with routes **create-checkout-session** and **status/:companyId**. So frontend must call **POST /api/billing/create-checkout-session** (see Step 5).

---

## Step 5: Frontend – environment and API base URL

### 5.1 File: `frontend/.env.example` (create)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:4000
```

### 5.2 File: `frontend/.env` (local)

Add (or update):

```env
VITE_API_URL=http://localhost:4000
```

For production build, set `VITE_API_URL` to your backend URL (e.g. `https://api.yourdomain.com`).

### 5.3 Create: `frontend/src/lib/api.ts`

```ts
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, '')}${p}`;
}
```

### 5.4 Replace hardcoded API URLs in frontend

Search for `http://localhost:4000` and replace with `apiUrl('...')`. Examples:

- **Dashboard.tsx:**  
  `fetch(apiUrl('/api/jobs?companyId=' + companyId), { headers })`  
  → But we no longer send companyId; backend derives it. So use:  
  `fetch(apiUrl('/api/jobs'), { headers })`  
  (and remove `?companyId=...`).
- **CreateJobModal:**  
  `fetch(apiUrl('/api/jobs'), { method: 'POST', ... })`.  
  Request body: remove `companyId` (backend will use resolved company).
- **EditJobModal:**  
  `fetch(apiUrl(\`/api/jobs/${job.id}\`), { method: 'PATCH', ... })`.  
  Body can still send `staff_ids`; backend accepts both `staffIds` and `staff_ids`.
- **Billing.tsx:**  
  `fetch(apiUrl('/api/billing/create-checkout-session'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer ${session?.access_token}\` }, body: JSON.stringify({ email: session?.user?.email, companyId }) })`.  
  You can simplify to only send email (or nothing) and let backend use `req.companyId` and `req.user.email`.
- **StaffDashboard:**  
  `fetch(apiUrl(\`/api/jobs/staff/${userId}\`), { headers })`  
  and for PATCH job: `fetch(apiUrl(\`/api/jobs/${jobId}\`), { method: 'PATCH', ... })` (backend accepts PATCH for photo updates via whitelisted `before_photos`/`after_photos`).  
  StaffDashboard currently uses PUT for photo delete; either add PUT in backend or change frontend to PATCH with updated arrays (recommended: PATCH with full `before_photos`/`after_photos`).
- **StaffJobView:**  
  `fetch(apiUrl(\`/api/jobs/${jobId}\`))` for GET;  
  `fetch(apiUrl(\`/api/jobs/check-in/${jobId}\`), { method: 'POST', ... })` and  
  `fetch(apiUrl(\`/api/jobs/complete/${jobId}\`), { method: 'POST', ... })`.
- **SubscriptionGuard:**  
  `fetch(apiUrl(\`/api/billing/status/${companyId}\`), { headers: { Authorization: \`Bearer ${token}\` } })`.
- **CreateStaffModal:**  
  `fetch(apiUrl('/api/staff'), { method: 'POST', ... })`; body: `{ name, role }` (optional phone). Do not send companyId.
- **PhotoUpload:**  
  `fetch(apiUrl(\`/api/jobs/${jobId}/photos\`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer ${token}\` }, body: JSON.stringify({ url, type }) })`.

**Remove companyId from request bodies and query params** wherever the backend now derives it (jobs list, staff list, create job, billing, reports/stats). For **GET /api/reports/stats/:companyId**, frontend can keep passing companyId in the URL if the backend continues to validate that param equals `req.companyId` (as in the reports route above).

---

## Step 6: Frontend – send auth header and stop sending companyId

- Ensure every request to the backend (except login and public report) includes:  
  `Authorization: Bearer <session.access_token>`.
- Where the backend now derives companyId (jobs, staff, create job, billing, reports), remove `companyId` from:
  - Query params (e.g. `/api/jobs`, `/api/staff`).
  - Request body (e.g. create job, create-checkout-session).

Example for Dashboard (fetch jobs and staff):

```ts
const headers = {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json',
};
const [jobsRes, staffRes] = await Promise.all([
  fetch(apiUrl('/api/jobs'), { headers }),
  fetch(apiUrl('/api/staff'), { headers }),
]);
```

Reports stats: if the frontend currently calls `GET /api/reports/stats/${companyId}`, keep the URL but ensure backend validates `req.params.companyId === req.companyId` (already in the reports snippet). Alternatively, add a route **GET /api/reports/stats** that uses only `req.companyId` and no param.

---

## Step 7: Backend environment variables

### 7.1 File: `backend/.env.example`

```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
```

### 7.2 File: `backend/.env`

Ensure these exist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`. For local webhook testing, use `stripe listen --forward-to localhost:4000/api/webhooks/stripe` and put the printed signing secret in `STRIPE_WEBHOOK_SECRET`.

---

## Step 8: Database assumptions

- **companies:** `id`, `owner_id`, `subscription_status`, `name`, `contact_email`, `logo_url`, `report_footer`, etc.
- **profiles:** `id`, `full_name`, `role`, `phone`, `company_id`. If your RLS or triggers expect `profiles.id = auth.users.id`, then POST /api/staff must create the user via Supabase Auth Admin and then insert the profile with that id; otherwise the insert in the staff route may fail or create orphan profiles.
- **jobs:** `id`, `company_id`, `client_name`, `address`, `scheduled_at`, `status`, `price`, `notes`, `share_token`, `before_photos`, `after_photos` (array or jsonb).
- **job_assignments:** `job_id`, `staff_id`.

If `before_photos` or `after_photos` are not yet columns, add them (e.g. `jsonb default '[]'`).

---

## Checklist

- [ ] Backend: export `supabase` from `lib/supabaseClient.ts`, fix webhooks import.
- [ ] Backend: add `middleware/auth.ts` (verifyToken + resolveCompany).
- [ ] Backend: add `routes/companies.ts`, `staff.ts`, `jobs.ts`, `reports.ts`; update `billing.ts` and `webhooks.ts` as above.
- [ ] Backend: refactor `index.ts` to mount routes and webhook with raw body.
- [ ] Backend: add `.env.example` and document STRIPE_WEBHOOK_SECRET and FRONTEND_URL.
- [ ] Frontend: add `VITE_API_URL`, create `apiUrl()` in `src/lib/api.ts`, replace all `http://localhost:4000` with `apiUrl(...)`.
- [ ] Frontend: remove companyId from query/body where backend derives it; add Auth header to all API calls (Billing, SubscriptionGuard, etc.).
- [ ] Frontend: Billing page — call `POST /api/billing/create-checkout-session` with Auth header; optionally send only email or nothing.
- [ ] Frontend: StaffDashboard PATCH job for photo updates — use PATCH with full `before_photos`/`after_photos` if backend does not implement PUT.
- [ ] Stripe: Configure webhook in Dashboard to point to `https://your-api/api/webhooks/stripe`; for local dev use `stripe listen`.
- [ ] Test: Login as admin → create job, assign staff, open billing, run through checkout (test mode); as staff → view jobs, check-in, complete, add photos.

This plan gives you exact files to add/change and code snippets to make the Cleaning Business Pro SaaS fully functional with secure, server-derived companyId and proper Stripe and API wiring.

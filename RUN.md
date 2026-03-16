# Cleaning Business Pro – Multi-tenant UK App (Run Instructions)

## Flow

```
SQL (Supabase) → Backend (Express) → Frontend (Vite + React)
       ↓                  ↓                    ↓
  Plan limits      verifyToken +         PlanContext +
  (starter/         resolveCompany +     TrialBanner +
   standard/        planLimits            UpgradePrompt +
   premium)         rateLimitReport       UI variants
       ↓                  ↓                    ↓
  Stripe webhook   Report /report/:token   Calendar (simplified vs drag/drop)
  trial_ends_at    company_id from user    JobReport 404 handling
```

## 1. Database (Supabase)

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run in order:
   - **001_drop_tables.sql** – drops existing tables (safe).
   - **002_schema.sql** – creates extension, `companies`, `profiles`, `jobs`, `job_assignments`, `job_checklists`, `job_photos`, triggers.
   - **003_seed_plans.sql** – seeds 3 companies (Starter, Standard, Premium) and jobs.
3. Create at least one **Auth user** (Authentication → Users → Add user). Then link to a company:
   - In SQL: `UPDATE companies SET owner_id = '<auth-user-uuid>' WHERE plan = 'starter' LIMIT 1;`
   - Insert profile: `INSERT INTO profiles (id, company_id, full_name, email, role) VALUES ('<auth-user-uuid>', (SELECT id FROM companies WHERE plan = 'starter' LIMIT 1), 'Admin', 'your@email.com', 'admin');`

## 2. Backend (Node)

```bash
cd backend
npm install
cp .env.example .env   # fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_*, FRONTEND_URL
npm run dev
```

- **Plan limits:** Enforced in middleware (`planLimits.ts`): Starter 20 staff / 100 jobs, Standard 50 / 300, Premium unlimited.
- **14-day trial:** `companies.trial_ends_at`; backend exposes it via `resolveCompany` and GET `/api/companies`.
- **Public report:** GET `/api/reports/report/:token` – rate-limited (60/min per IP), no auth, 404 if token invalid.
- **company_id:** Always from logged-in user (never from client).

## 3. Frontend (Vite + React)

```bash
cd frontend
npm install
cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL=http://localhost:4000
npm run dev
```

- **apiUrl:** All API calls use `apiUrl(path)` and `Authorization: Bearer <token>`.
- **JobReport:** Fetches `apiUrl(\`/api/reports/report/${encodeURIComponent(token)}\`)`, shows "Report Not Found" on 404.
- **Plan UI:** Wrap app (or dashboard) with `PlanProvider`; use `usePlan()` for `isStarter`, `isStandardOrPremium`, `usage`, `trialEndsAt`. Show `TrialBanner` and `UpgradePrompt` when at limits.
- **UI variants:** Use `isStandardOrPremium` to show full Calendar (drag/drop) vs simplified list for Starter.

## 4. Stripe

- Backend: POST `/api/billing/create-checkout-session`, GET `/api/billing/status/:companyId`, webhook POST `/api/webhooks/stripe` (raw body).
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL` in backend `.env`. For local webhooks: `stripe listen --forward-to localhost:4000/api/webhooks/stripe`.

## 5. Plan limits summary

| Plan     | Staff | Jobs   | UI / features                          |
|----------|------:|-------:|----------------------------------------|
| Starter  | 20    | 100    | Simplified calendar, basic views       |
| Standard | 50    | 300    | Full calendar drag/drop, reports       |
| Premium  | ∞     | ∞      | Full + advanced reports, API          |

- Trial: 14 days; set `trial_ends_at` when creating company or via Stripe.
- Upgrade prompts: when `staffCount >= staffLimit` or `jobCount >= jobLimit`, show `UpgradePrompt` and block POST (backend returns 403 with message).

## 6. Backup / cleanup (optional)

- **Backfill share_token:** Run `backend/scripts/backfill-jobs-share-token.sql` in Supabase so all jobs have a UUID for report links.
- **Old jobs:** You can add a scheduled job or script that archives/deletes jobs where `scheduled_at < NOW() - INTERVAL '1 year'` if needed.

---

## 7. Troubleshooting: 攞唔到 Database 資料 / Syncing 一直轉圈

1. **Backend 有冇開？**
   - 去 `backend` 資料夾開 terminal，執行：`npm run backend` 或 `npm run dev`。
   - 見到 `🚀 API Server running at http://localhost:4000` 即係開咗。

2. **Health check（唔使登入）：**
   - 瀏覽器開：**http://localhost:4000/api/health**
   - 若果見到 `{"ok":true,"database":"connected"}` → backend 同 Supabase 都正常。
   - 若果 503 或 `detail: ...` → 多數係 `.env` 嘅 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 錯，或 Supabase project paused。

3. **Frontend 指去邊個 API？**
   - Frontend 預設用 `http://localhost:4000`（見 `frontend/src/lib/api.ts`）。
   - 若果 frontend 喺第二部機或 port，要喺 `frontend/.env` 設 `VITE_API_URL=http://...`。

4. **登入咗但冇資料？**
   - API 要 Bearer token；`resolveCompany` 會用 `profiles.company_id`。
   - 若果你個 user 喺 `profiles` 冇 `company_id`，會變成「No company」/ 403。
   - 去 Supabase → Table Editor → `profiles`，睇你個 user 嘅 `company_id` 有冇填；必要時 `UPDATE profiles SET company_id = '<公司 id>' WHERE id = '<你嘅 user id>';`

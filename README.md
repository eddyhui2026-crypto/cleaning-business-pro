\# Cleaning Business Pro SaaS



\### 🚀 啟動步驟



1\. \*\*後端 (Backend)\*\*

&nbsp;  - `cd backend`

&nbsp;  - `npm install`

&nbsp;  - 建立 `.env` 並填入 `STRIPE\_SECRET\_KEY`, `SUPABASE\_URL`, `SUPABASE\_SERVICE\_ROLE\_KEY`

&nbsp;  - `npm run dev`



2\. \*\*前端 (Frontend)\*\*

&nbsp;  - `cd frontend`

&nbsp;  - `npm install`

&nbsp;  - 建立 `.env` 並填入 `VITE\_SUPABASE\_URL`, `VITE\_SUPABASE\_ANON\_KEY`

&nbsp;  - `npm run dev`



\### 🛠️ 技術棧

\- \*\*Frontend\*\*: React + TypeScript + Tailwind + Lucide Icons

\- \*\*Backend\*\*: Node.js + Express + PDFKit + Stripe

\- \*\*Database\*\*: Supabase (PostgreSQL)


### Trial signup & welcome email

- `/signup` calls `POST /api/public/register-trial` — creates admin + company + profile and emails login link + temporary password (Resend).
- Backend env: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `CleanFlow <noreply@yourdomain.com>` after domain verify), `FRONTEND_URL` for links. See `backend/env.example`.
- In **production**, public signup returns **503** until both `RESEND_API_KEY` and `EMAIL_FROM` are set (avoids accounts with no email).
- Internal `POST /api/internal/create-trial-account` also sends the same welcome email when Resend is configured.

### Billing (Upgrade + Stripe Customer Portal)

- Run migration `033_companies_stripe_customer_id.sql` on Supabase (adds `companies.stripe_customer_id`).
- After a successful Checkout, webhooks store the Stripe Customer id; **Settings → Manage subscription** opens the [Stripe Customer Portal](https://docs.stripe.com/customer-management) (enable & configure products/cancellation in **Stripe Dashboard → Settings → Billing → Customer portal**).
- Dashboard header includes **Plans** → `/billing`; Settings has **Plans & upgrade** and **Manage subscription**.


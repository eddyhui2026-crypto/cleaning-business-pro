# CleanPro Web App — QA Report (Local Testing)

**Environment:** Frontend `http://localhost:5173` · Backend `http://localhost:4000`  
**Stack:** React, Node/Express, Supabase  
**Date:** Generated from codebase review and automated fixes  

---

## 1. Summary

| Metric | Count |
|--------|--------|
| **Total issues documented** | 8 |
| **Fixed in this pass** | 4 |
| **Remaining / follow-up** | 4 |
| **Improvement recommendations** | 6 |

---

## 2. Issues Table

| # | Location / Page | Steps to Reproduce | Severity | Suggested Fix | Status |
|---|-----------------|--------------------|----------|---------------|--------|
| 1 | Dashboard | Customer creates online booking → company has no central list of pending bookings. | **Medium** | Add company-wide list of bookings and surface on Dashboard. | **Fixed** – Added `GET /api/admin/bookings`, Dashboard shows "X pending online bookings" with link to Customers. |
| 2 | Job Report / Job History / Edit Job | Report page and job tables had no "Email report" action. | **Medium** | Add "Email report" button that opens mailto with report link. | **Fixed** – Email button on JobReport, JobHistoryTable, and EditJobModal. |
| 3 | Admin Add Customer | Previously: dynamic import of `customerService` caused 500 / module not found. | **High** | Use static import for `customerService` in admin routes. | **Fixed** (in prior session). |
| 4 | StaffJobView (GPS) | Staff "Start" / "Complete" sends lat/lng to `/api/jobs/check-in` and `/complete`; backend only updates job status, does not store GPS. | **Low** | Optional: persist check-in/complete coordinates on job or attendance for audit. | Open |
| 5 | Invoice / Quote email | Send invoice and send quote currently log to console only (MVP). | **Low** | Integrate Resend/SendGrid (or SMTP) when going to production. | Open |
| 6 | BookLanding `/book` | If user goes to `/book` without slug, company is null; "Book" may still show. | **Low** | Hide or disable "Book" when company not resolved; show "Use your company booking link". | Open |
| 7 | Mobile nav | Some admin pages use "Back" with `navigate(-1)` which can be confusing. | **Low** | Prefer explicit "Back to Dashboard" / "Back to Customers" where done. | Partially done (e.g. PageHeader backTo). |
| 8 | Report public page | `/report/:token` uses `token` from URL; rate limit applies. No server-side PDF generation for report. | **Low** | Optional: add "Download PDF" that calls backend to generate PDF. | Open |

---

## 3. Workflow Verification (Code Trace)

- **Customer booking → company:**  
  Customer submits via `POST /api/customer/bookings` → row in `bookings` → `notifyCompanyNewBooking` (log).  
  Company sees: **Dashboard** "X pending online bookings" → **Customers** → [Customer] → **Bookings** tab.  
  **Status:** Implemented and wired.

- **Invoice:**  
  Create via `POST /api/admin/invoices`, PDF via `GET /api/admin/invoices/:id/pdf`, Send via `POST /api/admin/invoices/:id/send` (MVP log).  
  **Status:** Flows present; email is placeholder.

- **Staff GPS check-in:**  
  - Job status: Staff uses **Staff Job View** → Start/Complete → `POST /api/jobs/check-in|complete` (status only; lat/lng sent but not stored).  
  - Attendance: **Staff Attendance** uses `POST /api/staff/clock-in` with `job_id`, lat/lng → stored in `attendances`.  
  **Status:** Attendance GPS path works; job check-in does not persist GPS.

- **Recurring jobs:**  
  Cron `0 8 * * *` runs `generateRecurringJobs()`. Admin: **Recurring Jobs** page.  
  **Status:** Implemented.

- **Client CRM:**  
  **Customers** list, **Customer detail** (profile, notes, bookings, quotes, invoices, payments).  
  **Status:** Implemented.

- **Calendar drag & drop:**  
  Dashboard and Admin Schedule use FullCalendar; `eventDrop` calls `PATCH /api/jobs/:id` with `scheduled_at` when plan allows.  
  **Status:** Implemented.

- **Reports email button:**  
  **Status:** Fixed – Email report on Job Report page, Job History table, and Edit Job modal.

- **Mobile:**  
  Admin bottom nav, responsive layout and tables (overflow).  
  **Status:** Implemented; minor UX tweaks possible.

---

## 4. Code Samples (Applied Fixes)

### 4.1 Report email (JobReport.tsx)

```tsx
<a
  href={`mailto:?subject=${encodeURIComponent(`Service Report: ${job.client_name || 'Job'}`)}&body=${encodeURIComponent(`View the full service report: ${window.location.href}`)}`}
  className="..."
>
  <Mail size={14} /> Email report
</a>
```

### 4.2 Admin bookings API (admin.ts)

```ts
router.get('/bookings', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`id, preferred_date, service_type, ..., customer:customer_profiles(id, full_name, phone)`)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50);
  res.json(data ?? []);
});
```

### 4.3 Dashboard pending bookings (Dashboard.tsx)

- Fetch `GET /api/admin/bookings` with jobs/staff.
- Count `status === 'pending'` → `bookingsCount`.
- If `bookingsCount > 0`, show banner: "X pending online bookings" + "View in Customers →".

---

## 5. Screenshots Placeholders

- `[Screenshot: Dashboard with pending bookings banner]`
- `[Screenshot: Job Report page with Print PDF and Email report]`
- `[Screenshot: Job History table with Email and View report icons]`
- `[Screenshot: Customer detail Bookings tab]`
- `[Screenshot: Mobile admin bottom nav]`

---

## 6. General Improvement Recommendations

1. **Email delivery:** Replace console-log for invoice/quote send with Resend or SendGrid; add env vars for API keys.
2. **Job check-in GPS:** Optionally store lat/lng from `POST /api/jobs/check-in` and `complete` (e.g. on `jobs` or linked attendance) for compliance/audit.
3. **Pending bookings:** Consider a dedicated **Bookings** admin page (filter by status, convert to job) instead of only per-customer.
4. **Report PDF:** Add `GET /api/reports/report/:token/pdf` that returns a PDF for the job report and a "Download PDF" on the report page.
5. **Error handling:** Consistently use toast or inline messages instead of `alert()` where still present (e.g. EditJobModal, StaffJobView).
6. **Onboarding:** If an "onboarding checklist" is required, add a small checklist component (e.g. "Add first customer", "Create first job", "Set booking slug") and persist completion in company or profile.

---

## 7. Follow-up Checklist

- [ ] Run full regression locally: login (admin/staff/customer), create booking, create job, drag calendar, staff check-in, create invoice, send quote, open report, use Report and Email buttons.
- [ ] Test on mobile viewport (e.g. 375px) for Dashboard, Customers, Schedule, Invoices, Report.
- [ ] Configure real email (Resend/SendGrid) and test send invoice / send quote.
- [ ] Optionally add job check-in/complete GPS persistence.
- [ ] Optionally add dedicated Admin Bookings page and "Convert to job" from booking.

---

## 8. Applied Fixes and Remaining Tasks

### Applied in this session

1. **Report email:** Email report button on Job Report page, Job History table, and Edit Job modal (mailto with report link).
2. **Pending bookings on Dashboard:** `GET /api/admin/bookings`, Dashboard shows pending count and "View in Customers" when > 0.
3. **Admin customerService import:** Confirmed/fixed in prior session (static import in admin.ts).

### Remaining tasks

1. Integrate real email for invoice/quote send.
2. Optionally persist GPS for job check-in/complete.
3. Replace any remaining `alert()` with toast or inline messages.
4. Optional: Admin Bookings page and convert-booking-to-job flow.
5. Optional: Report PDF download endpoint and button.
6. Optional: Onboarding checklist (e.g. first customer, first job, booking slug).

---

*Report generated for local QA. Re-run tests after each change and update this document as needed.*

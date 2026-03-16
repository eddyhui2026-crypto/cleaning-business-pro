# RECURRING JOBS — EXISTING vs MISSING

## STEP 1 — Check existing structure

### Columns (repeat_type, repeat_interval, repeat_until)

| Column         | Exists | Where |
|----------------|--------|--------|
| repeat_type    | **No** | —     |
| repeat_interval| **No** | —     |
| repeat_until   | **No** | —     |

None of these exist in `jobs` or any app table.

### Tables

| Table            | Exists | Notes |
|------------------|--------|--------|
| recurring_jobs   | **No** | —     |
| job_templates    | **No** | —     |

### Other

- **FullCalendar** (frontend) has internal “recurring” event types for UI only; no link to our DB.
- **Stripe** (backend) uses “recurring” for billing only.

**Conclusion:** No recurring-jobs or job-templates in the app. All of the following are missing and need to be added: `recurring_jobs` table, `generateRecurringJobs`, cron, APIs, admin UI.

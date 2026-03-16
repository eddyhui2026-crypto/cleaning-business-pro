# STEP 1 — SCAN CURRENT SYSTEM (GPS Clock In/Out + Timesheet + Payroll)

## Database tables

| Table              | Exists | Notes |
|--------------------|--------|--------|
| staff_attendance   | **No** | Not present. Need to create. |
| timesheets        | **No** | Not present. Will use staff_attendance for timesheet data. |
| clock_logs        | **No** | Not present. Will use staff_attendance. |

**Existing tables:** companies, profiles, jobs, job_assignments, job_checklists, job_photos (in `supabase/migrations/002_schema.sql`). Jobs has: id, company_id, client_name, address, scheduled_at, status, price, notes, share_token, before_photos, after_photos, created_at, updated_at. **No** job_latitude, job_longitude, start_time.

## Columns (attendance/timesheet)

| Column           | Exists | Where |
|------------------|--------|--------|
| clock_in_time    | **No** | — |
| clock_out_time   | **No** | — |
| clock_in_lat     | **No** | — |
| clock_in_lng     | **No** | — |
| clock_out_lat    | **No** | — |
| clock_out_lng    | **No** | — |
| total_hours      | **No** | — |

All missing; will be added on `staff_attendance`.

## Backend routes

| Route                        | Exists | Notes |
|-----------------------------|--------|--------|
| POST /api/staff/clock-in    | **No** | — |
| POST /api/staff/clock-out   | **No** | — |
| GET /api/admin/attendance  | **No** | — |

**Existing job-related:** POST `/api/jobs/check-in/:jobId` and POST `/api/jobs/complete/:jobId` exist. They only update job status (in_progress / completed); they do **not** store GPS or attendance. Request body lat/lng is sent from frontend but **not persisted** in backend.

## Frontend GPS usage

- **File:** `frontend/src/pages/StaffJobView.tsx`
- **Usage:** `navigator.geolocation.getCurrentPosition` is used when staff taps "Check in" or "Complete". Lat/lng are sent to `/api/jobs/check-in/:jobId` and `/api/jobs/complete/:jobId` (as `lat`, `lng`), but backend does not save them.
- **No** dedicated clock-in/clock-out UI or timesheet/payroll pages.

## Summary

| Area           | Status | Action |
|----------------|--------|--------|
| DB attendance  | Missing | Create staff_attendance; add job_latitude, job_longitude, start_time to jobs. |
| Clock-in/out API | Missing | Add POST /api/staff/clock-in, POST /api/staff/clock-out with GPS and rules. |
| Admin attendance API | Missing | Add GET /api/admin/attendance. |
| Payroll API    | Missing | Add GET /api/admin/payroll-hours. |
| Staff clock UI | Missing | Add StaffAttendancePanel with clock in/out and GPS. |
| Staff timesheet page | Missing | Add /staff/timesheet. |
| Admin attendance dashboard | Missing | Add AttendanceDashboard with filters. |
| GPS distance   | Missing | Enforce ≤100m for clock-in; add job lat/lng to jobs. |
| Double clock-in / no clock-out | Missing | Add validation in backend. |

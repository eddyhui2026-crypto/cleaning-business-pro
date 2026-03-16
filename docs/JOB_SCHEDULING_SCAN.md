# STEP 1 — JOB SCHEDULING & STAFF ASSIGNMENT — EXISTING vs MISSING

## Tables

| Table | Exists | Current structure | Missing |
|-------|--------|-------------------|---------|
| **job_assignments** | Yes | id, job_id, staff_id, UNIQUE(job_id, staff_id) | assigned_at, status (assigned/accepted/declined/completed) |
| **staff_schedule** | No | — | Full table (staff_id, work_date, start_time, end_time) |
| **staff_availability** | No | — | Not in current schema |

## Columns (in existing job_assignments)

| Column | Exists |
|--------|--------|
| job_id | Yes |
| staff_id | Yes |
| assigned_at | No |
| schedule_date | No (job time comes from jobs.scheduled_at) |
| start_time / end_time | No (on jobs: scheduled_at; optional job_start_time) |

## Backend routes

| Route | Exists | Notes |
|-------|--------|--------|
| POST /api/admin/assign-staff | No | Admin currently assigns via PATCH /api/jobs/:id with body staffIds |
| GET /api/staff/my-jobs | No | GET /api/jobs/staff/:staffId returns job list for staff (no assignment_id or assignment status) |
| POST /api/staff/job-response | No | — |

## Frontend

| Feature | Exists | Notes |
|---------|--------|--------|
| Calendar | Yes | Dashboard Schedule tab uses FullCalendar with jobs as events |
| Schedule | Yes | Same FullCalendar in overview + schedule tab |
| Job list | Yes | Job History tab (JobHistoryTable); staff see job cards on StaffDashboard |
| /staff/jobs page | No | No dedicated staff job list with Accept/Decline |
| /admin/schedule | No | No dedicated admin schedule page; schedule is inside Dashboard |
| Drag-and-drop staff to jobs | No | Edit Job modal has staff checkboxes, no calendar drag staff |

## Summary

- **Exists:** job_assignments (basic), jobs with scheduled_at, GET /api/jobs/staff/:staffId, admin calendar + job list, staff dashboard with job cards.
- **Missing:** job_assignments.assigned_at + status, staff_schedule table, POST assign-staff, GET my-jobs with assignment status, POST job-response, /staff/jobs page with Accept/Decline, /admin/schedule page, conflict detection, explicit “Today’s Jobs” time list.

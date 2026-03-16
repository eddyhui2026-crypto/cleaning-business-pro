# Code Review: Cleaning Business Pro

Senior software engineer & UI/UX review of the frontend codebase (React + Vite + Supabase).

---

## Code Issues

### 1. **Duplicated auth / session logic**
- **Problem:** `supabase.auth.getSession()` and `Authorization: Bearer ${session?.access_token}` are repeated in 20+ files (Dashboard, AdminSchedulePage, AdminCustomersPage, CreateJobModal, EditJobModal, etc.).
- **Impact:** Hard to change auth strategy, easy to miss a call when adding features, inconsistent error handling when session is null.

### 2. **App.tsx: routing and auth mixed with subscription**
- **Problem:** Route definitions are conditionally rendered based on `session`, `role`, and `subStatus`. The same `subStatus === 'active' ? <Page /> : <Navigate to="/billing" />` pattern is repeated for every admin route (15+ times).
- **Impact:** Verbose, error-prone when adding new admin routes; subscription guard logic is not reusable.

### 3. **App.tsx: loose typing**
- **Problem:** `useState<any>(null)` for session; no shared types for profile/company.
- **Impact:** Weaker type safety and IDE support.

### 4. **Dashboard.tsx: oversized component**
- **Problem:** Single file ~640 lines with many responsibilities: data fetch, calendar config, event mapping, alerts (no-show, invoices, debt, holidays), overview calendar, job history tab, settings tab, report modal, remark modal, map drawer, sidebar. Helper components (`SidebarButton`, `StatCard`) are defined at the bottom of the same file.
- **Impact:** Hard to test, hard to reuse (e.g. StatCard, modal patterns), difficult to reason about re-renders.

### 5. **Dashboard: duplicated event/status color logic**
- **Problem:** Event color by status (e.g. `#6366f1` for pending, `#10b981` for completed) is defined in the event mapping and again conceptually in CSS (`.fc-event.status-pending`). Duration-from-`estimated_hours` is computed in both `fetchData` and `handleEventDrop` with the same logic.
- **Impact:** Changing status colors or duration rules requires edits in multiple places.

### 6. **Inconsistent error handling**
- **Problem:** Some fetches use `try/catch` and set local error state (e.g. Dashboard `syncError`); others only `console.error` or ignore. No shared pattern for “session expired” or “network error”.
- **Impact:** Inconsistent UX when API fails.

### 7. **ToastContext: no-op fallback when outside provider**
- **Problem:** `useToast()` returns no-op functions when used outside `ToastProvider` instead of throwing. Callers may assume toasts are shown.
- **Impact:** Silent failures in miswired trees.

### 8. **PlanContext vs App subscription state**
- **Problem:** App.tsx derives `subStatus` from Supabase (profiles + companies); PlanContext fetches company/usage from backend. Two sources of truth for “is the company active?”.
- **Impact:** Risk of mismatch (e.g. Plan says active, App says inactive) and duplicate requests.

### 9. **Comments and naming**
- **Problem:** Mixed languages (e.g. Chinese comments in App.tsx “抓取 Profile”, “如果有公司 ID”); some vague names (`doFetch`, `pError`, `s`).
- **Impact:** Readability for an English-only team; harder onboarding.

### 10. **SubscriptionGuard underused**
- **Problem:** `SubscriptionGuard` exists but is not used; App implements its own redirect-to-billing logic in routes.
- **Impact:** Dead code and duplicated guard logic.

---

## Refactoring Suggestions

### 1. Centralize auth headers (new `lib/auth.ts`)

```ts
// frontend/src/lib/auth.ts
import { supabase } from './supabaseClient';

export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
}
```

Then in pages/components, replace repeated blocks with:

```ts
const headers = await getAuthHeaders();
const res = await fetch(apiUrl('/api/jobs'), { headers });
```

### 2. Extract subscription-aware route wrapper in App.tsx

Define a small component so each admin route is declared once:

```tsx
// At top of App.tsx or in components/AdminRoute.tsx
function AdminRoute({
  subStatus,
  companyId,
  sessionEmail,
  children,
}: {
  subStatus: string | null;
  companyId: string | null;
  sessionEmail?: string;
  children: React.ReactNode;
}) {
  if (subStatus !== 'active') {
    return <Navigate to="/billing" replace />;
  }
  return <>{children}</>;
}

// Usage for a single route:
<Route
  path="/admin/customers"
  element={
    <AdminRoute subStatus={subStatus} companyId={companyId}>
      <AdminCustomersPage companyId={companyId} />
    </AdminRoute>
  }
/>
```

You can then map a config array to avoid repeating Route + AdminRoute for every path.

### 3. Extract Dashboard sub-components and hooks

- **`hooks/useDashboardData.ts`:** Move `fetchData`, `events`, `staffList`, `bookingsCount`, `dashboardInvoices`, `staffLocations`, `loading`, `syncError` into a custom hook that takes `companyId` and returns `{ ... }`.
- **`components/dashboard/StatCard.tsx`:** Move `StatCard` to its own file and use consistent props interface.
- **`components/dashboard/SidebarButton.tsx`:** Same for sidebar nav (or a shared `AdminSidebar` that takes nav items).
- **`utils/eventColors.ts`:** Single place for status → color and duration from `estimated_hours`:

```ts
export const JOB_STATUS_COLORS: Record<string, string> = {
  pending: '#6366f1',
  in_progress: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

export function getEventDurationHours(details: unknown): number {
  const h = Number((details as any)?.estimated_hours);
  return (!Number.isNaN(h) && h > 0) ? Math.min(12, h) : 2;
}
```

### 4. useToast: throw when outside provider

```ts
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
```

This matches `useCustomerAuth` and avoids silent no-ops.

### 5. Type session and profile

```ts
// types/auth.ts (or in a shared types folder)
import type { Session } from '@supabase/supabase-js';

export interface Profile {
  role: 'admin' | 'staff' | 'supervisor';
  company_id: string | null;
}

export type { Session };
```

In App.tsx: `useState<Session | null>(null)` and type the Supabase profile select so `role` and `company_id` are typed.

### 6. Single source of truth for subscription status

- Prefer either (a) PlanContext to expose `subscriptionStatus` and have App consume it, or (b) a dedicated `AuthContext` that holds session, profile, and subscription status from one place. Avoid computing subscription in App from raw Supabase and again in PlanContext from the API unless they are explicitly the same contract (e.g. backend returns same status).

---

## UI/UX Improvements

### User flow
- **Login → Dashboard:** After login, redirect to `/dashboard` (already in place). Consider a short “Welcome back” toast or one-time tip for new users.
- **Billing gate:** When `subStatus !== 'active'`, redirect to `/billing` is correct. On the Billing page, make the primary CTA (“Upgrade” / “Subscribe”) very clear and ensure “Back” or “Logout” is available so users aren’t stuck.
- **Customer booking:** Ensure `/book` and `/customer/book` flows have a clear progress indicator (e.g. Step 1 → 2 → 3) and a way to go back without losing all input.

### Interaction clarity
- **Buttons:** Use consistent hierarchy: primary (e.g. “New Job”, “Save”) with one dominant style, secondary (e.g. “Cancel”) with a lighter style. Dashboard “Report” and “New Job” are both strong; consider making “New Job” the single primary CTA in the header.
- **Modals:** Report modal and Day remark modal: add explicit “Close” (X) and ensure focus is trapped inside the modal and restored on close. Use `aria-modal="true"` and `role="dialog"`.
- **Destructive actions:** Logout and any “Delete” actions should use a distinct style (e.g. outline or red) and, where appropriate, a confirmation step.

### Layout hierarchy
- **Dashboard:** The sidebar + main content is clear. On small screens, ensure the bottom nav (AdminBottomNav) matches the same sections as the sidebar so users don’t miss key areas. Consider matching “Job detail” in the sidebar to the same label as in the bottom nav (e.g. “Recurring” vs “Job detail”).
- **Tables (e.g. unpaid invoices):** Add a visible caption or title above the table and consider sticky header on scroll for long lists.

### Visual feedback
- **Loading:** Dashboard already shows “Syncing with Cloud Database…” and a spinner. Use the same pattern on other data-heavy pages (e.g. AdminCustomersPage, AdminSchedulePage) so users know when data is loading.
- **Save actions:** In the Day remark modal and similar forms, keep “Saving…” disabled state and consider a short success toast on save so users get confirmation.
- **Errors:** Show sync/API errors in a consistent way (e.g. inline banner + “Retry” button like on Dashboard) instead of only in console.

### Accessibility
- **Focus:** Focus styles are defined in `index.css` for `button`, `a`, `input`, etc. Ensure modals and the FAB don’t trap focus incorrectly and that the first focusable element in a modal receives focus when opened.
- **Labels:** Ensure all form inputs have associated `<label>` or `aria-label`. Report modal and Day remark modal already use labels; audit other forms (e.g. CreateJobModal, CustomerBookPage).
- **Color:** Status is conveyed by color (e.g. overdue red, completed green). Add text or icons (e.g. “Overdue”, checkmark) so status is clear without relying only on color.

### Mobile responsiveness
- **Dashboard:** Sidebar is hidden on small screens (`hidden lg:flex`); bottom nav appears. Ensure the FAB (QuickCreateFab) does not overlap the bottom nav (it uses `bottom-24 lg:bottom-8` which helps).
- **Tables:** Unpaid invoices table may overflow on small screens. Consider a card layout for each invoice on narrow viewports or horizontal scroll with a hint.
- **Modals:** Report and Day remark modals use `max-w-md` and `p-4`; ensure they don’t get cut off on short viewports (e.g. min-height and scroll inside modal body).

---

## Performance Improvements

### 1. Reduce unnecessary re-renders
- **Dashboard:** Move `baseCalendarProps`, `staticMapUrl`, and alert arrays into `useMemo` with the right dependencies (e.g. `events`, `staffLocations`, `dashboardInvoices`) so they aren’t recreated every render and don’t cause FullCalendar or child components to re-render unnecessarily.
- **Event handlers:** `handleEventDrop` depends on `events` and `fetchData`; ensure `fetchData` is stable (wrapped in `useCallback` with correct deps). Consider updating events optimistically in `handleEventDrop` without a full `fetchData()` refetch if the API response is sufficient.

### 2. Lazy load admin routes
- Use `React.lazy` and `Suspense` for heavy admin pages (e.g. AdminSchedulePage, AdminCustomersPage, Calendar) so the initial bundle is smaller and the app becomes interactive faster.

```tsx
const AdminSchedulePage = React.lazy(() => import('./pages/AdminSchedulePage'));
// In Routes:
<Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
  <AdminRoute ...><AdminSchedulePage companyId={companyId} /></AdminRoute>
</Suspense>
```

### 3. Avoid duplicate fetches
- PlanContext and App both trigger fetches on mount. If App already has `companyId` and subscription status, consider having PlanContext read from an AuthContext or from the same initial load instead of a second round of requests for company/usage.

### 4. Debounce or batch remark saves
- If the user types quickly in the Day remark modal, you could debounce the save or at least avoid double-clicks by keeping the button disabled until the request completes (already partially in place).

### 5. Static map and images
- Dashboard static map URL is computed every render. Memoize it (e.g. `useMemo` on `staffLocations` and API key). Use `loading="lazy"` for images (already used for the map); ensure other list images do the same.

---

## Final Optimized Version

Delivered as concrete changes in the repo:

1. **`frontend/src/lib/auth.ts`** – New helper `getAuthHeaders()` and optional `fetchWithAuth()` to remove duplicated session logic.
2. **`frontend/src/App.tsx`** – Refactor: typed state, `AdminRoute` component, route config array for admin routes, and English comments.

You can then gradually:
- Replace `getSession()` + manual headers in each file with `getAuthHeaders()` or `fetchWithAuth(apiUrl(...))`.
- Split Dashboard into `useDashboardData`, `StatCard`, and sidebar components.
- Add `useMemo` for Dashboard’s heavy derived values and consider lazy routes for admin pages.

These steps will simplify the codebase, improve maintainability, and set a clear pattern for new features.

# UI/UX Improvement Plan — Cleaning Business Pro (UK)

**Audience:** UK cleaning companies, 2–20 staff.  
**Goals:** Speed, clarity, minimal clicks. UK English throughout.  
**Stack:** React, Tailwind CSS, FullCalendar.

---

## 1. Layout & Responsiveness

### 1.1 Current state
- Admin Dashboard uses a **fixed 288px sidebar** (`w-72`) that **hides below `lg`** (`hidden lg:flex`). On tablet/small desktop there is **no sidebar** and no visible nav to Schedule, Customers, etc.
- Many list pages use `max-w-4xl` or `max-w-5xl` with full-width tables; tables can overflow on small screens without horizontal scroll wrappers.
- Modals are often `max-w-md` or `max-w-lg`; some forms (e.g. Create Job with postcode lookup) feel cramped on mobile.
- Inconsistent page headers: some use `navigate(-1)` (back), others a direct link; header height and padding vary (e.g. `p-4` vs `px-8`).

### 1.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| No nav on tablet when sidebar hidden | **High** | Add a persistent bottom nav or hamburger menu for admin that shows the same links as the sidebar (Dashboard, Schedule, Customers, Invoices, Quotes, etc.). |
| Table overflow on mobile | **High** | Wrap all data tables in `<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">` and use `min-w-[600px]` on the table so it scrolls horizontally on small screens. |
| Modal width on small screens | **Medium** | Use `max-w-[calc(100vw-2rem)] sm:max-w-md` and ensure modals have `max-h-[90vh] overflow-y-auto` for long forms. |
| Consistent page header | **Medium** | Standardise: left = back link (explicit route, e.g. “Back to Customers”), centre/right = title + primary action. Use a shared `<PageHeader>` component. |

### 1.3 Sample: Responsive table wrapper

```html
<!-- Wrap any full-width table -->
<div class="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 rounded-2xl border border-slate-200 bg-white">
  <table class="w-full min-w-[600px] text-left border-collapse">
    <!-- thead / tbody -->
  </table>
</div>
```

### 1.4 Sample: Mobile-first page header component

```tsx
// PageHeader.tsx — reusable
export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel,
  action,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="bg-white border-b border-slate-100 px-4 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="p-2 -ml-2 hover:bg-slate-100 rounded-xl shrink-0"
            aria-label={backLabel ?? 'Back'}
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 truncate">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
```

---

## 2. Colors, Typography & Visual Hierarchy

### 2.1 Current state
- **Primary actions** mix `bg-indigo-600`, `bg-slate-900`, and sometimes `bg-emerald-600` (e.g. Approve). No single “primary” colour for the main CTA on each screen.
- **Text:** Mix of `font-bold`, `font-black`, `text-sm`, `text-xl`, etc. without a clear scale (e.g. page title vs section vs body).
- **Backgrounds:** `bg-slate-50`, `bg-[#F8FAFC]` and white cards; generally fine but some contrast issues (e.g. grey text on grey background).
- **Status colours** are consistent (green completed, blue in progress, red cancelled, indigo pending); keep these.

### 2.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Single primary CTA colour | **High** | Use **one** primary colour for the main action per page (e.g. “New Job”, “Save”, “Send invoice”). Recommend: `bg-indigo-600 hover:bg-indigo-700` for primary; reserve `bg-slate-900` for secondary (e.g. “Cancel”, “Back”). Use green only for success/approve. |
| Typography scale | **High** | Define a simple scale in `index.css` or Tailwind config: page title `text-2xl font-bold` (or `font-extrabold`), section title `text-lg font-semibold`, body `text-base`, caption `text-sm text-slate-500`. Use consistently. |
| Button hierarchy | **High** | Primary: filled indigo. Secondary: outline `border-2 border-slate-300 text-slate-700`. Danger: outline red for delete. Same padding: `px-5 py-2.5` or `py-3` for main buttons. |
| Focus states | **Medium** | Ensure all interactive elements have visible focus: `focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2` for buttons/inputs (accessibility). |

### 2.3 Recommended colour tokens (add to CSS or Tailwind)

```css
/* index.css — add under :root */
:root {
  /* Primary: main CTAs, links, active nav */
  --color-primary: 99 102 241;   /* indigo-600 */
  --color-primary-hover: 79 70 229; /* indigo-700 */
  /* Surface */
  --color-surface: 248 250 252;   /* slate-50 */
  --color-card: 255 255 255;
  /* Text */
  --color-text: 30 41 59;        /* slate-800 */
  --color-text-muted: 100 116 139; /* slate-500 */
  /* Status (keep existing) */
  --color-success: 16 185 129;
  --color-warning: 245 158 11;
  --color-error: 239 68 68;
}
```

### 2.4 Sample: Primary vs secondary button classes

```html
<!-- Primary: one per section -->
<button class="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
  Save &amp; send quote
</button>

<!-- Secondary -->
<button class="px-5 py-2.5 rounded-xl font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
  Cancel
</button>
```

---

## 3. Navigation & Interaction

### 3.1 Current state
- **Dashboard sidebar:** Only visible from `lg` up; no mobile/tablet nav. Links go to Schedule, Customers, Invoices, Quotes, etc. “Overview” vs “Schedule” vs “Job History” are tabs inside Dashboard, which can be unclear.
- **Layout.tsx** exists but uses different nav (Dashboard, Jobs & Calendar, Staff, Settings) and points to `/calendar` — may be unused if admin always uses Dashboard.
- **Back behaviour:** Mix of `navigate(-1)` and explicit routes; `navigate(-1)` can take users out of the app if they arrived via direct link.
- **Customer portal:** Clear “New Booking” and “Log out”; customer dashboard sections (Quotes, Invoices, Bookings, Jobs) are stacked vertically — good.

### 3.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Admin nav on small screens | **High** | Add a top bar or bottom nav for admin when sidebar is hidden: icon links to Dashboard, Schedule, Customers, Invoices (and optionally Quotes). Reuse same routes as sidebar. |
| Always use explicit “Back to X” | **High** | Replace `navigate(-1)` with e.g. `navigate('/admin/customers')` and label “Back to customers” so users never lose context. |
| Clarify Dashboard vs Schedule | **Medium** | In sidebar, label clearly: “Dashboard” (overview + mini calendar) and “Schedule” (full calendar + drag). Optionally add a one-line tooltip: “Overview and today’s schedule” vs “Full calendar and rescheduling”. |
| Breadcrumbs on deep pages | **Low** | On Customer detail, Quote form, Invoice detail add simple breadcrumbs: e.g. Customers > John Smith; Quotes > New quote. |

### 3.3 Sample: Bottom nav for admin (mobile/tablet)

```tsx
// Show only when sidebar is hidden (e.g. below lg)
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-pb flex justify-around py-2">
  <NavLink to="/dashboard" className="flex flex-col items-center gap-1 text-slate-500 aria-[current=page]:text-indigo-600">
    <LayoutDashboard size={22} />
    <span className="text-xs font-medium">Dashboard</span>
  </NavLink>
  <NavLink to="/admin/schedule" className="...">...</NavLink>
  <NavLink to="/admin/customers" className="...">...</NavLink>
  <NavLink to="/admin/invoices" className="...">...</NavLink>
</div>
<!-- Add padding-bottom to main content when this is visible so content isn’t hidden -->
<main className="pb-20 lg:pb-0 ...">
```

---

## 4. Forms & Data Entry

### 4.1 Current state
- **Create Job:** Postcode lookup, door number, address, date/time, staff multi-select, notes, price. Uses `alert()` for errors and Google dependency message.
- **Customer add:** Full name, phone, email, address, notes. Required validation only on phone; no inline validation or clear “saved” feedback.
- **Invoice create:** Customer dropdown, line items (description, qty, unit price, amount), due date. Amounts auto-calculated — good.
- **Quote form:** Customer select, service, quantity, unit price, notes. Total auto-calculated — good.
- **Booking (customer):** Date, service type, optional staff, address, notes. Error shown in red box; success = full-page success state — good.

### 4.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Replace `alert()` with in-form messages | **High** | Use a small inline error block below the field or at top of form (e.g. “Please enter a postcode first”) and for API errors. Same pattern for success: “Customer saved” toast or inline message. |
| Group related fields | **High** | Use visual grouping: “Client details” (name, phone, email), “Address” (postcode, lookup, address line), “Schedule” (date, time), “Team & price” (staff, price, notes). Section headings + optional borders/cards. |
| Placeholders and hints | **Medium** | Add UK-friendly placeholders: “e.g. SW1A 1AA”, “07XXX XXXXXX”, “£0.00”. For postcode: “Enter postcode then click Look up address”. |
| Required field indicators | **Medium** | Mark required labels with “*” or “(required)” and ensure focus and error state on first invalid field on submit. |
| Save feedback | **Medium** | After PATCH/POST success, show a short-lived message: “Saved” or “Quote sent” (e.g. 3s) so users don’t double-submit. |

### 4.3 Sample: Form section and error block

```html
<fieldset class="space-y-4 rounded-2xl border border-slate-200 p-5 bg-slate-50/50">
  <legend class="text-sm font-semibold text-slate-700 px-2">Client details</legend>
  <div>
    <label for="client_name" class="block text-sm font-medium text-slate-700 mb-1">Full name <span class="text-red-500">*</span></label>
    <input id="client_name" type="text" class="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. John Smith" />
  </div>
  <!-- ... -->
</fieldset>

<!-- Inline error -->
{error && (
  <div class="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-2" role="alert">
    <AlertCircle class="shrink-0 mt-0.5" size={18} />
    {error}
  </div>
)}
```

### 4.4 Sample: Success toast (simple CSS)

```css
/* Toast — fixed bottom or top */
.toast-success {
  @apply fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-lg;
  animation: toastIn 0.3s ease-out;
}
@keyframes toastIn {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
```

---

## 5. Calendar & Job Management

### 5.1 Current state
- FullCalendar used on Dashboard (overview + schedule tab) and Admin Schedule. Events show client name + staff names; colours by status.
- Drag-and-drop enabled on Schedule page; on Dashboard only for Standard/Premium plans.
- No explicit “overdue” or “today” highlight; no recurring-job badge on events.

### 5.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Overdue jobs | **High** | If `scheduled_at` is in the past and status not completed/cancelled, render event with a distinct style (e.g. red border, or “Overdue” chip). Optionally show count in Dashboard header. |
| Today highlight | **Medium** | Keep `nowIndicator`; ensure today’s column has a subtle background (FullCalendar `--fc-today-bg-color` is already set). Consider a “Today” button in toolbar that scrolls to current time. |
| Recurring jobs | **Medium** | If an event comes from a recurring template, add a small icon or badge (e.g. “Recurring”) so staff can see at a glance. |
| Staff assignment cue | **Medium** | “Unassigned” already in title; keep it. Optionally use a different border or icon for unassigned events (e.g. dashed border). |
| Drag affordance | **Low** | On Schedule page, add a one-line hint: “Drag jobs to reschedule” (already added). Ensure cursor is `grab`/`grabbing` on events (FullCalendar default). |

### 5.3 Sample: Overdue event style (FullCalendar)

```css
/* In index.css — for events that you tag with a class when overdue */
.fc-event.overdue {
  border-left: 4px solid rgb(239 68 68) !important;
  background-color: rgb(254 226 226) !important; /* red-100 */
}
```

In event object, add `classNames: ['overdue']` when `scheduled_at < now && status !== 'completed' && status !== 'cancelled'`.

---

## 6. Reports, Feedback & Notifications

### 6.1 Current state
- **Reports:** Public job report by token; no “email report” or “share” button in UI. Download is implicit (view only).
- **Success/error:** Mix of `alert()`, inline red boxes, and no feedback (e.g. silent save). Trial banner and some modals show messages.
- **Notifications:** No global toast or notification centre; backend sends emails (or logs) but no in-app “Quote sent” / “Invoice sent” confirmation pattern.

### 6.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Consistent success/error UI | **High** | Use one pattern: inline message at top of form or a small toast (bottom centre). For destructive actions (e.g. delete), use modal confirmation + then success toast. |
| After “Send invoice” / “Send quote” | **High** | Show a short success message: “Quote sent to [email]” or “Invoice sent” and update list (e.g. status badge). Avoid relying only on server response without UI update. |
| Report page | **Medium** | On public report page, add a “Download PDF” or “Print” button if you add PDF generation; optionally “Share link” that copies the URL. |
| Loading states | **Medium** | All async actions (Save, Send, Submit) should show loading state on the button (spinner + disabled). You already do this in many places; ensure every submit does. |

### 6.4 Sample: Inline success message

```html
{successMessage && (
  <div class="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2" role="status">
    <CheckCircle size={20} class="shrink-0" />
    {successMessage}
  </div>
)}
```

---

## 7. User Onboarding & Guidance

### 7.1 Current state
- No first-time tour or tooltips. Empty states exist (e.g. “No customers yet”, “No quotes found”) with primary action.
- Some flows are implicit (e.g. “Create job from calendar” by clicking a slot vs “New Job” in header).

### 7.2 Recommendations

| Issue | Priority | Action |
|-------|----------|--------|
| Empty state CTAs | **High** | Every empty list should have one clear action: “Add your first customer”, “Create a quote”, “New job”. You already do this in places; apply everywhere. |
| First-time hints | **Medium** | Optional: short one-time tooltips on Dashboard (“Click a slot to create a job”, “Drag jobs to reschedule on Schedule page”). Can use a simple “Got it” dismiss stored in localStorage. |
| Help text on complex forms | **Medium** | Postcode lookup: “Enter a UK postcode and click Look up to fill the address.” Invoice line items: “Add rows for each service or item.” |
| Report link for customers | **Low** | Where you show “View report” (e.g. customer dashboard), add a short line: “Share this link with your client so they can view the job report.” |

### 7.3 Sample: Empty state with CTA

```html
<div class="rounded-2xl border border-slate-200 border-dashed bg-slate-50/50 p-12 text-center">
  <div class="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
    <FileText class="text-slate-400" size={32} />
  </div>
  <h3 class="text-lg font-semibold text-slate-800 mb-1">No quotes yet</h3>
  <p class="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Create a quote from a customer to get started.</p>
  <button class="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
    New quote
  </button>
</div>
```

---

## 8. High-Level Recommendations by Page/Feature

### 8.1 By priority

**High (do first)**  
- Add mobile/tablet admin nav (bottom or hamburger) when sidebar is hidden.  
- Use one primary button colour (indigo) for main CTAs; keep green for success/approve only.  
- Replace all `alert()` with inline or toast messages.  
- Wrap data tables in overflow wrapper for small screens.  
- Explicit “Back to X” links instead of `navigate(-1)`.  
- Show success feedback after Send quote / Send invoice.  
- Mark required form fields and group fields (sections).  
- Highlight overdue jobs on calendar.

**Medium**  
- Typography scale and consistent heading sizes.  
- Shared `<PageHeader>` and consistent header layout.  
- Modal max-width and scroll on small screens.  
- Focus styles for accessibility.  
- Today/now indicator and optional “Recurring” badge on events.  
- Loading state on every submit button.  
- Optional first-time hints (tooltips) and help text on complex forms.  
- “Download / Print” on report page if you add PDF.

**Low**  
- Breadcrumbs on customer detail and quote form.  
- Dashed border or icon for unassigned jobs.  
- Short “Share this report link” hint for customers.  
- Optional micro-interactions (e.g. slight scale on button press).

### 8.2 By page (summary)

| Page / area | High | Medium | Low |
|-------------|------|--------|-----|
| **Dashboard (admin)** | Mobile nav, primary CTA colour | Typography, focus | — |
| **Schedule** | — | Overdue + today | Drag hint |
| **Customers / CRM** | Table overflow, Back link, no alert() | PageHeader, success toast | Breadcrumbs |
| **Customer detail** | Save feedback, required fields | Tab labels clear | Delete confirmation style |
| **Invoices** | Table overflow, Send success message | Modal scroll | — |
| **Quotes** | Same as Invoices + form grouping | — | — |
| **Create Job / Edit Job** | No alert(), field groups, placeholders | Postcode help text | — |
| **Booking (customer)** | — | Help text under postcode | — |
| **Staff dashboard** | — | Loading on actions | — |
| **Login / Billing** | — | Focus ring, consistent button | — |
| **Reports (public)** | — | Download/Print if PDF exists | Share hint |

### 8.3 UX patterns to adopt

1. **One primary action per screen** — e.g. “New Job” on Dashboard, “Save” in modals.  
2. **Progressive disclosure** — Keep forms short; optional sections (e.g. “Add notes”) can be collapsed by default.  
3. **Consistent destructive flow** — Delete = secondary/outline red button, then confirmation modal, then success message.  
4. **UK formats** — Dates `DD/MM/YYYY`, currency £, postcode hints (e.g. SW1A 1AA), phone 07XXX XXXXXX.  
5. **Micro-interactions** — `active:scale-[0.98]` on buttons for press feedback; optional 200ms transition on modal open.

---

## 9. CSS/HTML Snippets — Key Fixes

### 9.1 Global: focus ring for accessibility

```css
/* index.css — add to @layer base or after Tailwind */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  @apply outline-none ring-2 ring-indigo-500 ring-offset-2;
}
```

### 9.2 Table wrapper (use on Invoices, Customers, Quotes, Payments)

```html
<div class="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 rounded-2xl border border-slate-200 bg-white">
  <table class="w-full min-w-[600px] text-left border-collapse">
    <thead class="bg-slate-50 border-b border-slate-200">
      <tr>
        <th class="py-3 px-4 text-left text-sm font-semibold text-slate-700">...</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">...</tbody>
  </table>
</div>
```

### 9.3 Primary button (use for single main CTA per section)

```html
<button
  type="submit"
  class="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
>
  <Loader2 class="w-5 h-5 animate-spin hidden" aria-hidden />
  <span>Save & send quote</span>
</button>
```

### 9.4 Form field (label + input + optional error)

```html
<div>
  <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email address <span class="text-red-500">*</span></label>
  <input
    id="email"
    type="email"
    class="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    placeholder="e.g. name@example.com"
    aria-invalid="false"
    aria-describedby="email-error"
  />
  <p id="email-error" class="mt-1 text-sm text-red-600 hidden" role="alert">Please enter a valid email.</p>
</div>
```

---

## 10. Summary

- **Layout:** Add mobile/tablet admin nav, wrap tables for horizontal scroll, standardise page headers and back links.  
- **Visuals:** One primary CTA colour (indigo), clear typography scale, consistent button hierarchy and focus states.  
- **Navigation:** Explicit “Back to X”, optional breadcrumbs, clear labels for Dashboard vs Schedule.  
- **Forms:** No `alert()`; use inline/toast messages, group fields, placeholders, required markers, and save feedback.  
- **Calendar:** Overdue styling, today/now, optional recurring badge and unassigned cue.  
- **Feedback:** Success/error pattern everywhere; loading on all submit buttons; optional toast component.  
- **Onboarding:** Strong empty-state CTAs, optional tooltips and short help text.  

Applying the **High**-priority items will give the biggest gain in clarity, speed, and reduced confusion for small cleaning teams. Use the snippets as a starting point and adjust to your exact components (e.g. replace class strings with your Tailwind class names where they differ).

import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, HelpCircle, BookOpen } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { HelpAnchor } from '../config/helpAnchors';

const TOC: { id: string; label: string }[] = [
  { id: HelpAnchor.Overview, label: 'Overview' },
  { id: HelpAnchor.GettingStarted, label: 'Getting started' },
  { id: HelpAnchor.DashboardHome, label: 'Dashboard' },
  { id: HelpAnchor.Staff, label: 'Staff & roles' },
  { id: HelpAnchor.Schedule, label: 'Schedule' },
  { id: HelpAnchor.Jobs, label: 'Jobs' },
  { id: HelpAnchor.RecurringJobs, label: 'Recurring jobs' },
  { id: HelpAnchor.Bookings, label: 'Bookings' },
  { id: HelpAnchor.Services, label: 'Services' },
  { id: HelpAnchor.Customers, label: 'Customers' },
  { id: HelpAnchor.Invoices, label: 'Invoices & payments' },
  { id: HelpAnchor.Quotes, label: 'Quotes' },
  { id: HelpAnchor.Payroll, label: 'Payroll' },
  { id: HelpAnchor.Reports, label: 'Reports' },
  { id: HelpAnchor.Settings, label: 'Settings' },
  { id: HelpAnchor.Billing, label: 'Billing & trial' },
  { id: HelpAnchor.PublicBooking, label: 'Public booking page' },
  { id: HelpAnchor.Troubleshooting, label: 'Troubleshooting' },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border border-slate-800 rounded-3xl bg-slate-900/50 p-6 sm:p-8 mb-6">
      <h2 className="font-black text-lg sm:text-xl uppercase tracking-tight text-slate-50 mb-4 flex items-center gap-2">
        <span className="h-1 w-8 rounded-full bg-emerald-400 shrink-0" />
        {title}
      </h2>
      <div className="text-sm text-slate-300 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function AdminHelpPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, '');
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [location.hash, location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2 text-right min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0">
              <HelpCircle size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-base sm:text-lg uppercase tracking-tight text-slate-50 truncate">Help &amp; FAQ</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">CleanFlow admin</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 hidden lg:block">On this page</p>
          <nav aria-label="Help sections" className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-24">
            {TOC.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="whitespace-nowrap lg:whitespace-normal text-xs font-bold text-slate-400 hover:text-emerald-400 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 lg:border-transparent lg:bg-transparent lg:px-2 shrink-0"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <p className="text-slate-400 text-sm mb-6">
            Quick answers for everyday tasks. Use the menu on the left (or chips on mobile) to jump to a topic. From any admin
            screen, open <strong className="text-slate-200">More → Help</strong> or the <strong className="text-slate-200">Help</strong>{' '}
            button on the dashboard.
          </p>

          <Section id={HelpAnchor.Overview} title="Overview">
            <p>
              CleanFlow helps you run cleaning jobs end-to-end: schedule work, assign staff, track attendance and payroll, invoice
              customers, and offer online booking. Your <strong className="text-slate-100">admin</strong> account uses email login;
              <strong className="text-slate-100"> staff</strong> use phone + temporary password on the Staff Login page.
            </p>
          </Section>

          <Section id={HelpAnchor.GettingStarted} title="Getting started">
            <p>
              Open <Link className="text-emerald-400 font-semibold underline underline-offset-2" to="/admin/getting-started">Getting started</Link> for a
              guided checklist. Typical first steps: company name and payment details in Settings, add staff, set default pay in Payroll,
              then create jobs on the schedule.
            </p>
          </Section>

          <Section id={HelpAnchor.DashboardHome} title="Dashboard">
            <p>
              The home dashboard shows today&apos;s jobs, team status, invoice snapshots, and shortcuts. Use <strong className="text-slate-100">New Job</strong> for
              a quick create flow. Enable notifications to get alerts on supported browsers.
            </p>
          </Section>

          <Section id={HelpAnchor.Staff} title="Staff & roles">
            <p>
              Add staff from <strong className="text-slate-100">Team Hub</strong>. Each person gets a <strong className="text-slate-100">random temporary password</strong> — copy
              the phone number and password and share them securely. They sign in at Staff Login, then should change their password.
            </p>
            <p>
              <strong className="text-slate-100">Staff</strong> and <strong className="text-slate-100">Supervisor</strong> roles control what they see in the staff app. Plan limits may cap how many staff you can add.
            </p>
          </Section>

          <Section id={HelpAnchor.Schedule} title="Schedule">
            <p>
              The calendar shows jobs by day or week. Drag or open events to adjust times, assign cleaners, and open job details. Filters help
              you focus on specific staff or statuses.
            </p>
          </Section>

          <Section id={HelpAnchor.Jobs} title="Jobs">
            <p>
              Create jobs from <strong className="text-slate-100">New Job</strong> or from the schedule. Fill in client, address, time, service, and assigned staff.
              Completed jobs can feed invoicing and payroll depending on your workflow.
            </p>
          </Section>

          <Section id={HelpAnchor.RecurringJobs} title="Recurring jobs">
            <p>
              Use recurring templates to generate future visits automatically (e.g. weekly cleans). Check generated instances on the schedule
              and adjust one-off exceptions when needed.
            </p>
          </Section>

          <Section id={HelpAnchor.Bookings} title="Bookings">
            <p>
              Incoming requests from your public booking page appear here. Review, accept, or convert them into jobs as your process requires.
            </p>
          </Section>

          <Section id={HelpAnchor.Services} title="Services">
            <p>
              Maintain your service catalogue and pricing for quotes, jobs, and the customer booking experience. Hide services you don&apos;t offer.
            </p>
          </Section>

          <Section id={HelpAnchor.Customers} title="Customers">
            <p>
              Store customer contacts and history. Link customers to jobs and invoices for a clear record per account.
            </p>
          </Section>

          <Section id={HelpAnchor.Invoices} title="Invoices & payments">
            <p>
              Create and send invoices, mark payments received, and configure default bank / payment instructions in invoice settings.
              Invoice numbering and footers can be adjusted in company settings where available.
            </p>
          </Section>

          <Section id={HelpAnchor.Quotes} title="Quotes">
            <p>
              Build quotes for prospects, send or print them, and convert accepted quotes into jobs or invoices when you&apos;re ready.
            </p>
          </Section>

          <Section id={HelpAnchor.Payroll} title="Payroll">
            <p>
              Review clock-ins, hours, and pay calculations. Set <strong className="text-slate-100">default pay</strong> (hourly, percentage of job, or fixed) for the company
              and per-staff overrides. Export or use totals for your payroll run.
            </p>
          </Section>

          <Section id={HelpAnchor.Reports} title="Reports">
            <p>
              Analytics and summaries for revenue, workload, and performance vary by plan. Use reports for owner reviews and planning.
            </p>
          </Section>

          <Section id={HelpAnchor.Settings} title="Settings">
            <p>
              Company profile, branding, checklist templates, booking slug, and your admin password live here. Keep contact and invoice
              details accurate so customers see the right information.
            </p>
          </Section>

          <Section id={HelpAnchor.Billing} title="Billing & trial">
            <p>
              Your plan includes a <strong className="text-slate-100">limited-time trial</strong>. You can subscribe during the trial; billing is aligned with your trial end so
              you aren&apos;t charged twice for the same free period. If checkout or access looks wrong after paying, confirm webhooks and
              billing status with support.
            </p>
          </Section>

          <Section id={HelpAnchor.PublicBooking} title="Public booking page">
            <p className="flex items-start gap-2">
              <BookOpen className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              Customers book via your public link (booking slug). Share it on your website or socials. Control which services and slots they
              see from Services and Settings.
            </p>
          </Section>

          <Section id={HelpAnchor.Troubleshooting} title="Troubleshooting">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-slate-100">Dashboard stuck loading</strong> — check internet, then confirm the API/backend is up. Retry or sign out and back in.
              </li>
              <li>
                <strong className="text-slate-100">Staff can&apos;t log in</strong> — use the exact phone format and the temporary password from Team Hub; reset via your admin workflow if needed.
              </li>
              <li>
                <strong className="text-slate-100">Subscription / access</strong> — after payment, status should become active. If not, use Report or contact support with your company email.
              </li>
              <li>
                <strong className="text-slate-100">Bug or idea</strong> — use the <strong className="text-slate-100">Report</strong> button on the dashboard so we get your current page context.
              </li>
            </ul>
          </Section>
        </main>
      </div>

      <AdminBottomNav />
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Users, CalendarRange, CreditCard, Smartphone, FileText } from 'lucide-react';
import { HelpLink } from '../components/HelpLink';
import { HelpAnchor } from '../config/helpAnchors';

export function AdminGettingStarted() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Getting started
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">How to set up CleanFlow</h1>
            <p className="mt-2 text-sm text-slate-300/80">
              A quick guide for owners and managers. Follow these steps to get from zero to a working
              schedule, staff app, and invoices.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <HelpLink anchor={HelpAnchor.GettingStarted} label="Full FAQ" className="!text-[11px]" />
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-400/70 hover:text-emerald-200"
            >
              Back to dashboard
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <main className="space-y-8">
            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Step 1 – Add your team and set basic pay
              </h2>
              <p className="mt-2 text-sm text-emerald-50/80">
                Start by adding your cleaners and supervisors so they can log in, clock in/out, and see
                their jobs.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-emerald-50/80">
                <li>Go to the Team Hub / Staff page.</li>
                <li>Add each staff member with their name and mobile number.</li>
                <li>
                  Copy the temporary password and give it to them. They will change it the first time they
                  log in.
                </li>
                <li>
                  Optionally, set individual pay rates so your payroll reports reflect hourly, percentage,
                  or fixed pay.
                </li>
              </ol>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-300" />
                Step 2 – Add customers and jobs
              </h2>
              <p className="mt-2 text-sm text-slate-300/80">
                Next, add your regular customers and the jobs you do for them so your calendar reflects the
                real work.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300/80">
                <li>Add or import your customers with their address and contact details.</li>
                <li>Create jobs in the Schedule / Jobs section and assign them to staff.</li>
                <li>Use recurring jobs for weekly, fortnightly, or monthly cleans.</li>
                <li>Check that today and this week look correct on the dashboard calendar.</li>
              </ol>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-300" />
                Step 3 – Get your staff using the app
              </h2>
              <p className="mt-2 text-sm text-slate-300/80">
                Once staff have their login details, ask them to start clocking in and out through the
                staff panel.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300/80">
                <li>Send staff the staff login link and their phone-based login details.</li>
                <li>Ask them to clock in when they arrive on site and clock out when they finish.</li>
                <li>Remind them to upload before/after photos when needed for proof of work.</li>
                <li>Use the Attendance and Timesheet pages to spot missing or late clock-ins.</li>
              </ol>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-300" />
                Step 4 – Invoices, payments, and customer access
              </h2>
              <p className="mt-2 text-sm text-slate-300/80">
                Use the invoicing tools to keep on top of who has paid and who still owes you money.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300/80">
                <li>Create invoices from completed jobs in the Invoices section.</li>
                <li>Mark invoices as paid when you receive cash or bank transfers.</li>
                <li>Give key customers access to their customer login so they can see and download invoices.</li>
                <li>Use reports to check revenue and outstanding balances each week.</li>
              </ol>
            </section>
          </main>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Quick links
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-emerald-200">
                <li>
                  <button
                    onClick={() => navigate('/admin/staff')}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 border border-slate-700"
                  >
                    <Users className="h-4 w-4 text-emerald-300" />
                    Open Team Hub / Staff
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/admin/schedule')}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 border border-slate-700"
                  >
                    <CalendarRange className="h-4 w-4 text-sky-300" />
                    Open Schedule
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/admin/invoices')}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 border border-slate-700"
                  >
                    <FileText className="h-4 w-4 text-amber-300" />
                    Open Invoices
                  </button>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300/80">
              <p className="font-semibold text-slate-100">Tip for first week</p>
              <p className="mt-2">
                In your first few days, keep your old system running alongside CleanFlow. Once you are
                happy that jobs, staff, and invoices all match, you can move fully across.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}


import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';

export function StaffHelpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      <div className="bg-slate-950/90 border-b border-slate-800 sticky top-0 z-10 flex items-center gap-3 px-4 py-3">
        <Link
          to="/staff"
          className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to staff home"
        >
          <ChevronLeft size={22} />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <HelpCircle className="text-emerald-400 shrink-0" size={22} />
          <div className="min-w-0">
            <h1 className="font-black text-lg text-slate-50 tracking-tight uppercase truncate">Staff Help</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">CleanFlow</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6 text-sm text-slate-300 leading-relaxed">
        <p className="text-slate-400 text-xs">
          Quick answers for cleaners and supervisors using the staff app. Your office uses a separate admin login.
        </p>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Signing in</h2>
          <p>
            Use <strong className="text-slate-100">Staff Login</strong> with your <strong className="text-slate-100">mobile number</strong> and the{' '}
            <strong className="text-slate-100">temporary password</strong> your manager gave you. Change your password under your profile on the staff
            home page when you can.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">My Jobs</h2>
          <p>
            Open <Link className="text-emerald-400 font-semibold underline underline-offset-2" to="/staff/jobs">My Jobs</Link> to{' '}
            <strong className="text-slate-100">accept or decline</strong> work your manager assigned. Accepted jobs appear on your home screen and in
            the schedule.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Today&apos;s jobs &amp; clock in</h2>
          <p>
            On the home screen, use <strong className="text-slate-100">clock in / clock out</strong> when you arrive and leave a job, so your hours are
            recorded for payroll. Follow any instructions your company gives for photos or checklists.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Timesheet</h2>
          <p>
            <Link className="text-emerald-400 font-semibold underline underline-offset-2" to="/staff/timesheet">Timesheet</Link> shows your past
            attendance and hours for the dates you select.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Location &amp; job status</h2>
          <p>
            Some actions ask for <strong className="text-slate-100">GPS</strong>. Allow location in your browser or phone settings so check-in and
            completion can work.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">Need more help?</h2>
          <p>
            Contact your <strong className="text-slate-100">manager or company admin</strong>. They can reset access, check assignments, and answer
            policy questions.
          </p>
        </section>

        <Link
          to="/staff"
          className="block text-center py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest hover:bg-emerald-400"
        >
          Back to staff home
        </Link>
      </div>
    </div>
  );
}

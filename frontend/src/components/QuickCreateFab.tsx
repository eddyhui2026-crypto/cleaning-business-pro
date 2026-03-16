import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, UserPlus, CalendarPlus } from 'lucide-react';

export function QuickCreateFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-5 bottom-24 lg:right-8 lg:bottom-8 z-40">
      {open && (
        <div className="mb-3 space-y-2 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl px-3 py-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/admin/jobs/new');
            }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold text-slate-50 hover:bg-slate-800"
          >
            <CalendarPlus size={16} /> New job
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/admin/customers');
            }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold text-slate-50 hover:bg-slate-800"
          >
            <UserPlus size={16} /> New customer
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/admin/invoices?new=1');
            }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold text-slate-50 hover:bg-slate-800"
          >
            <FileText size={16} /> New invoice
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-emerald-500 text-white shadow-[0_18px_45px_rgba(16,185,129,0.6)] flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-transform"
        aria-label="Quick create"
      >
        <Plus size={26} strokeWidth={3} />
      </button>
    </div>
  );
}


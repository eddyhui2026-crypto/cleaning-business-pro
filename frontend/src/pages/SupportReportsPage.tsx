import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Loader2, AlertCircle, ArrowLeft, FileText } from 'lucide-react';

type SupportReport = {
  id: string;
  created_at: string;
  company_id: string;
  company_name: string;
  category: string;
  subject: string | null;
  message: string;
  reporter_email: string | null;
  context_url: string | null;
};

export function SupportReportsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<SupportReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<'all' | 'bug' | 'feature' | 'other'>('all');

  const filteredReports = useMemo(() => {
    if (filterCategory === 'all') return reports;
    return reports.filter((r) => r.category === filterCategory);
  }, [reports, filterCategory]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Not signed in');

        const res = await fetch(apiUrl('/api/support/reports?limit=50'), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 403) {
          setError('Not authorized.');
          setReports([]);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any));
          throw new Error(err?.message || err?.error || 'Failed to load reports');
        }

        const data = await res.json();
        setReports(Array.isArray(data?.reports) ? data.reports : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-10">
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Support Reports</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
              Viewer-only bug/feature reports
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'bug', 'feature', 'other'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                filterCategory === c
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-200">
            <div className="flex items-center gap-2 text-rose-300 font-bold mb-2">
              <AlertCircle size={18} /> {error}
            </div>
            <p className="text-sm text-slate-400">
              Only the support viewer can see this page.
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 rounded-[3rem] bg-slate-900/80 border border-slate-800 text-slate-400 flex flex-col items-center text-center">
            <FileText size={48} className="opacity-40 mb-3" />
            <p className="font-black uppercase tracking-widest text-xs">No reports found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((r) => (
              <div
                key={r.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-slate-200 text-[10px] font-bold uppercase">
                        {r.category}
                      </span>
                      <span className="text-xs font-bold text-emerald-300">
                        {r.company_name}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-50 mt-2">
                      {r.subject || '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(r.created_at).toLocaleString()} {r.reporter_email ? `· ${r.reporter_email}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">
                  {r.message}
                </div>
                {r.context_url && (
                  <div className="mt-2 text-xs text-slate-400 break-all">
                    Context: {r.context_url}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { ChevronLeft, Loader2, MapPin, Calendar, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface MyJobRow {
  assignment_id: string;
  job_id: string;
  job_name: string;
  job_address: string | null;
  job_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  job_status: string;
}

export function StaffJobsList() {
  const [jobs, setJobs] = useState<MyJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch(apiUrl('/api/staff/my-jobs'), { headers });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const handleResponse = async (assignmentId: string, response: 'accepted' | 'declined') => {
    setResponding(assignmentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/staff/job-response'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ assignment_id: assignmentId, response }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Request failed');
        return;
      }
      setJobs(prev => prev.map(j => j.assignment_id === assignmentId ? { ...j, status: response } : j));
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-10">
      <div className="bg-slate-950/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10 flex items-center gap-2 px-4 py-3">
        <Link to="/staff" className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0">
          <ChevronLeft size={22} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-lg text-slate-50 tracking-tight uppercase">My Jobs</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Accept or decline assigned tasks</p>
        </div>
        <Link
          to="/staff/help"
          className="shrink-0 p-2 rounded-xl text-emerald-300 border border-emerald-500/40 bg-slate-900 hover:bg-slate-800"
          title="Help"
          aria-label="Staff help"
        >
          <HelpCircle size={20} />
        </Link>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-emerald-400" size={32} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No jobs assigned yet.</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((j) => (
              <div
                key={j.assignment_id}
                className="bg-slate-900/80 rounded-2xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800"
              >
                <h3 className="font-bold text-slate-50 text-lg mb-1">{j.job_name}</h3>
                {j.job_address && (
                  <p className="text-slate-300 text-sm flex items-center gap-1.5 mb-2">
                    <MapPin size={14} className="text-emerald-300 shrink-0" />
                    {j.job_address}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4">
                  {j.job_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-500" />
                      {j.job_date}
                    </span>
                  )}
                  {j.start_time && <span>{j.start_time}</span>}
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      (j.status === 'accepted' || j.status === 'assigned')
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                        : j.status === 'declined'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-400/40'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {j.status === 'assigned' ? 'accepted' : j.status}
                  </span>
                </div>
                {j.status === 'assigned' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResponse(j.assignment_id, 'declined')}
                      disabled={responding !== null}
                      className="flex-1 py-2.5 bg-rose-500/10 text-rose-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-500/20 disabled:opacity-50 border border-rose-400/30"
                    >
                      {responding === j.assignment_id ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                      Decline
                    </button>
                  </div>
                )}
                {(j.status === 'accepted' || j.status === 'assigned') && (
                  <Link
                    to={`/staff/job/${j.job_id}`}
                    className="block w-full mt-3 py-2.5 bg-emerald-500 text-slate-950 text-center rounded-xl font-bold text-sm hover:bg-emerald-400"
                  >
                    View job
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

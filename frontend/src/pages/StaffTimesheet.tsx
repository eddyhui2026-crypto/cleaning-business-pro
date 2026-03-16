import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { ChevronLeft, Loader2, Calendar } from 'lucide-react';

interface TimesheetRow {
  id: string;
  job_id: string;
  job_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  status: string;
}

export function StaffTimesheet() {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchTimesheet = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(
        apiUrl(`/api/staff/attendance/me?date_from=${dateFrom}&date_to=${dateTo}`),
        { headers }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div className="min-h-screen bg-slate-950 pb-10">
      <div className="bg-slate-950/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10 flex items-center gap-4 px-4 py-3">
        <Link to="/staff" className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="font-black text-lg text-slate-50 tracking-tight uppercase">Timesheet</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Your hours & attendance history</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-slate-900/80 rounded-2xl p-4 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800 mb-4">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-sm mb-3">
            <Calendar size={18} className="text-emerald-300" />
            Filter by date
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-950 text-slate-50"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-950 text-slate-50"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No attendance records in this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Job</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock in</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock out</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hours</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800">
                      <td className="py-3 px-4 font-medium text-slate-100">{formatDate(r.clock_in_time)}</td>
                      <td className="py-3 px-4 text-slate-200">{r.job_name}</td>
                      <td className="py-3 px-4 text-slate-300">{formatTime(r.clock_in_time)}</td>
                      <td className="py-3 px-4 text-slate-300">{formatTime(r.clock_out_time)}</td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        {r.total_hours != null ? `${r.total_hours.toFixed(2)} h` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === 'clocked_out'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-400/40'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

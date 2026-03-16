import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Clock, MapPin, Loader2, LogIn, LogOut } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  job_id: string;
  job_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  status: string;
}

interface StaffAttendancePanelProps {
  staffId: string;
  jobs: Array<{ id: string; client_name: string }>;
  onClockChange?: () => void;
}

export function StaffAttendancePanel({ staffId, jobs, onClockChange }: StaffAttendancePanelProps) {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'clock-in' | 'clock-out' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const dateFrom = todayStart.toISOString().slice(0, 10);
  const dateTo = todayEnd.toISOString().slice(0, 10);

  const fetchAttendances = useCallback(async () => {
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
      setAttendances(Array.isArray(data) ? data : []);
    } catch (e) {
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  const currentClockedIn = attendances.find((a) => a.status === 'clocked_in');
  const todayTotalHours = attendances
    .filter((a) => a.status === 'clocked_out' && a.total_hours != null)
    .reduce((sum, a) => sum + (a.total_hours ?? 0), 0);

  const getPosition = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const handleClockIn = async (jobId: string) => {
    setError(null);
    setActionLoading('clock-in');
    try {
      const { latitude, longitude } = await getPosition();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/staff/clock-in'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ job_id: jobId, latitude, longitude }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || 'Clock in failed');
        return;
      }
      await fetchAttendances();
      onClockChange?.();
    } catch (e: any) {
      setError(e?.message || 'Please enable GPS to clock in');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClockOut = async (attendanceId: string) => {
    setError(null);
    setActionLoading('clock-out');
    try {
      const { latitude, longitude } = await getPosition();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/staff/clock-out'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ attendance_id: attendanceId, latitude, longitude }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || 'Clock out failed');
        return;
      }
      await fetchAttendances();
      onClockChange?.();
    } catch (e: any) {
      setError(e?.message || 'Please enable GPS to clock out');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="animate-spin text-emerald-400" size={20} />
        <span className="text-sm font-bold">Loading attendance...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4 text-emerald-300">
        <Clock size={18} className="text-emerald-400" />
        Time & Attendance
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-400/40 rounded-xl text-rose-200 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <span className="font-bold text-slate-100">
            {currentClockedIn ? `Clocked in at ${currentClockedIn.job_name}` : 'Not clocked in'}
          </span>
        </div>
        {currentClockedIn && (
          <div className="flex justify-between">
            <span className="text-slate-400">Clock in time</span>
            <span className="font-bold text-slate-100">
              {new Date(currentClockedIn.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Total hours today</span>
          <span className="font-bold text-slate-100">{todayTotalHours.toFixed(2)} h</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800">
        {currentClockedIn ? (
          <button
            type="button"
            disabled={actionLoading !== null}
            onClick={() => handleClockOut(currentClockedIn.id)}
            className="w-full py-3 bg-emerald-500 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 disabled:opacity-50"
          >
            {actionLoading === 'clock-out' ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <LogOut size={18} />
            )}
            Clock out
          </button>
        ) : (
          <>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Today&apos;s job — Clock in (GPS required)</p>
            {jobs.length === 0 ? (
              <p className="text-slate-500 text-xs">No jobs assigned today.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => handleClockIn(job.id)}
                    className="w-full py-3 bg-emerald-500 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {actionLoading === 'clock-in' ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <LogIn size={18} />
                    )}
                    Clock in — {job.client_name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

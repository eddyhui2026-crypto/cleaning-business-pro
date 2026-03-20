import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Play, Square, Loader2, Camera, ChevronLeft, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

export const StaffJobView = () => {
  const { jobId } = useParams(); // 👈 從網址取得 ID
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const response = await fetch(apiUrl(`/api/jobs/${jobId}`), { headers });
      const data = await response.json();
      setJob(data);
    } catch (err) {
      console.error("Failed to load job", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistToggle = async (taskId: string) => {
    const checklist = job?.details?.checklist;
    if (!checklist?.tasks?.length) return;
    const tasks = (checklist.tasks as any[]).map((t: any) =>
      t.id === taskId ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : undefined } : t
    );
    const newDetails = { ...(job.details || {}), checklist: { ...checklist, tasks } };
    setJob((prev: any) => (prev ? { ...prev, details: newDetails } : prev));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ details: newDetails }),
      });
      if (!res.ok) {
        setJob((prev: any) => (prev ? { ...prev, details: job.details } : prev));
      }
    } catch {
      setJob((prev: any) => (prev ? { ...prev, details: job.details } : prev));
    }
  };

  const handleStatusChange = async (newStatus: 'in-progress' | 'completed') => {
    setActionLoading(true);
    
    // 1. 處理地理位置 (增加 Timeout 同 Error Handling)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const endpoint = newStatus === 'in-progress' ? 'check-in' : 'complete';
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          const response = await fetch(apiUrl(`/api/jobs/${endpoint}/${jobId}`), {
            method: 'POST',
            headers,
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });

          if (response.ok) {
            const updated = await response.json();
            // 注意：後端 API 回傳格式要統一，這裡假設回傳的是單一 Job 物件
            setJob(updated.data?.[0] || updated); 
          }
        } catch (err) {
          alert("Network error, please try again.");
        } finally {
          setActionLoading(false);
        }
      },
      (error) => {
        setActionLoading(false);
        alert("Please enable GPS/Location access to update job status.");
        console.error(error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!job) return <div className="p-10 text-center">Job not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Bar */}
      <div className="bg-white p-4 flex items-center gap-2 border-b sticky top-0 z-10">
        <button onClick={() => navigate('/staff')} className="p-2 hover:bg-slate-100 rounded-full shrink-0">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-lg text-slate-800 flex-1 min-w-0 truncate">Mission Details</h1>
        <Link
          to="/staff/help"
          className="shrink-0 p-2 rounded-full text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
          title="Help"
          aria-label="Staff help"
        >
          <HelpCircle size={22} />
        </Link>
      </div>

      <div className="p-5 max-w-md mx-auto space-y-6">
        {/* Info Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase mb-4 ${
            job.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
            job.status === 'in-progress' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${job.status === 'in-progress' ? 'animate-pulse bg-amber-500' : 'bg-current'}`} />
            {job.status}
          </div>
          
          <h2 className="text-2xl font-black text-slate-800 mb-2">{job.client_name}</h2>
          <div className="flex items-start gap-2 text-slate-500 font-medium">
            <MapPin size={18} className="text-indigo-500 shrink-0 mt-0.5" />
            <span className="text-sm leading-relaxed">{job.address}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => handleStatusChange('in-progress')}
            disabled={job.status !== 'pending' || actionLoading}
            className="flex flex-col items-center justify-center gap-2 bg-indigo-600 disabled:opacity-30 disabled:grayscale text-white py-6 rounded-3xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all"
          >
            {actionLoading && job.status === 'pending' ? <Loader2 className="animate-spin" /> : <Play size={24} fill="currentColor" />}
            <span>START</span>
          </button>
          
          <button 
            onClick={() => handleStatusChange('completed')}
            disabled={job.status !== 'in-progress' || actionLoading}
            className="flex flex-col items-center justify-center gap-2 bg-slate-900 disabled:opacity-30 text-white py-6 rounded-3xl font-black shadow-xl shadow-slate-200 active:scale-95 transition-all"
          >
            {actionLoading && job.status === 'in-progress' ? <Loader2 className="animate-spin" /> : <Square size={24} fill="currentColor" />}
            <span>FINISH</span>
          </button>
        </div>

        {/* 📸 提醒影相區：只有 In Progress 時才顯示強烈提醒 */}
        {job.status === 'in-progress' && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-[2rem] flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
              <Camera size={24} />
            </div>
            <div>
              <p className="font-bold text-amber-800 text-sm">Don't forget photos!</p>
              <p className="text-amber-600 text-xs">Take "Before" and "After" shots.</p>
            </div>
          </div>
        )}

        {/* Checklist: tap to tick; progress saved and shown on Service Report. */}
        {job.details?.checklist?.tasks?.length > 0 && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight mb-2">Checklist</h3>
            <p className="text-slate-500 text-xs mb-4">
              {job.details.checklist.template_name} · {job.details.checklist.tasks.filter((t: any) => t.completed).length}/{job.details.checklist.tasks.length} done
            </p>
            <ul className="space-y-0">
              {(job.details.checklist.tasks as any[]).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).map((t: any) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => job.status !== 'completed' && handleChecklistToggle(t.id)}
                    disabled={job.status === 'completed'}
                    className="w-full flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 text-left active:bg-slate-50 rounded-xl transition-colors disabled:opacity-70 disabled:active:bg-transparent"
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${t.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {t.completed ? '✓' : '—'}
                    </span>
                    <span className={t.completed ? 'text-slate-600 line-through' : 'text-slate-800 font-medium'}>{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-slate-400 text-[10px] mt-3">Tap to tick. Shown on the Service Report for the customer.</p>
          </div>
        )}
      </div>
    </div>
  );
};
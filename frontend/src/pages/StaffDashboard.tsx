import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { compressImageForUpload } from '../lib/imageCompress';
import { DATA_RETENTION_SHORT } from '../lib/dataRetention';
import {
  CheckCircle2,
  MapPin,
  LogOut,
  Loader2,
  Navigation,
  Camera,
  Image as ImageIcon,
  XCircle,
  KeyRound,
} from 'lucide-react';
import { StaffAttendancePanel } from '../components/StaffAttendancePanel';
import { enablePushStaff } from '../lib/pushNotifications';

export const StaffDashboard = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ id: string; type: 'before' | 'after' } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ phone?: string; full_name?: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('cf_push_staff_enabled') === '1' ? 'Enabled' : null;
  });
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchJobs(session.user.id);
        const { data: p } = await supabase.from('profiles').select('phone, full_name').eq('id', session.user.id).maybeSingle();
        if (p) setProfile(p);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchJobs = async (userId: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/jobs/staff/${userId}`), { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMessage({ type: 'error', text: error.message });
      return;
    }
    setPasswordMessage({ type: 'success', text: 'Password updated. Use your new password next time you sign in.' });
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeletePhoto = async (jobId: string, type: 'before' | 'after', photoUrl: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;

    try {
      const currentJob = jobs.find(j => j.id === jobId);
      const existingPhotos = type === 'before' ? currentJob?.before_photos : currentJob?.after_photos;
      
      // 過濾掉要刪除的那張 URL
      const updatedPhotos = (existingPhotos || []).filter((url: string) => url !== photoUrl);

      const updatePayload: any = {};
      if (type === 'before') {
        updatePayload.before_photos = updatedPhotos;
      } else {
        updatePayload.after_photos = updatedPhotos;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        fetchJobs(user.id);
      } else {
        throw new Error("Delete failed on server");
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePhotoUpload = async (jobId: string, type: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading({ id: jobId, type });

    try {
      const currentJob = jobs.find(j => j.id === jobId);
      const blob = await compressImageForUpload(file);
      const fileName = `${jobId}/${type}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);

      const updatePayload: any = {};
      
      if (type === 'before') {
        const existingPhotos = currentJob?.before_photos || [];
        updatePayload.before_photos = [...existingPhotos, publicUrl];
        if (currentJob.status === 'pending') {
          updatePayload.status = 'in_progress';
        }
      } else {
        const existingPhotos = currentJob?.after_photos || [];
        updatePayload.after_photos = [...existingPhotos, publicUrl];
        updatePayload.status = 'completed';
        updatePayload.completed_at = new Date().toISOString();
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        fetchJobs(user.id);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Update failed");
      }
    } catch (err: any) {
      console.error('Upload process error:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleNavigate = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayJobs = jobs.filter((j) => {
    const d = new Date(j.scheduled_at);
    return d >= today && d < todayEnd;
  });

  const greeting = (() => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = (profile?.full_name || user?.email || '').split(' ')[0];
  const staffDisplayName = firstName || 'there';

  const todayAssignedJobs = todayJobs.length;
  const todayIncompleteJobs = todayJobs.filter((j) => j.status !== 'completed').length;

  const handleEnableNotifications = async () => {
    setPushLoading(true);
    setPushStatus(null);
    const result = await enablePushStaff(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return { Authorization: session?.access_token ? `Bearer ${session.access_token}` : '' };
    });
    const status = result.ok ? 'Enabled' : result.error || 'Failed';
    setPushStatus(status);
    if (typeof window !== 'undefined') {
      if (status === 'Enabled') window.localStorage.setItem('cf_push_staff_enabled', '1');
      else window.localStorage.removeItem('cf_push_staff_enabled');
    }
    setPushLoading(false);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="animate-spin text-emerald-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-10">
      {/* HEADER */}
      <div className="bg-slate-950/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10 flex justify-between items-center px-5 py-4">
        <div>
          <h1 className="font-black text-xl italic text-slate-50">STAFF PANEL</h1>
          <p className="text-sm text-slate-200 font-semibold">
            {greeting}, {staffDisplayName}.
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {profile?.phone || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/staff/jobs"
            className="p-2 bg-slate-900 text-slate-200 rounded-xl hover:bg-slate-800 border border-slate-700 text-xs font-bold uppercase tracking-widest"
          >
            My Jobs
          </Link>
          <Link
            to="/staff/timesheet"
            className="p-2 bg-slate-900 text-slate-200 rounded-xl hover:bg-slate-800 border border-slate-700 text-xs font-bold uppercase tracking-widest"
          >
            Timesheet
          </Link>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={pushLoading}
            className={`relative p-2 rounded-xl text-xs font-medium min-w-[40px] min-h-[40px] flex items-center justify-center border ${
              pushStatus === 'Enabled'
                ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/70'
                : 'text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/40'
            }`}
            title={pushStatus === 'Enabled' ? 'Notifications on' : 'Enable notifications'}
          >
            {pushLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span className="text-[10px] font-black tracking-widest uppercase">
                  {pushStatus === 'Enabled' ? 'On' : 'Notify'}
                </span>
              </>
            )}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-2 bg-slate-900 text-slate-400 rounded-xl hover:text-red-400 border border-slate-700 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {todayAssignedJobs > 0 && todayIncompleteJobs > 0 && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-amber-200" />
            <p className="text-xs text-amber-100 font-medium">
              You have <span className="font-bold">{todayIncompleteJobs}</span> job{todayIncompleteJobs !== 1 ? 's' : ''} scheduled today.
              Please accept your jobs in <span className="font-bold">My Jobs</span> and remember to clock in when you arrive.
            </p>
          </div>
        )}

        {/* Today's Jobs — time list */}
        <div className="bg-slate-900/80 rounded-[2rem] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800">
          <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Today&apos;s Jobs</h2>
          {todayJobs.length === 0 ? (
            <p className="text-slate-500 text-sm">No jobs scheduled for today.</p>
          ) : (
            <ul className="space-y-2">
              {[...todayJobs]
                .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                .map((j) => (
                  <li key={j.id} className="flex items-center gap-3 text-slate-100">
                    <span className="font-mono font-bold text-emerald-300 text-sm w-14">
                      {new Date(j.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-bold truncate">{j.client_name}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        {user && (
          <StaffAttendancePanel
            staffId={user.id}
            jobs={todayJobs.length > 0 ? todayJobs : jobs}
            onClockChange={() => {}}
          />
        )}
        {/* Change password */}
        <div className="bg-slate-900/80 rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800">
          <button
            type="button"
            onClick={() => { setShowChangePassword((v) => !v); setPasswordMessage(null); }}
            className="flex items-center gap-2 text-slate-100 font-bold text-sm"
          >
            <KeyRound size={18} className="text-emerald-300" />
            Change password
          </button>
          {showChangePassword && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  placeholder="At least 6 characters"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  placeholder="Repeat password"
                  minLength={6}
                />
              </div>
              {passwordMessage && (
                <p className={`text-xs ${passwordMessage.type === 'success' ? 'text-emerald-300' : 'text-red-400'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2 bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
              >
                {changingPassword ? <Loader2 className="animate-spin" size={16} /> : 'Update password'}
              </button>
            </form>
          )}
        </div>
        {jobs.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/80 rounded-[3rem] border-2 border-dashed border-slate-700">
            <p className="text-slate-500 font-black uppercase tracking-tighter text-xl">
              No missions
              <br />
              assigned today
            </p>
          </div>
        ) : jobs.map(job => (
          <div
            key={job.id}
            className={`bg-slate-900/80 rounded-[2.5rem] p-6 shadow-xl shadow-slate-950/80 border transition-all ${
              job.status === 'completed'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-slate-800 hover:border-emerald-400/60'
            }`}
          >
            <div className="mb-4">
              <h3 className="font-black text-2xl text-slate-50 leading-tight">{job.client_name}</h3>
              <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                Photo guidelines: Only photograph the cleaning area. Do not include people, faces, or personal documents (e.g. IDs, bank details, private papers).
              </p>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 ${
                job.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-200 border border-slate-600'
              }`}>
                {job.status === 'completed' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {job.status}
              </div>
            </div>

            {/* BEFORE SECTION */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <ImageIcon size={12}/> Before Work
                </span>
                <label className="bg-slate-950 text-slate-50 p-2 px-4 rounded-full text-[10px] font-black cursor-pointer active:scale-90 transition-all flex items-center gap-2 shadow-lg shadow-slate-950/80 border border-slate-700">
                  {uploading?.id === job.id && uploading?.type === 'before' ? <Loader2 size={12} className="animate-spin"/> : <Camera size={12}/>}
                  CAPTURE
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(job.id, 'before', e)} disabled={uploading !== null} />
                </label>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {job.before_photos?.map((url: string, i: number) => (
                  <div key={i} className="relative shrink-0">
                    <img src={url} className="w-24 h-24 object-cover rounded-2xl border-2 border-slate-950 shadow-sm" alt="before" />
                    <button 
                      onClick={() => handleDeletePhoto(job.id, 'before', url)}
                      className="absolute -top-1 -right-1 bg-slate-950 text-rose-400 rounded-full shadow-md active:scale-75 transition-transform"
                    >
                      <XCircle size={18} fill="currentColor" />
                    </button>
                  </div>
                ))}
                {(!job.before_photos || job.before_photos.length === 0) && (
                  <div className="w-full py-8 bg-slate-900 rounded-[1.5rem] border border-dashed border-slate-700 text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                    Upload photos<br/>before starting
                  </div>
                )}
              </div>
            </div>

            {/* AFTER SECTION */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em] flex items-center gap-1">
                  <CheckCircle2 size={12}/> After Work
                </span>
                <label className="bg-emerald-400 text-slate-950 p-2 px-4 rounded-full text-[10px] font-black cursor-pointer active:scale-90 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/40">
                  {uploading?.id === job.id && uploading?.type === 'after' ? <Loader2 size={12} className="animate-spin"/> : <Camera size={12}/>}
                  FINISH
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(job.id, 'after', e)} disabled={uploading !== null} />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {job.after_photos?.map((url: string, i: number) => (
                  <div key={i} className="relative w-full aspect-square">
                    <img src={url} className="w-full h-full object-cover rounded-2xl border-2 border-slate-900 shadow-sm" alt="after" />
                    <button 
                      onClick={() => handleDeletePhoto(job.id, 'after', url)}
                      className="absolute -top-1 -right-1 bg-slate-950 text-rose-400 rounded-full shadow-md active:scale-75 transition-transform"
                    >
                      <XCircle size={18} fill="currentColor" />
                    </button>
                  </div>
                ))}
                {(!job.after_photos || job.after_photos.length === 0) && (
                  <div className="col-span-3 py-10 bg-emerald-500/10 rounded-[1.5rem] border border-dashed border-emerald-500/40 text-[10px] text-center text-emerald-300 font-bold uppercase tracking-widest leading-relaxed">
                    Awaiting final<br/>work proof
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-500 mt-2 italic">{DATA_RETENTION_SHORT}</p>
            </div>

            {/* NAVIGATION BUTTON */}
            <button 
              onClick={() => handleNavigate(job.address)} 
              className="w-full mt-2 bg-slate-950 p-4 rounded-[1.5rem] flex items-center justify-between group active:bg-slate-900 transition-all border border-slate-800"
            >
              <div className="flex items-center gap-3 text-sm text-slate-100 font-bold truncate">
                <MapPin size={18} className="text-rose-400 shrink-0"/> 
                <span className="truncate">{job.address || 'No address provided'}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-xl shadow-sm group-active:scale-90 transition-transform border border-slate-700">
                <Navigation size={18} className="text-emerald-300" />
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
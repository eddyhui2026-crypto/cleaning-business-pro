import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { UpgradePrompt } from '../components/UpgradePrompt';
import {
  UserPlus,
  Trash2,
  Phone,
  User,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Copy,
  Check,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminStaffManagementProps {
  companyId: string | null;
}

export const AdminStaffManagement = ({ companyId }: AdminStaffManagementProps) => {
  const navigate = useNavigate();
  const planContext = usePlan();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [lastCreated, setLastCreated] = useState<{
    loginPhone: string;
    loginEmail: string;
    temporaryPassword: string;
    full_name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [payModalStaff, setPayModalStaff] = useState<{ id: string; full_name: string; pay_type?: string | null; pay_hourly_rate?: number | null; pay_percentage?: number | null; pay_fixed_amount?: number | null } | null>(null);
  const [payTypeDraft, setPayTypeDraft] = useState<'' | 'hourly' | 'percentage' | 'fixed'>('hourly');
  const [payHourlyDraft, setPayHourlyDraft] = useState('');
  const [payPercentageDraft, setPayPercentageDraft] = useState('');
  const [payFixedDraft, setPayFixedDraft] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: 'staff',
  });

  const fetchStaff = useCallback(async () => {
    if (!companyId) return;
    try {
      setFetching(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/staff'), { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch staff error:', err);
      setStaffList([]);
    } finally {
      setFetching(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name?.trim() || !formData.phone?.trim()) {
      alert('Please enter Full Name and Phone Number');
      return;
    }
    if (!companyId) {
      alert('Your account is not linked to a company. Please refresh.');
      return;
    }
    setLoading(true);
    setLastCreated(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        alert('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };
      const res = await fetch(apiUrl('/api/staff'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          alert(data.message || data.error || 'Session expired. Please sign in again.');
          navigate('/login');
          return;
        }
        if (data.code === 'PHONE_DUPLICATE' || res.status === 409) {
          alert('This phone number is already used by another staff member in your company.');
        } else if (res.status === 403 && data.limit === 'staff') {
          alert(data.message || 'Staff limit reached. Upgrade your plan to add more.');
        } else {
          const parts = [data.message, data.error].filter(Boolean);
          if (data.details != null) parts.push(typeof data.details === 'string' ? data.details : JSON.stringify(data.details));
          const msg = parts.join(' — ') || 'Failed to add staff';
          alert(res.status === 500 ? `Server error: ${msg}` : msg);
        }
        return;
      }

      setLastCreated({
        loginPhone: data.loginPhone || data.phone || '',
        loginEmail: data.loginEmail || data.email || '',
        temporaryPassword: data.temporaryPassword || '',
        full_name: data.full_name || formData.full_name,
      });
      setFormData((prev) => ({ full_name: '', phone: '', role: prev.role }));
      fetchStaff();
      planContext?.refetch();
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!lastCreated) return;
    const text = `Phone: ${lastCreated.loginPhone}\nTemporary password: ${lastCreated.temporaryPassword}\nStaff log in at /staff-login and should change their password after first login.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openPayModal = (staff: any) => {
    const pt = staff.pay_type && ['hourly', 'percentage', 'fixed'].includes(staff.pay_type) ? staff.pay_type : '';
    setPayTypeDraft(pt || '');
    setPayHourlyDraft(staff.pay_hourly_rate != null ? String(staff.pay_hourly_rate) : '');
    setPayPercentageDraft(staff.pay_percentage != null ? String(staff.pay_percentage) : '');
    setPayFixedDraft(staff.pay_fixed_amount != null ? String(staff.pay_fixed_amount) : '');
    setPayModalStaff({
      id: staff.id,
      full_name: staff.full_name || staff.name,
      pay_type: staff.pay_type,
      pay_hourly_rate: staff.pay_hourly_rate,
      pay_percentage: staff.pay_percentage,
      pay_fixed_amount: staff.pay_fixed_amount,
    });
  };

  const saveStaffPay = async () => {
    if (!payModalStaff) return;
    setSavingPay(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const body: any = {
        pay_type: payTypeDraft || null,
        pay_hourly_rate: payHourlyDraft === '' ? null : Number(payHourlyDraft),
        pay_percentage: payPercentageDraft === '' ? null : Number(payPercentageDraft),
        pay_fixed_amount: payFixedDraft === '' ? null : Number(payFixedDraft),
      };
      const res = await fetch(apiUrl(`/api/staff/${payModalStaff.id}`), { method: 'PATCH', headers, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        setStaffList((prev) => prev.map((s) => (s.id === payModalStaff.id ? { ...s, ...data } : s)));
        setPayModalStaff(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert((err as any).error || 'Failed to save');
      }
    } finally {
      setSavingPay(false);
    }
  };

  const payLabel = (s: any) => {
    if (s.pay_type === 'hourly' && s.pay_hourly_rate != null) return `Hourly £${Number(s.pay_hourly_rate).toFixed(2)}`;
    if (s.pay_type === 'percentage' && s.pay_percentage != null) return `${s.pay_percentage}% of job`;
    if (s.pay_type === 'fixed' && s.pay_fixed_amount != null) return `Fixed £${Number(s.pay_fixed_amount).toFixed(2)}`;
    return 'Company default';
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl(`/api/staff/${id}`), { method: 'DELETE', headers });
      if (res.ok) {
        setStaffList((prev) => prev.filter((s) => s.id !== id));
        planContext?.refetch();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove staff');
      }
    } catch (err: any) {
      alert('Failed to remove staff: ' + err.message);
    }
  };

  const usage = planContext?.usage;
  const atStaffLimit = usage && usage.staffLimit != null && usage.staffCount >= usage.staffLimit;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-12">
        <button
          onClick={() => navigate(-1)}
          className="p-3 bg-slate-900 rounded-2xl shadow-sm hover:bg-slate-800 transition-all border border-slate-800 text-slate-300"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-right">
          <h1 className="font-black text-3xl italic tracking-tighter uppercase leading-none text-slate-50">
            Team Hub
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-right">Management Console</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <div className="bg-slate-900/80 p-8 rounded-[3rem] shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-white/10">
            <div className="flex items-center gap-3 mb-8 text-emerald-300">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <UserPlus size={24} />
              </div>
              <h2 className="font-black text-xl uppercase tracking-tighter text-slate-50 text-left">Add Staff</h2>
            </div>

            {usage && (
              <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase tracking-widest">
                Plan: {usage.plan} — Staff {usage.staffCount}
                {usage.staffLimit != null ? ` / ${usage.staffLimit}` : ' (unlimited)'}
              </p>
            )}
            {atStaffLimit && usage && (
              <div className="mb-4">
                <UpgradePrompt limit="staff" current={usage.staffCount} max={usage.staffLimit!} />
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-5 text-left">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">Full Name *</label>
                <div className="relative mt-1">
                  <User className="absolute left-4 top-4 text-slate-500" size={18} />
                  <input
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 ring-emerald-400 outline-none transition-all font-bold text-sm text-slate-50 placeholder:text-slate-500"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">
                  UK Phone Number *
                </label>
                <div className="relative mt-1">
                  <div className="absolute left-4 top-4 text-slate-200 font-black text-sm">+44</div>
                  <input
                    type="tel"
                    placeholder="7700 123456"
                    className="w-full pl-14 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 ring-emerald-400 outline-none transition-all font-bold text-sm text-slate-50 placeholder:text-slate-500"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-300 ml-2 tracking-widest">Role</label>
                <div className="relative mt-1">
                  <ShieldCheck className="absolute left-4 top-4 text-slate-500" size={18} />
                  <select
                    className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 ring-emerald-400 outline-none transition-all font-bold text-sm appearance-none cursor-pointer text-slate-50"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="staff">Staff</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Staff log in with their phone number and default password (12345678). They can change the password after first login.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || atStaffLimit}
                className="w-full py-5 bg-emerald-400 text-slate-950 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-emerald-300 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Add to Team'}
              </button>
            </form>

            {lastCreated && (
              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-400/40 rounded-2xl">
                <p className="text-xs font-black text-emerald-200 uppercase tracking-widest mb-2">Share with staff</p>
                <p className="text-[10px] text-emerald-100 mb-1">
                  <strong>Phone (login):</strong> {lastCreated.loginPhone}
                </p>
                <p className="text-[10px] text-emerald-100 mb-3">
                  <strong>Default password:</strong> {lastCreated.defaultPassword}
                </p>
                <p className="text-[10px] text-emerald-100 mb-3">
                  Staff sign in at Staff Login with this phone and password. They can change it after first login.
                </p>
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-300"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy login details'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-6 flex items-center justify-between px-4">
            <h2 className="font-black text-slate-400 text-xs uppercase tracking-[0.3em] italic">Active Roster</h2>
            <span className="bg-slate-900 text-slate-200 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-slate-700">
              {staffList.length} Members
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fetching ? (
              <div className="col-span-2 flex flex-col items-center py-20">
                <Loader2 className="animate-spin text-emerald-400 mb-4" size={32} />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Syncing...</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="col-span-2 text-center py-24 bg-slate-900/80 rounded-[3rem] border-4 border-dashed border-slate-800 text-slate-400 flex flex-col items-center">
                <UserPlus size={48} className="mb-4 opacity-40" />
                <span className="font-black uppercase text-xs tracking-widest">No members found</span>
              </div>
            ) : (
              staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="bg-slate-900/80 p-6 rounded-[2.5rem] shadow-sm border border-slate-800 flex items-center justify-between group hover:border-emerald-400/60 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-950 rounded-[1.25rem] flex items-center justify-center text-emerald-300 font-black text-xl uppercase border border-slate-700">
                      {(staff.full_name || staff.name || '?').charAt(0)}
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-50 text-lg leading-none mb-1 tracking-tight">
                        {staff.full_name || staff.name}
                      </h3>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-emerald-300 font-black uppercase tracking-widest italic">
                          {staff.role}
                        </span>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Phone size={10} className="shrink-0" />
                          <span className="text-[10px] font-bold">{staff.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Wallet size={10} className="text-slate-500 shrink-0" />
                          <span className="text-[10px] text-slate-500">{payLabel(staff)}</span>
                          <button
                            type="button"
                            onClick={() => openPayModal(staff)}
                            className="text-[10px] font-bold text-emerald-400 hover:underline"
                          >
                            Set pay
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openPayModal(staff)}
                      className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                      title="Set pay"
                    >
                      <Wallet size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(staff.id)}
                    className="p-4 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {payModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPayModalStaff(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-50">Pay — {payModalStaff.full_name}</h3>
              <button type="button" onClick={() => setPayModalStaff(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Used when a job doesn’t set its own pay. Otherwise company default applies.</p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">Pay type (which rate to use)</label>
              <select
                value={payTypeDraft}
                onChange={(e) => { setPayTypeDraft((e.target.value || '') as '' | 'hourly' | 'percentage' | 'fixed'); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
              >
                <option value="">Use company default</option>
                <option value="hourly">Hourly (hours × rate)</option>
                <option value="percentage">Percentage of job price</option>
                <option value="fixed">Fixed amount per job</option>
              </select>
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-xs text-slate-400">Hourly rate (£)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payHourlyDraft}
                    onChange={(e) => setPayHourlyDraft(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                    placeholder="e.g. 12.50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400">Percentage of job (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={payPercentageDraft}
                    onChange={(e) => setPayPercentageDraft(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                    placeholder="e.g. 40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400">Fixed amount per job (£)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payFixedDraft}
                    onChange={(e) => setPayFixedDraft(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                    placeholder="e.g. 50"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  We’ll use the rate that matches the selected <span className="font-semibold">Pay type</span>; the other values are saved for later if you switch method.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setPayModalStaff(null)} className="flex-1 py-2 border border-slate-600 rounded-xl text-slate-300 font-medium">Cancel</button>
              <button type="button" onClick={saveStaffPay} disabled={savingPay} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">
                {savingPay ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

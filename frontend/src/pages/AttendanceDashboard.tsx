import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { ChevronLeft, ChevronDown, Loader2, DollarSign, Clock, X, Settings, Wallet, FileText, Download } from 'lucide-react';

/** Derive initial inputs from staff. 載入時將三個數值都拎晒出嚟，唔再根據 pay_type 隱藏。 */
function getInitialPayFromStaff(staff: { pay_type?: string | null; pay_hourly_rate?: number | null; pay_percentage?: number | null; pay_fixed_amount?: number | null } | undefined) {
  return {
    initialHourly: staff?.pay_hourly_rate != null ? String(staff.pay_hourly_rate) : '',
    initialPercentage: staff?.pay_percentage != null ? String(staff.pay_percentage) : '',
    initialFixed: staff?.pay_fixed_amount != null ? String(staff.pay_fixed_amount) : '',
    usesDefault: staff?.pay_hourly_rate == null && staff?.pay_percentage == null && staff?.pay_fixed_amount == null,
  };
}

/** One row of payroll: own local state so editing one employee never affects others. Save 晒三個數值；onSaved 用自己嘅 payload + staffId，唔依賴 API 回傳。 */
function StaffPayRow({
  staffId,
  staffName,
  totalHours,
  totalPay,
  initialHourly,
  initialPercentage,
  initialFixed,
  defaultLabel,
  onSaved,
  onDownloadPayslip,
  downloadingPayslip,
  apiUrlFn,
  getAuthHeaders,
  toast,
}: {
  staffId: string;
  staffName: string;
  totalHours: number;
  totalPay?: number;
  initialHourly: string;
  initialPercentage: string;
  initialFixed: string;
  defaultLabel: string;
  onSaved: (updatedProfile: { id: string; pay_type?: string | null; pay_hourly_rate?: number | null; pay_percentage?: number | null; pay_fixed_amount?: number | null }) => void;
  onDownloadPayslip?: (staffId: string, staffName: string) => void;
  downloadingPayslip?: boolean;
  apiUrlFn: (path: string) => string;
  getAuthHeaders: () => Promise<HeadersInit>;
  toast: { success: (s: string) => void; error: (s: string) => void };
}) {
  const [hourly, setHourly] = useState(initialHourly);
  const [percentage, setPercentage] = useState(initialPercentage);
  const [fixed, setFixed] = useState(initialFixed);
  const [saving, setSaving] = useState(false);
  const hasPersonalPay = hourly !== '' || percentage !== '' || fixed !== '';

  const handleSave = async () => {
    setSaving(true);
    const pt: 'hourly' | 'percentage' | 'fixed' = hourly !== '' ? 'hourly' : percentage !== '' ? 'percentage' : fixed !== '' ? 'fixed' : 'hourly';
    const payload = {
      pay_type: pt,
      pay_hourly_rate: hourly === '' ? null : Number(hourly),
      pay_percentage: percentage === '' ? null : Number(percentage),
      pay_fixed_amount: fixed === '' ? null : Number(fixed),
    };
    try {
      const h = await getAuthHeaders();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (typeof h === 'object' && h && 'Authorization' in h) (headers as any).Authorization = (h as any).Authorization;
      const res = await fetch(apiUrlFn(`/api/staff/${staffId}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Saved. This employee only.');
        onSaved({ id: staffId, ...payload });
      } else {
        const data = (await res.json().catch(() => ({}))) as any;
        toast.error(data?.error ?? 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-stretch gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
      <div className="min-w-0 flex flex-col justify-center">
        <p className="font-bold text-slate-100">{staffName}</p>
        <p className="text-xl font-black text-emerald-400">
          {totalHours.toFixed(2)} h
          <span className="text-slate-300 font-semibold ml-2">
            {totalPay != null && totalPay > 0 ? `· £${totalPay.toFixed(2)} period pay` : '· —'}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 ml-auto bg-slate-900/80 rounded-xl border border-slate-700 px-4 py-3">
        {hasPersonalPay ? (
          <span className="text-xs text-slate-400 w-full sm:w-auto" title="Each employee has their own pay settings">Per employee</span>
        ) : (
          <span className="text-xs text-amber-400/90 w-full sm:w-auto" title="No personal pay set; company default applies">Default: {defaultLabel}</span>
        )}
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">£/hr</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            placeholder="—"
            className="w-20 px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-600 text-slate-50"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">%</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="—"
            className="w-16 px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-600 text-slate-50"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">£ fix</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
            placeholder="—"
            className="w-20 px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-600 text-slate-50"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
        </button>
        {onDownloadPayslip && (
          <button
            type="button"
            onClick={() => onDownloadPayslip(staffId, staffName)}
            disabled={downloadingPayslip}
            className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
            title="Download this employee's payslip (this period)"
          >
            {downloadingPayslip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Payslip
          </button>
        )}
      </div>
    </div>
  );
}

interface AttendanceRow {
  id: string;
  staff_id: string;
  staff_name: string;
  job_id: string;
  job_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  total_hours: number | null;
  cleaner_pay: number | null;
  status: string;
  late_minutes: number | null;
}

interface PayrollRow {
  staff_id: string;
  staff_name: string;
  total_hours: number;
  total_pay?: number;
}

interface AttendanceDashboardProps {
  companyId: string | null;
}

export function AttendanceDashboard({ companyId }: AttendanceDashboardProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; full_name: string; pay_type?: string | null; pay_hourly_rate?: number | null; pay_percentage?: number | null; pay_fixed_amount?: number | null }>>([]);
  const [companyPay, setCompanyPay] = useState<{ default_pay_type?: string; default_hourly_rate?: number | null; default_pay_percentage?: number | null; default_fixed_pay?: number | null } | null>(null);
  const [jobList, setJobList] = useState<Array<{ id: string; client_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterJobId, setFilterJobId] = useState('');
  const [clockOutModal, setClockOutModal] = useState<{ id: string; staff_name: string; clock_in_time: string; cleaner_pay?: number | null } | null>(null);
  const [clockOutTime, setClockOutTime] = useState('');
  const [clockOutCleanerPay, setClockOutCleanerPay] = useState('');
  const [patching, setPatching] = useState(false);
  const [payrollSettingsOpen, setPayrollSettingsOpen] = useState(false);
  const [payrollRoundDraft, setPayrollRoundDraft] = useState<number>(15);
  const [defaultPayTypeDraft, setDefaultPayTypeDraft] = useState<'hourly' | 'percentage' | 'fixed'>('hourly');
  const [defaultHourlyRateDraft, setDefaultHourlyRateDraft] = useState<string>('');
  const [defaultPayPercentageDraft, setDefaultPayPercentageDraft] = useState<string>('');
  const [defaultFixedPayDraft, setDefaultFixedPayDraft] = useState<string>('');
  const [savingPayrollSettings, setSavingPayrollSettings] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<'report' | 'payslips' | null>(null);
  const [downloadingPayslipStaffId, setDownloadingPayslipStaffId] = useState<string | null>(null);
  const [payrollHoursCollapsed, setPayrollHoursCollapsed] = useState(true);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      let url = apiUrl('/api/admin/attendance') + `?date_from=${dateFrom}&date_to=${dateTo}`;
      if (filterStaffId) url += `&staff_id=${filterStaffId}`;
      if (filterJobId) url += `&job_id=${filterJobId}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAttendances(Array.isArray(data) ? data : []);
    } catch {
      setAttendances([]);
    }
  }, [dateFrom, dateTo, filterStaffId, filterJobId]);

  const fetchPayroll = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const url = apiUrl('/api/admin/payroll-hours') + `?date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPayroll(Array.isArray(data) ? data : []);
    } catch {
      setPayroll([]);
    }
  }, [dateFrom, dateTo]);

  const fetchOptions = useCallback(async () => {
    if (!companyId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const [staffRes, jobsRes, companyRes] = await Promise.all([
      fetch(apiUrl('/api/staff'), { headers }),
      fetch(apiUrl('/api/jobs'), { headers }),
      fetch(apiUrl('/api/companies'), { headers }),
    ]);
    const staffData = await staffRes.json().catch(() => []);
    const jobsData = await jobsRes.json().catch(() => []);
    const companyData = await companyRes.json().catch(() => ({}));
    setStaffList(Array.isArray(staffData) ? staffData.map((s: any) => ({
      id: s.id,
      full_name: s.full_name || s.name,
      pay_type: s.pay_type,
      pay_hourly_rate: s.pay_hourly_rate,
      pay_percentage: s.pay_percentage,
      pay_fixed_amount: s.pay_fixed_amount,
    })) : []);
    setJobList(Array.isArray(jobsData) ? jobsData.map((j: any) => ({ id: j.id, client_name: j.client_name })) : []);
    if (companyData && companyData.id) {
      setCompanyPay({
        default_pay_type: companyData.default_pay_type,
        default_hourly_rate: companyData.default_hourly_rate,
        default_pay_percentage: companyData.default_pay_percentage,
        default_fixed_pay: companyData.default_fixed_pay,
      });
    }
  }, [companyId]);

  /** After saving one employee's pay: update only that staff's pay fields in staffList. Never merge other fields so hours/total_pay stay from payroll API only. */
  const handleStaffPaySaved = useCallback((updatedProfile: { id: string; pay_type?: string | null; pay_hourly_rate?: number | null; pay_percentage?: number | null; pay_fixed_amount?: number | null }) => {
    setStaffList((prev) => prev.map((s) =>
      s.id !== updatedProfile.id ? s : {
        ...s,
        pay_type: updatedProfile.pay_type ?? s.pay_type,
        pay_hourly_rate: updatedProfile.pay_hourly_rate !== undefined ? updatedProfile.pay_hourly_rate : s.pay_hourly_rate,
        pay_percentage: updatedProfile.pay_percentage !== undefined ? updatedProfile.pay_percentage : s.pay_percentage,
        pay_fixed_amount: updatedProfile.pay_fixed_amount !== undefined ? updatedProfile.pay_fixed_amount : s.pay_fixed_amount,
      }
    ));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAttendance(), fetchPayroll(), fetchOptions()]).finally(() => setLoading(false));
  }, [fetchAttendance, fetchPayroll, fetchOptions]);

  /** Payroll rows: one per staff, sorted by name A–Z so order never jumps when you save. */
  const payrollRows = (() => {
    const byStaffFromApi = new Map<string, { total_hours: number; total_pay?: number }>();
    payroll.forEach((p) => byStaffFromApi.set(p.staff_id, { total_hours: p.total_hours, total_pay: p.total_pay }));
    const rows = staffList
      .filter((s) => !filterStaffId || s.id === filterStaffId)
      .map((s) => {
        const fromApi = byStaffFromApi.get(s.id);
        return {
          staff_id: s.id,
          staff_name: s.full_name || 'Unknown',
          total_hours: fromApi?.total_hours ?? 0,
          total_pay: fromApi?.total_pay,
        };
      });
    return rows.sort((a, b) => (a.staff_name || '').localeCompare(b.staff_name || '', 'en'));
  })();

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  /** Set date range to preset: this week (Mon–today), last week, last 2 weeks, this month, last month. */
  const setPeriodPreset = (preset: 'this_week' | 'last_week' | 'last_2_weeks' | 'this_month' | 'last_month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from: Date;
    let to: Date;
    const getMonday = (d: Date) => {
      const x = new Date(d);
      const day = x.getDay();
      const diff = x.getDate() - day + (day === 0 ? -6 : 1);
      x.setDate(diff);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    if (preset === 'this_week') {
      from = getMonday(today);
      to = new Date(today);
    } else if (preset === 'last_week') {
      const mon = getMonday(today);
      from = new Date(mon);
      from.setDate(from.getDate() - 7);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
    } else if (preset === 'last_2_weeks') {
      to = new Date(today);
      from = new Date(to);
      from.setDate(from.getDate() - 13);
    } else if (preset === 'this_month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today);
    } else {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    }
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  const stillClockedIn = attendances.filter((r) => r.status === 'clocked_in');

  const companyPayLabel = companyPay
    ? (companyPay.default_pay_type === 'hourly' && companyPay.default_hourly_rate != null)
      ? `£${Number(companyPay.default_hourly_rate).toFixed(2)}/hr`
      : companyPay.default_pay_type === 'percentage' && companyPay.default_pay_percentage != null
        ? `${companyPay.default_pay_percentage}%`
        : companyPay.default_pay_type === 'fixed' && companyPay.default_fixed_pay != null
          ? `£${Number(companyPay.default_fixed_pay).toFixed(2)}/job`
          : 'Not set'
    : '…';

  const downloadPdf = async (type: 'report' | 'payslips') => {
    setDownloadingPdf(type);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const url = apiUrl(`/api/admin/payroll-${type === 'report' ? 'report-pdf' : 'payslips-pdf'}`) + `?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error ?? 'Download failed');
        return;
      }
      const blob = await res.blob();
      const name = type === 'report' ? `payroll-report-${dateFrom}-to-${dateTo}.pdf` : `payslips-${dateFrom}-to-${dateTo}.pdf`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('PDF downloaded.');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const downloadPayslipForStaff = async (staffId: string, staffName: string) => {
    setDownloadingPayslipStaffId(staffId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const url = apiUrl('/api/admin/payroll-payslips-pdf') + `?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&staff_id=${encodeURIComponent(staffId)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error ?? 'Download failed');
        return;
      }
      const blob = await res.blob();
      const safeName = staffName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') || 'payslip';
      const name = `payslip-${safeName}-${dateFrom}-to-${dateTo}.pdf`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Payslip downloaded.');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingPayslipStaffId(null);
    }
  };

  const openPayrollSettings = async () => {
    setPayrollSettingsOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/companies'), { headers });
      if (res.ok) {
        const data = await res.json();
        const val = (data as any).payroll_round_minutes;
        setPayrollRoundDraft([5, 10, 15, 60].includes(Number(val)) ? Number(val) : 15);
        const pt = (data as any).default_pay_type;
        setDefaultPayTypeDraft(['hourly', 'percentage', 'fixed'].includes(pt) ? pt : 'hourly');
        setDefaultHourlyRateDraft((data as any).default_hourly_rate != null ? String((data as any).default_hourly_rate) : '');
        setDefaultPayPercentageDraft((data as any).default_pay_percentage != null ? String((data as any).default_pay_percentage) : '');
        setDefaultFixedPayDraft((data as any).default_fixed_pay != null ? String((data as any).default_fixed_pay) : '');
      }
    } catch {
      setPayrollRoundDraft(15);
    }
  };

  const savePayrollRound = async () => {
    setSavingPayrollSettings(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/companies'), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          payroll_round_minutes: [5, 10, 15, 60].includes(payrollRoundDraft) ? payrollRoundDraft : 15,
          default_pay_type: defaultPayTypeDraft,
          default_hourly_rate: defaultHourlyRateDraft === '' ? null : Number(defaultHourlyRateDraft),
          default_pay_percentage: defaultPayPercentageDraft === '' ? null : Number(defaultPayPercentageDraft),
          default_fixed_pay: defaultFixedPayDraft === '' ? null : Number(defaultFixedPayDraft),
        }),
      });
      if (res.ok) {
        setPayrollSettingsOpen(false);
        setCompanyPay({
          default_pay_type: defaultPayTypeDraft,
          default_hourly_rate: defaultHourlyRateDraft === '' ? null : Number(defaultHourlyRateDraft),
          default_pay_percentage: defaultPayPercentageDraft === '' ? null : Number(defaultPayPercentageDraft),
          default_fixed_pay: defaultFixedPayDraft === '' ? null : Number(defaultFixedPayDraft),
        });
        const recalcRes = await fetch(apiUrl('/api/admin/payroll-recalculate'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
        });
        const recalcData = await recalcRes.json().catch(() => ({}));
        const n = recalcRes.ok ? ((recalcData as any).updated ?? 0) : 0;
        await Promise.all([fetchAttendance(), fetchPayroll()]);
        toast.success(`Round setting saved. Updated ${n} record(s) for this period.`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error ?? 'Failed to save. Run database migration 026 if you see a column error.');
      }
    } catch {
      toast.error('Failed to save payroll setting.');
    } finally {
      setSavingPayrollSettings(false);
    }
  };

  const recalculatePayrollHours = async () => {
    setRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/admin/payroll-recalculate'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Updated ${(data as any).updated ?? 0} attendance record(s) with current round setting.`);
        await Promise.all([fetchAttendance(), fetchPayroll()]);
      } else {
        toast.error((data as any).error ?? 'Failed to recalculate');
      }
    } catch {
      toast.error('Failed to recalculate hours');
    } finally {
      setRecalculating(false);
    }
  };

  const openClockOutModal = (r: AttendanceRow) => {
    const source = r.clock_out_time ? new Date(r.clock_out_time) : new Date();
    const local = new Date(source.getTime() - source.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setClockOutTime(local);
    setClockOutCleanerPay(r.cleaner_pay != null ? String(r.cleaner_pay) : '');
    setClockOutModal({ id: r.id, staff_name: r.staff_name, clock_in_time: r.clock_in_time, cleaner_pay: r.cleaner_pay });
  };

  const handleSetClockOut = async () => {
    if (!clockOutModal) return;
    setPatching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body: { clock_out_time: string; cleaner_pay?: number | null } = { clock_out_time: new Date(clockOutTime).toISOString() };
      if (clockOutCleanerPay !== '') {
        const v = Number(clockOutCleanerPay);
        body.cleaner_pay = Number.isNaN(v) ? null : Math.round(v * 100) / 100;
      } else if (clockOutModal.cleaner_pay !== undefined) body.cleaner_pay = null;
      const res = await fetch(apiUrl(`/api/admin/attendance/${clockOutModal.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await Promise.all([fetchAttendance(), fetchPayroll()]);
        setClockOutModal(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert((err as any).error ?? 'Failed to update');
      }
    } finally {
      setPatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-300 border border-slate-800"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-black text-2xl text-slate-50">Attendance & Payroll</h1>
        </div>
        <button
          type="button"
          onClick={openPayrollSettings}
          className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-300 border border-slate-700 flex items-center gap-2"
          title="Payroll settings"
        >
          <Settings size={20} />
          <span className="text-sm font-medium hidden sm:inline">Settings</span>
        </button>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Filters */}
        <div className="bg-slate-900/80 rounded-2xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-950 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-950 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Staff</label>
              <select
                value={filterStaffId}
                onChange={(e) => setFilterStaffId(e.target.value)}
                className="px-3 py-2 border border-slate-700 rounded-xl text-sm min-w-[160px] bg-slate-950 text-slate-50"
              >
                <option value="">All staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Job</label>
              <select
                value={filterJobId}
                onChange={(e) => setFilterJobId(e.target.value)}
                className="px-3 py-2 border border-slate-700 rounded-xl text-sm min-w-[180px] bg-slate-950 text-slate-50"
              >
                <option value="">All jobs</option>
                {jobList.map((j) => (
                  <option key={j.id} value={j.id}>{j.client_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Period</span>
              {(['this_week', 'last_week', 'last_2_weeks', 'this_month', 'last_month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodPreset(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                >
                  {p === 'this_week' ? 'This week' : p === 'last_week' ? 'Last week' : p === 'last_2_weeks' ? 'Last 2 weeks' : p === 'this_month' ? 'This month' : 'Last month'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reminder: still clocked in */}
        {stillClockedIn.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-400/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-amber-400" />
              <span className="font-bold text-amber-200">
                {stillClockedIn.length} staff still clocked in — set clock-out time so payroll is correct.
              </span>
            </div>
          </div>
        )}

        {/* Payroll hours summary — collapsible */}
        <div className="bg-slate-900/80 rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPayrollHoursCollapsed((c) => !c)}
              onKeyDown={(e) => e.key === 'Enter' && setPayrollHoursCollapsed((c) => !c)}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90"
            >
              <ChevronDown size={20} className={`text-slate-400 transition-transform ${payrollHoursCollapsed ? '' : 'rotate-180'}`} />
              <DollarSign size={20} className="text-emerald-400" />
              <h2 className="font-black text-slate-50">Payroll hours</h2>
            </div>
            {!payrollHoursCollapsed && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-xl border border-slate-800">
                  <Wallet size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-300">Company default:</span>
                  <span className="text-sm font-semibold text-emerald-300">{companyPayLabel}</span>
                  <button type="button" onClick={() => setPayrollSettingsOpen(true)} className="text-xs font-medium text-emerald-400 hover:underline">Edit</button>
                </div>
                <button
                  type="button"
                  onClick={recalculatePayrollHours}
                  disabled={recalculating || loading}
                  className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 flex items-center gap-2"
                >
                  {recalculating ? <Loader2 size={16} className="animate-spin" /> : null}
                  Recalculate hours for this period
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf('report')}
                  disabled={downloadingPdf !== null || loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  title="Download summary PDF for accountants"
                >
                  {downloadingPdf === 'report' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  Report (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf('payslips')}
                  disabled={downloadingPdf !== null || loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  title="Download all employees' payslips (one PDF, one page per employee)"
                >
                  {downloadingPdf === 'payslips' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  All payslips (PDF)
                </button>
              </div>
            )}
          </div>
          {!payrollHoursCollapsed && (
            <div className="px-6 pb-6 pt-0 border-t border-slate-800">
              {loading ? (
                <Loader2 className="animate-spin text-emerald-400 mt-4" size={24} />
              ) : payrollRows.length === 0 ? (
                <p className="text-slate-400 text-sm mt-4">No staff in company yet, or filter has no match.</p>
              ) : (
                <div className="space-y-3 mt-4">
                  <p className="text-xs text-slate-500">Each row is this employee’s own pay (Save updates only that person). Hours on the left are this period for that employee only. Company default above is edited via Settings / Edit.</p>
                  {payrollRows.map((p) => {
                    const staff = staffList.find((s) => s.id === p.staff_id);
                    const { initialHourly, initialPercentage, initialFixed } = getInitialPayFromStaff(staff);
                    return (
                      <StaffPayRow
                        key={`payroll-${p.staff_id}`}
                        staffId={p.staff_id}
                        staffName={p.staff_name}
                        totalHours={p.total_hours}
                        totalPay={p.total_pay}
                        initialHourly={initialHourly}
                        initialPercentage={initialPercentage}
                        initialFixed={initialFixed}
                        defaultLabel={companyPayLabel}
                        onSaved={handleStaffPaySaved}
                        onDownloadPayslip={downloadPayslipForStaff}
                        downloadingPayslip={downloadingPayslipStaffId === p.staff_id}
                        apiUrlFn={apiUrl}
                        getAuthHeaders={getAuthHeaders}
                        toast={toast}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendance table */}
        <div className="bg-slate-900/80 rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-slate-800 overflow-hidden">
          <h2 className="p-4 font-black text-slate-50 border-b border-slate-800">Attendance records</h2>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
            </div>
          ) : attendances.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No attendance records.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Date</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Staff</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Job</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Clock in</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Clock out</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Hours</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Pay</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">GPS (in)</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest">Status</th>
                    <th className="text-left py-3 px-4 text-[10px] font-black text-slate-200 uppercase tracking-widest w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-900/70 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-50">{formatDate(r.clock_in_time)}</td>
                      <td className="py-3 px-4 text-slate-100">{r.staff_name}</td>
                      <td className="py-3 px-4 text-slate-100">{r.job_name}</td>
                      <td className="py-3 px-4 text-slate-200">{formatTime(r.clock_in_time)}</td>
                      <td className="py-3 px-4 text-slate-200">{formatTime(r.clock_out_time)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-300">
                        {r.total_hours != null ? `${r.total_hours.toFixed(2)} h` : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {r.cleaner_pay != null ? `£${Number(r.cleaner_pay).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-[10px] text-slate-500">
                        {r.clock_in_lat != null && r.clock_in_lng != null
                          ? `${r.clock_in_lat.toFixed(4)}, ${r.clock_in_lng.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === 'clocked_out'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/40'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => openClockOutModal(r)}
                          className="text-xs font-semibold text-emerald-400 hover:underline"
                        >
                          {r.status === 'clocked_in' ? 'Set clock-out time' : 'Correct hours'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {payrollSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPayrollSettingsOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-50">Payroll settings</h3>
              <button type="button" onClick={() => setPayrollSettingsOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Company default only. Each employee’s pay is set in the table on this page (per row).</p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Payroll round method</label>
                <select
                  value={payrollRoundDraft}
                  onChange={(e) => setPayrollRoundDraft(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes (default)</option>
                  <option value={60}>Round to nearest hour</option>
                </select>
                <p className="text-xs text-slate-500">Clock in/out hours are rounded to this interval for payroll.</p>
              </div>
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <label className="block text-sm font-medium text-slate-300">Company default pay type</label>
                <select
                  value={defaultPayTypeDraft}
                  onChange={(e) => setDefaultPayTypeDraft(e.target.value as 'hourly' | 'percentage' | 'fixed')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="hourly">Hourly (hours × rate)</option>
                  <option value="percentage">Percentage of job price</option>
                  <option value="fixed">Fixed amount per job</option>
                </select>
                {defaultPayTypeDraft === 'hourly' && (
                  <div>
                    <label className="block text-xs text-slate-400 mt-2">Default hourly rate (£)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={defaultHourlyRateDraft}
                      onChange={(e) => setDefaultHourlyRateDraft(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                      placeholder="e.g. 12.50"
                    />
                  </div>
                )}
                {defaultPayTypeDraft === 'percentage' && (
                  <div>
                    <label className="block text-xs text-slate-400 mt-2">Default percentage (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={defaultPayPercentageDraft}
                      onChange={(e) => setDefaultPayPercentageDraft(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                      placeholder="e.g. 40"
                    />
                  </div>
                )}
                {defaultPayTypeDraft === 'fixed' && (
                  <div>
                    <label className="block text-xs text-slate-400 mt-2">Default fixed pay per job (£)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={defaultFixedPayDraft}
                      onChange={(e) => setDefaultFixedPayDraft(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50"
                      placeholder="e.g. 50"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500">Used when an employee has no personal pay set (personal pay = table below).</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setPayrollSettingsOpen(false)} className="flex-1 py-2 border border-slate-600 rounded-xl text-slate-300 font-medium">Cancel</button>
              <button type="button" onClick={savePayrollRound} disabled={savingPayrollSettings} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">
                {savingPayrollSettings ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {clockOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setClockOutModal(null)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-50">Set clock-out time</h3>
              <button type="button" onClick={() => setClockOutModal(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-300 mb-2">{clockOutModal.staff_name} — use the correct end time so payroll hours are right.</p>
            <label className="block text-xs font-medium text-slate-400 mb-1">Clock-out date & time</label>
            <input
              type="datetime-local"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">Cleaner pay (£) — optional override</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={clockOutCleanerPay}
                onChange={(e) => setClockOutCleanerPay(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Leave blank to use calculated pay"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setClockOutModal(null)} className="flex-1 py-2 border border-slate-600 rounded-xl text-slate-300 font-medium">Cancel</button>
              <button type="button" onClick={handleSetClockOut} disabled={patching} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">
                {patching ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}

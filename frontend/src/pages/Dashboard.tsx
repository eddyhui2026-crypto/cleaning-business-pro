import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import {
  LayoutDashboard,
  Plus,
  TrendingUp,
  CheckCircle2,
  Users,
  List,
  LogOut,
  DollarSign,
  UserCircle,
  AlertCircle,
  Package,
  Phone as PhoneIcon,
  MessageCircle,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  CheckCircle,
  Bell,
  BarChart2,
  CircleHelp,
} from 'lucide-react';

// --- Components & Utils ---
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { usePlan } from '../context/PlanContext';
import { CreateJobModal } from '../components/CreateJobModal';
import { EditJobModal } from '../components/EditJobModal';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { useToast } from '../context/ToastContext';
import { enablePushAdmin } from '../lib/pushNotifications';
import { isUkBankHoliday } from '../config/ukBankHolidays';

// --- 類型定義 ---
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: any;
}


export const Dashboard = ({ companyId }: { companyId: string | null }) => {
  const navigate = useNavigate();
  const plan = usePlan();
  const toast = useToast();
  const isStandardOrPremium = plan?.isStandardOrPremium ?? false;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [bookingsCount, setBookingsCount] = useState(0);
  const [dailyRemarks, setDailyRemarks] = useState<Record<string, string>>({});
  const [remarkDatesRange, setRemarkDatesRange] = useState<{ from: string; to: string } | null>(null);
  const [remarkModal, setRemarkModal] = useState<{ dateStr: string; jobCount: number } | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [todayCashTotal, setTodayCashTotal] = useState<number>(0);
  const [dashboardInvoices, setDashboardInvoices] = useState<any[]>([]);
  const [staffLocations, setStaffLocations] = useState<any[]>([]);
  const [jobAssignmentEvents, setJobAssignmentEvents] = useState<any[]>([]);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const teamScrollRef = useRef<HTMLDivElement>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('cf_push_admin_enabled') === '1' ? 'Enabled' : null;
  });
  const [adminPasswordChanged] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('cf_admin_password_changed') === '1';
  });
  const [payrollThisMonth, setPayrollThisMonth] = useState<number>(0);
  const [payrollThisWeek, setPayrollThisWeek] = useState<number>(0);
  const [companyInfo, setCompanyInfo] = useState<{
    name?: string;
    booking_slug?: string;
    default_pay_type?: string | null;
    default_hourly_rate?: number | null;
    default_pay_percentage?: number | null;
    default_fixed_pay?: number | null;
    default_payment_method?: string | null;
    default_payment_instructions?: string | null;
    default_payment_terms_days?: number | null;
  } | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [showGettingStartedHint, setShowGettingStartedHint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('cf_hide_getting_started');
    return stored !== '1';
  });

  const formatPhoneForLink = (phone: string | null | undefined) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    // assume UK, normalised earlier in backend as +44...
    const withPlus = digits.startsWith('44') ? `+${digits}` : digits.startsWith('0') ? `+44${digits.slice(1)}` : `+${digits}`;
    return {
      tel: `tel:${withPlus}`,
      whatsapp: `https://wa.me/${withPlus.replace('+', '')}`,
    };
  };

  // --- 1. 核心數據抓取 ---
  const FETCH_TIMEOUT_MS = 12000;

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSyncError(null);
    try {
      const doFetch = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          throw new Error('No session');
        }
        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        };
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthFrom = startOfMonth.toISOString().slice(0, 10);
        const monthTo = endOfMonth.toISOString().slice(0, 10);
        const getMonday = (d: Date) => {
          const x = new Date(d);
          const day = x.getDay();
          x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
          x.setHours(0, 0, 0, 0);
          return x;
        };
        const monday = getMonday(now);
        const weekFrom = monday.toISOString().slice(0, 10);
        const weekTo = now.toISOString().slice(0, 10);

        const companiesRes = fetch(apiUrl('/api/companies'), { headers });
        const profilePromise = supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => data?.full_name ?? '');

        const [
          jobsRes,
          staffRes,
          bookingsRes,
          paymentsRes,
          invoicesRes,
          staffLocRes,
          jobAssignmentEventsRes,
          payrollMonthRes,
          payrollWeekRes,
          companiesResolved,
          profileName,
        ] = await Promise.all([
          fetch(apiUrl('/api/jobs?page=1&page_size=200'), { headers }),
          fetch(apiUrl('/api/staff'), { headers }),
          fetch(apiUrl('/api/admin/bookings'), { headers }),
          fetch(apiUrl('/api/admin/invoices/payments'), { headers }),
          fetch(apiUrl('/api/admin/invoices'), { headers }),
          fetch(apiUrl('/api/admin/staff-locations'), { headers }),
          fetch(apiUrl('/api/staff/job-assignment-events?limit=10'), { headers }),
          fetch(apiUrl(`/api/admin/payroll-hours?date_from=${monthFrom}&date_to=${monthTo}`), { headers }),
          fetch(apiUrl(`/api/admin/payroll-hours?date_from=${weekFrom}&date_to=${weekTo}`), { headers }),
          companiesRes.then(r => r.json().catch(() => ({}))),
          profilePromise,
        ]);
        const jobsData = await jobsRes.json();
        const staffData = await staffRes.json();
        const bookingsData = await bookingsRes.json().catch(() => []);
        const paymentsData = await paymentsRes.json().catch(() => []);
        const invoicesData = await invoicesRes.json().catch(() => []);
        const staffLocData = await staffLocRes.json().catch(() => []);
        const jobAssignmentEventsData = await jobAssignmentEventsRes.json().catch(() => []);
        const payrollMonthData = await payrollMonthRes.json().catch(() => []);
        const payrollWeekData = await payrollWeekRes.json().catch(() => []);
        const sumPay = (arr: any[]) => (Array.isArray(arr) ? arr.reduce((s, r) => s + (Number(r.total_pay) || 0), 0) : 0);
        setPayrollThisMonth(sumPay(payrollMonthData));
        setPayrollThisWeek(sumPay(payrollWeekData));
        const c = companiesResolved && typeof companiesResolved === 'object' ? companiesResolved as any : null;
        setCompanyInfo(c ? {
          name: c.name,
          booking_slug: c.booking_slug,
          default_pay_type: c.default_pay_type,
          default_hourly_rate: c.default_hourly_rate,
          default_pay_percentage: c.default_pay_percentage,
          default_fixed_pay: c.default_fixed_pay,
          default_payment_method: (c as any).default_payment_method ?? null,
          default_payment_instructions: (c as any).default_payment_instructions ?? null,
          default_payment_terms_days: (c as any).default_payment_terms_days ?? null,
        } : null);
        setUserDisplayName(typeof profileName === 'string' ? profileName : '');
        return { jobsData, staffData, bookingsData, paymentsData, invoicesData, staffLocData, jobAssignmentEventsData };
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT_MS),
      );
      const { jobsData, staffData, bookingsData, paymentsData, invoicesData, staffLocData, jobAssignmentEventsData } = await Promise.race([doFetch(), timeoutPromise]);
      setBookingsCount(Array.isArray(bookingsData) ? bookingsData.filter((b: any) => b.status === 'pending').length : 0);
      setJobAssignmentEvents(Array.isArray(jobAssignmentEventsData) ? jobAssignmentEventsData : []);

      if (Array.isArray(staffData)) {
        setStaffList(staffData);
      }
      const paymentsArray = Array.isArray(paymentsData) ? paymentsData : [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const cashTotal = paymentsArray
        .filter((p: any) => p.method === 'cash' && p.paid_at && String(p.paid_at).slice(0, 10) === todayStr)
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      setTodayCashTotal(cashTotal);
      setDashboardInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setStaffLocations(Array.isArray(staffLocData) ? staffLocData : []);
      
      if (Array.isArray(jobsData)) {
        const now = new Date().toISOString();
        const formattedEvents = jobsData.map((j: any) => {
          // Hide cancelled jobs to stay consistent with Schedule page
          if (j.status === 'cancelled') return null;
          let eventColor = '#6366f1'; // Indigo (Default/Pending)
          if (j.status === 'completed') eventColor = '#10b981'; // Emerald
          if (j.status === 'in_progress') eventColor = '#3b82f6'; // Blue
          if (j.status === 'cancelled') eventColor = '#ef4444'; // Red

          const staffNames = j.staff_members?.length > 0
            ? ` [${j.staff_members.map((s: any) => s.full_name || s.name).join(', ')}]`
            : ' (Unassigned)';
          const addressSuffix = j.address ? ` — ${j.address}` : '';
          const isOverdue = j.scheduled_at < now && j.status !== 'completed' && j.status !== 'cancelled';

          // End time from details.estimated_hours so week/day view bar length matches actual duration (cap 12h)
          let durationHours = 2;
          const details = j.details as any;
          if (details && typeof details === 'object') {
            const h = Number(details.estimated_hours);
            if (!Number.isNaN(h) && h > 0) durationHours = Math.min(12, h);
          }
          const startDate = new Date(j.scheduled_at);
          const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

          return {
            id: j.id,
            title: `${j.client_name || 'Unnamed Client'}${staffNames}${addressSuffix}`,
            start: j.scheduled_at,
            end: endDate.toISOString(),
            backgroundColor: eventColor,
            borderColor: 'transparent',
            classNames: isOverdue ? ['overdue'] : [],
            extendedProps: {
              ...j,
              staff_members: j.staff_members || [],
            },
          };
        }).filter(Boolean);
        setEvents(formattedEvents as any);
      }
    } catch (err) {
      console.error("🔥 Dashboard Sync Error:", err);
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(msg === 'Request timeout' ? 'Request timeout. Is the backend running (npm run backend)? Try refresh or Retry.' : msg);
    } finally {
      setLoading(false);
    }
  }, [companyId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep the dashboard alerts fresh when the user returns to the tab.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchData]);

  // Fetch daily remarks for visible calendar month (Overview)
  useEffect(() => {
    if (!companyId || !remarkDatesRange) return;
    const { from, to } = remarkDatesRange;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(apiUrl(`/api/admin/daily-remarks?from=${from}&to=${to}`), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!res.ok) return;
        const list = await res.json();
        const map: Record<string, string> = {};
        (list ?? []).forEach((r: { date: string; note: string | null }) => {
          if (r.date && r.note) map[r.date.slice(0, 10)] = r.note;
        });
        setDailyRemarks(map);
      } catch {
        // ignore
      }
    })();
  }, [companyId, remarkDatesRange?.from, remarkDatesRange?.to]);

  // --- 2. 數據統計邏輯 ---
  const totalJobs = events.length;
  const completedJobs = events.filter(e => e.extendedProps.status === 'completed').length;
  const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const activeStaffCount = staffList.length;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const getMonday = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay();
    x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const startOfWeek = getMonday(now);
  const monthStartStr = startOfMonth.toISOString().slice(0, 10);
  const monthEndStr = endOfMonth.toISOString().slice(0, 10);
  const weekStartStr = startOfWeek.toISOString().slice(0, 10);
  const revenueThisMonth = events
    .filter(e => e.extendedProps.status === 'completed' && e.start >= monthStartStr && e.start <= monthEndStr)
    .reduce((sum, e) => sum + (parseFloat(e.extendedProps.price) || 0), 0);
  const revenueThisWeek = events
    .filter(e => e.extendedProps.status === 'completed' && e.start >= weekStartStr && e.start <= todayIso)
    .reduce((sum, e) => sum + (parseFloat(e.extendedProps.price) || 0), 0);
  const netProfitThisMonth = revenueThisMonth - payrollThisMonth;
  const netProfitThisWeek = revenueThisWeek - payrollThisWeek;
  const todayJobsTotal = events.filter(e => e.start?.slice(0, 10) === todayIso).length;
  const todayJobsCompleted = events.filter(e => e.start?.slice(0, 10) === todayIso && e.extendedProps.status === 'completed').length;

  // --- Alert & today metrics ---

  const noShowAlerts = events
    .filter(e => {
      const status = e.extendedProps.status;
      if (status === 'completed' || status === 'in_progress' || status === 'cancelled') return false;
      const scheduled = e.start;
      if (!scheduled) return false;
      const startDate = new Date(scheduled);
      // same day & already passed 15 minutes
      if (startDate.toISOString().slice(0, 10) !== todayIso) return false;
      const diffMs = now.getTime() - startDate.getTime();
      return diffMs > 15 * 60 * 1000;
    })
    .map(e => {
      const staffNames = (e.extendedProps.staff_members || [])
        .map((s: any) => s.full_name || s.name)
        .filter(Boolean)
        .join(', ') || 'Unassigned';
      const startTime = new Date(e.start).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${staffNames} ${startTime} job not started yet`;
    });

  const completedWithoutInvoiceAlerts = events
    .filter(e => {
      const status = e.extendedProps.status;
      if (status !== 'completed') return false;
      if (e.extendedProps.invoice) return false;
      const completedAt = e.extendedProps.completed_at || e.extendedProps.updated_at;
      if (!completedAt) return false;
      const completedDate = new Date(completedAt);
      const diffMs = now.getTime() - completedDate.getTime();
      return diffMs > 24 * 60 * 60 * 1000;
    })
    .map(e => `${e.extendedProps.client_name || 'Unnamed client'} job completed >24h without invoice`);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const highDebtAlerts = (() => {
    const nowMs = now.getTime();
    const cutoff = nowMs - THIRTY_DAYS_MS;
    const byCustomer: Record<string, { name: string; count: number; amount: number }> = {};
    dashboardInvoices
      .filter((inv: any) => inv.status !== 'paid')
      .forEach((inv: any) => {
        const createdStr = inv.issued_at || inv.created_at;
        if (!createdStr) return;
        const ts = new Date(createdStr).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return;
        const cid = inv.customer_id || 'unknown';
        if (!byCustomer[cid]) {
          byCustomer[cid] = {
            name: (inv.customer as any)?.full_name || 'Customer',
            count: 0,
            amount: 0,
          };
        }
        byCustomer[cid].count += 1;
        byCustomer[cid].amount += Number(inv.total) || 0;
      });
    return Object.values(byCustomer)
      .filter((v) => v.count >= 2 && v.amount > 0)
      .map(
        (v) =>
          `${v.name} has ${v.count} unpaid invoices in the last 30 days (total £${v.amount.toFixed(2)})`,
      );
  })();

  const overviewAlerts = [...noShowAlerts, ...completedWithoutInvoiceAlerts, ...highDebtAlerts];

  // Greeting by time of day (UK)
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = (userDisplayName || '').trim() || (companyInfo?.name || '').trim() || 'there';
  const greetingText = `${greeting}, ${displayName}.`;

  // Setup hints for new companies: what to set and where (to + label = link; action = special button)
  const setupHints: { message: string; to?: string; label: string; action?: 'enable_notify' }[] = [];
  if (!companyInfo?.name || companyInfo.name === 'My Cleaning Business' || companyInfo.name.trim() === '') {
    setupHints.push({ message: 'Set your company name so it appears on invoices and reports.', to: '/admin/settings', label: 'Settings' });
  }
  if (!adminPasswordChanged) {
    setupHints.push({ message: 'Update your admin login password for better security.', to: '/admin/settings', label: 'Change password' });
  }
  const hasDefaultPay = companyInfo?.default_pay_type && (
    (companyInfo.default_pay_type === 'hourly' && companyInfo.default_hourly_rate != null) ||
    (companyInfo.default_pay_type === 'percentage' && companyInfo.default_pay_percentage != null) ||
    (companyInfo.default_pay_type === 'fixed' && companyInfo.default_fixed_pay != null)
  );
  if (!hasDefaultPay) {
    setupHints.push({ message: 'Set default pay (hourly / % / fixed) in Payroll so we can calculate wages.', to: '/admin/attendance', label: 'Payroll' });
  }
  const hasPaymentSettings =
    companyInfo?.default_payment_method ||
    (companyInfo as any)?.default_payment_instructions ||
    (companyInfo as any)?.default_payment_terms_days;
  if (!hasPaymentSettings) {
    setupHints.push({ message: 'Set default payment settings for invoices (e.g. bank details).', to: '/admin/invoices?open=payment-settings', label: 'Invoices & Payments' });
  }
  if (staffList.length === 0) {
    setupHints.push({ message: 'Add your first staff so you can assign jobs and run payroll.', to: '/admin/staff', label: 'Staff' });
  }
  if (pushStatus !== 'Enabled') {
    setupHints.push({ message: 'Turn on notifications so you don’t miss job updates.', label: 'Turn on', action: 'enable_notify' });
  }

  const UPCOMING_HOLIDAY_DAYS = 14;

  const holidayAlerts = (() => {
    const nowDate = new Date(now);
    const cutoff = new Date(now);
    cutoff.setDate(nowDate.getDate() + UPCOMING_HOLIDAY_DAYS);
    const jobsByHoliday: Record<string, { name: string; count: number }> = {};
    events.forEach((e) => {
      const d = new Date(e.start);
      if (d < nowDate || d > cutoff) return;
      const h = isUkBankHoliday(d.toISOString());
      if (!h) return;
      const key = h.date;
      if (!jobsByHoliday[key]) {
        jobsByHoliday[key] = { name: h.name, count: 0 };
      }
      jobsByHoliday[key].count += 1;
    });
    return Object.entries(jobsByHoliday).map(([date, info]) => {
      const niceDate = new Date(date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      return `${info.count} job${info.count > 1 ? 's' : ''} scheduled on UK bank holiday ${info.name} (${niceDate}) within next ${UPCOMING_HOLIDAY_DAYS} days`;
    });
  })();

  const allOverviewAlerts = [...overviewAlerts, ...holidayAlerts];

  const googleMapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const staticMapUrl = (() => {
    const locationsWithCoords = staffLocations.filter(
      (s: any) => typeof s.last_lat === 'number' && typeof s.last_lng === 'number',
    );
    if (!googleMapsApiKey || locationsWithCoords.length === 0) return null;
    const base = 'https://maps.googleapis.com/maps/api/staticmap';
    const centerLat =
      locationsWithCoords.reduce((sum: number, s: any) => sum + s.last_lat, 0) /
      locationsWithCoords.length;
    const centerLng =
      locationsWithCoords.reduce((sum: number, s: any) => sum + s.last_lng, 0) /
      locationsWithCoords.length;
    const markers = locationsWithCoords
      .map((s: any) => `${s.last_lat},${s.last_lng}`)
      .join('|');
    const params = new URLSearchParams({
      center: `${centerLat},${centerLng}`,
      zoom: '12',
      size: '640x360',
      maptype: 'roadmap',
      markers: `color:0x10b981|${markers}`,
      key: googleMapsApiKey,
    });
    return `${base}?${params.toString()}`;
  })();


  // --- 3. FullCalendar 配置（跟 Schedule 一致） ---
  const handleEventDrop = useCallback(async (info: any) => {
    const jobId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;
    const previousEvents = [...events];
    // Recalc end from estimated_hours so bar length stays correct
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== jobId) return e;
        let durationHours = 2;
        const details = e.extendedProps?.details as any;
        if (details && typeof details === 'object') {
          const h = Number(details.estimated_hours);
          if (!Number.isNaN(h) && h > 0) durationHours = Math.min(12, h);
        }
        const endDate = new Date(newStart.getTime() + durationHours * 60 * 60 * 1000);
        return { ...e, start: newStart.toISOString(), end: endDate.toISOString() };
      }),
    );
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ scheduled_at: newStart.toISOString() }),
      });
      if (!res.ok) {
        setEvents(previousEvents);
        info.revert();
      } else {
        fetchData();
      }
    } catch {
      setEvents(previousEvents);
      info.revert();
    }
  }, [events, fetchData]);

  const baseCalendarProps = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: 'timeGridWeek' as const,
    height: 'auto',
    contentHeight: 420,
    nowIndicator: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '19:00:00',
    scrollTime: '07:00:00',
    slotDuration: '00:15:00',
    snapDuration: '00:15:00',
    allDaySlot: true,
    editable: true,
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false } as const,
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false } as const,
    eventContent: (arg: any) => {
      const view = arg.view?.type ?? '';
      if (view.includes('list')) {
        const start = arg.event.start;
        const end = arg.event.end;
        const fmt = (d: Date | null) => d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        const startStr = fmt(start);
        const endStr = fmt(end || null);
        let hoursStr = '';
        if (start && end) {
          const h = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
          hoursStr = h % 1 === 0 ? `(${h}h)` : `(${h.toFixed(1)}h)`;
        }
        const text = [startStr, endStr].filter(Boolean).join(' – ') + (hoursStr ? ` ${hoursStr} ` : ' ') + (arg.event.title || '');
        const el = document.createElement('div');
        el.className = 'fc-list-event-content-custom';
        el.textContent = text;
        return { domNodes: [el] };
      }
      return undefined;
    },
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleEnableNotifications = async () => {
    setPushLoading(true);
    setPushStatus(null);
    const result = await enablePushAdmin(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return { Authorization: `Bearer ${session?.access_token}` };
    });
    const status = result.ok ? 'Enabled' : (result.error || 'Failed');
    setPushStatus(status);
    if (typeof window !== 'undefined') {
      if (status === 'Enabled') window.localStorage.setItem('cf_push_admin_enabled', '1');
      else window.localStorage.removeItem('cf_push_admin_enabled');
    }
    setPushLoading(false);
  };

  const handleReportSubmit = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error('Session expired. Please sign in again.');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/support/report'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          category: reportCategory,
          subject: reportSubject || null,
          message: reportMessage,
          context_url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err?.message || err?.error || 'Failed to submit report');
      }

      toast.success('Report sent to support.');
      setReportOpen(false);
      setReportSubject('');
      setReportMessage('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit report');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-20">
      <main className="flex flex-col min-w-0 text-left">
        <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-8 py-3 sm:py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between gap-2 min-h-[44px]">
            <div className="flex items-center gap-2 text-emerald-300 shrink-0">
              <div className="bg-emerald-500 p-1.5 sm:p-2 rounded-xl text-slate-950 shadow-lg shadow-emerald-500/40">
                <LayoutDashboard size={20} className="sm:w-[22px] sm:h-[22px]" />
              </div>
              <span className="font-black text-lg sm:text-xl text-slate-50 tracking-tighter uppercase italic hidden sm:inline">CleanPro</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/admin/help"
                className="p-2.5 sm:px-3 sm:py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 justify-center"
                title="Help & FAQ"
              >
                <CircleHelp size={18} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Help</span>
              </Link>
              <button
                onClick={() => setReportOpen(true)}
                className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-amber-500 text-white font-bold flex items-center gap-1.5 sm:gap-2 text-xs uppercase tracking-wider hover:bg-amber-600 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 justify-center"
                title="Report"
              >
                <AlertCircle size={18} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Report</span>
              </button>
              <button
                onClick={() => navigate('/admin/jobs/new')}
                className="p-2.5 sm:px-5 sm:py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center gap-1.5 sm:gap-2 text-xs uppercase tracking-wider hover:bg-emerald-400 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 justify-center shadow-lg shadow-emerald-500/30"
                title="New Job"
              >
                <Plus size={18} strokeWidth={3} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">New Job</span>
              </button>
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={pushLoading}
                className={`relative p-2.5 sm:px-3 sm:py-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 justify-center disabled:opacity-50 border ${
                  pushStatus === 'Enabled'
                    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/70'
                    : 'text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/40'
                }`}
                title={pushStatus === 'Enabled' ? 'Notifications on' : 'Enable notifications'}
              >
                {pushLoading ? (
                  <span className="animate-pulse text-[10px]">…</span>
                ) : (
                  <>
                    <Bell size={18} className="sm:w-4 sm:h-4" />
                    {pushStatus === 'Enabled' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.45)] sm:hidden" />
                    )}
                  </>
                )}
                <span className="hidden sm:inline">{pushStatus === 'Enabled' ? 'On' : 'Notify'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1600px] w-full mx-auto flex-1">
          {loading ? (
             <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-[6px] border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Syncing with Cloud Database...</p>
                <p className="text-[10px] text-slate-500">If this lasts more than ~12s, the backend may be off.</p>
             </div>
          ) : syncError ? (
             <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-amber-300 font-bold text-center max-w-md">{syncError}</p>
                <button type="button" onClick={() => fetchData()} className="px-6 py-3 rounded-2xl bg-slate-700 text-white font-bold hover:bg-slate-600">Retry</button>
             </div>
          ) : (
            <>
              {showGettingStartedHint && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-[2px] text-amber-300" />
                    <div>
                      <p className="font-semibold">New here?</p>
                      <p className="mt-0.5">
                        Follow the 4-step owner checklist to set up staff, customers, jobs, and invoices.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate('/admin/getting-started')}
                      className="rounded-full bg-amber-400 text-slate-950 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-amber-300"
                    >
                      Open guide
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGettingStartedHint(false);
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('cf_hide_getting_started', '1');
                        }
                      }}
                      className="text-amber-200/80 hover:text-amber-100 px-1"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Overview */}
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end flex-wrap gap-4">
                    <div>
                      <p className="text-emerald-300/90 font-bold text-lg sm:text-xl tracking-tight">{greetingText}</p>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-50 tracking-tight mt-1">Dashboard</h2>
                      <p className="text-slate-400 font-bold text-sm mt-1">Here’s your business at a glance.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Live Status</p>
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-400/40">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        Synced
                      </div>
                    </div>
                  </div>

                  {setupHints.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Get started — set these up first</p>
                      {setupHints.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 justify-between px-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-600 text-slate-200 text-sm"
                        >
                          <span className="font-medium">{h.message}</span>
                          <button
                            type="button"
                            onClick={h.action === 'enable_notify' ? handleEnableNotifications : () => h.to && navigate(h.to)}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400"
                          >
                            {h.label}{h.to ? ' →' : ''}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {jobAssignmentEvents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                        Job responses — tap to reassign
                      </p>
                      {jobAssignmentEvents.map((a: any) => {
                        const response = a.response_status as string;
                        const jobDateStr = a.job_scheduled_at ? String(a.job_scheduled_at).slice(0, 10) : '';
                        const bg =
                          response === 'declined' ? 'bg-amber-500/20 border-amber-400/70' : 'bg-amber-500/10 border-amber-400/40';
                        return (
                          <div
                            key={a.id}
                            className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${bg} text-amber-100 text-sm`}
                          >
                            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {response === 'declined' ? '[Declined]' : '[Accepted]'} {a.staff_full_name || 'Staff'} —{' '}
                                {a.job_client_name || 'Job'}
                              </div>
                              <div className="text-xs text-amber-100/80 mt-1">
                                {a.job_address ? String(a.job_address) : 'No address'} {a.job_scheduled_at ? `· ${jobDateStr}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/admin/schedule?jobId=${encodeURIComponent(a.job_id)}&view=timeGridDay&date=${encodeURIComponent(
                                    jobDateStr,
                                  )}`,
                                )
                              }
                              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
                            >
                              Review
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {allOverviewAlerts.length > 0 && (
                    <div className="space-y-2">
                      {allOverviewAlerts.map((msg, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-amber-100 text-sm"
                        >
                          <AlertCircle size={18} className="flex-shrink-0" />
                          <span className="font-medium">{msg}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    if (typeof sessionStorage === 'undefined') return null;
                    const lastViewedRaw = sessionStorage.getItem('cleaning_app_report_last_viewed');
                    const now = new Date();
                    const getMonday = (d: Date) => {
                      const x = new Date(d);
                      const day = x.getDay();
                      x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
                      x.setHours(0, 0, 0, 0);
                      return x.getTime();
                    };
                    const thisWeekStart = getMonday(now);
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    const thisYearStart = new Date(now.getFullYear(), 0, 1).getTime();
                    let hasNewReport = !lastViewedRaw;
                    if (lastViewedRaw) {
                      const last = new Date(lastViewedRaw);
                      const lastWeekStart = getMonday(last);
                      const lastMonthStart = new Date(last.getFullYear(), last.getMonth(), 1).getTime();
                      const lastYearStart = new Date(last.getFullYear(), 0, 1).getTime();
                      hasNewReport = thisWeekStart > lastWeekStart || thisMonthStart > lastMonthStart || thisYearStart > lastYearStart;
                    }
                    if (!hasNewReport) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => navigate('/admin/reports')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-100 text-sm font-medium hover:bg-emerald-500/25 transition-colors text-left"
                      >
                        <BarChart2 size={18} className="flex-shrink-0 text-emerald-400" />
                        <span>Report ready — tap to view</span>
                      </button>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    <StatCard icon={<DollarSign size={20} />} label="Revenue (completed)" valueLabel="This month" value={`£${revenueThisMonth.toLocaleString()}`} subtitleLabel="This week" subtitle={`£${revenueThisWeek.toLocaleString()}`} color="bg-slate-900/80 text-slate-50" />
                    <StatCard icon={<DollarSign size={20} />} label="Net profit" hint="Revenue − labour" valueLabel="This month" value={`£${netProfitThisMonth.toLocaleString()}`} subtitleLabel="This week" subtitle={`£${netProfitThisWeek.toLocaleString()}`} color="bg-slate-900/80 text-slate-50" />
                    <StatCard icon={<DollarSign size={20} />} label="Cash today" value={`£${todayCashTotal.toFixed(2)}`} />
                    <StatCard icon={<CheckCircle2 size={20} />} label="Jobs finished" value={`${completedJobs} / ${totalJobs}`} subtitle={`Today: ${todayJobsCompleted} / ${todayJobsTotal}`} />
                    <StatCard icon={<TrendingUp size={20} />} label="Completion rate" value={`${completionRate}%`} />
                    <StatCard icon={<Users size={20} />} label="Active staff" value={activeStaffCount.toString()} />
                  </div>

                  {dashboardInvoices.length > 0 && (() => {
                    const unpaidInvoices = (dashboardInvoices as any[])
                      .filter((inv: any) => inv.status !== 'paid')
                      .sort((a: any, b: any) => {
                        const da = a.due_at || a.issued_at || a.created_at || '';
                        const db = b.due_at || b.issued_at || b.created_at || '';
                        return (da || '').localeCompare(db || '');
                      });
                    if (unpaidInvoices.length === 0) return null;
                    const handleMarkAsPaid = async (inv: any) => {
                      setMarkingPaidId(inv.id);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(apiUrl(`/api/admin/invoices/${inv.id}`), {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                          body: JSON.stringify({ status: 'paid' }),
                        });
                        if (res.ok) {
                          toast.success('Marked as paid');
                          fetchData();
                        } else toast.error('Failed to update');
                      } catch {
                        toast.error('Failed to update');
                      } finally {
                        setMarkingPaidId(null);
                      }
                    };
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                          <h3 className="font-black text-slate-50 uppercase tracking-tight">
                            Unpaid & overdue invoices
                          </h3>
                          <button
                            type="button"
                            onClick={() => navigate('/admin/invoices')}
                            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                          >
                            View all ({unpaidInvoices.length}) →
                          </button>
                        </div>
                        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
                          <div className="max-h-[220px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-950/70 border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-400 sticky top-0">
                                <tr>
                                  <th className="text-left py-2 px-3">Invoice</th>
                                  <th className="text-left py-2 px-3">Customer</th>
                                  <th className="text-left py-2 px-3">Total</th>
                                  <th className="text-left py-2 px-3">Due</th>
                                  <th className="text-left py-2 px-3">Status</th>
                                  <th className="text-right py-2 px-3">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unpaidInvoices.map((inv: any) => {
                                  const dueStr = inv.due_at || inv.issued_at || inv.created_at;
                                  const dueDate = dueStr ? new Date(dueStr) : null;
                                  const isOverdue = dueDate ? dueDate.getTime() < now.getTime() : false;
                                  return (
                                    <tr key={inv.id} className="border-b border-slate-800 last:border-0">
                                      <td className="py-2 px-3 text-slate-50">{inv.invoice_number}</td>
                                      <td className="py-2 px-3 text-slate-300 truncate max-w-[100px]">{(inv.customer as any)?.full_name || '—'}</td>
                                      <td className="py-2 px-3 text-slate-300">£{Number(inv.total).toFixed(2)}</td>
                                      <td className="py-2 px-3 text-slate-300">{dueDate ? dueDate.toLocaleDateString() : '—'}</td>
                                      <td className="py-2 px-3">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isOverdue ? 'bg-rose-500/15 text-rose-300 border border-rose-400/40' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                                          {isOverdue ? 'Overdue' : inv.status}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => navigate('/admin/invoices')}
                                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                            title="Edit"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleMarkAsPaid(inv)}
                                            disabled={markingPaidId === inv.id}
                                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1"
                                            title="Mark as paid"
                                          >
                                            {markingPaidId === inv.id ? (
                                              <span className="text-[10px]">…</span>
                                            ) : (
                                              <CheckCircle size={14} />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Today detailed job list */}
                  {(() => {
                    const todayKey = new Date().toISOString().slice(0, 10);
                    const todayJobs = events
                      .filter((e) => e.start?.slice(0, 10) === todayKey)
                      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
                    if (todayJobs.length === 0) return null;
                    return (
                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-3 px-1">
                          <h3 className="font-black text-slate-50 uppercase tracking-tight">
                            Today&apos;s jobs
                          </h3>
                        </div>
                        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
                          <div className="max-h-[260px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-950/70 border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-400 sticky top-0">
                                <tr>
                                  <th className="text-left py-2 px-3">Time</th>
                                  <th className="text-left py-2 px-3">Customer</th>
                                  <th className="text-left py-2 px-3">Staff</th>
                                  <th className="text-left py-2 px-3">Address</th>
                                  <th className="text-left py-2 px-3">Status</th>
                                  <th className="text-left py-2 px-3">Report</th>
                                  <th className="text-left py-2 px-3">Invoice</th>
                                </tr>
                              </thead>
                              <tbody>
                                {todayJobs.map((ev: any) => {
                                  const job = ev.extendedProps || {};
                                  const start = ev.start ? new Date(ev.start) : null;
                                  const end = ev.end ? new Date(ev.end) : null;
                                  const timeStr =
                                    start && end
                                      ? `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                      : start
                                      ? start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                      : '—';
                                  const staffNames =
                                    job.staff_members && job.staff_members.length
                                      ? job.staff_members.map((s: any) => s.full_name || s.name).join(', ')
                                      : 'Unassigned';
                                  const status = job.status || 'pending';
                                  const invoice = job.invoice || null;
                                  const shareToken = job.share_token;
                                  const statusClass =
                                    status === 'completed'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                                      : status === 'in_progress'
                                      ? 'bg-blue-500/15 text-blue-300 border border-blue-400/40'
                                      : status === 'cancelled'
                                      ? 'bg-rose-500/15 text-rose-300 border border-rose-400/40'
                                      : 'bg-slate-800 text-slate-200 border border-slate-700';
                                  return (
                                    <tr key={ev.id} className="border-b border-slate-800 last:border-0">
                                      <td className="py-2 px-3 text-slate-100 whitespace-nowrap">{timeStr}</td>
                                      <td className="py-2 px-3 text-slate-50 truncate max-w-[140px]">
                                        {job.client_name || 'Unnamed client'}
                                      </td>
                                      <td className="py-2 px-3 text-slate-300 truncate max-w-[140px]">
                                        {staffNames}
                                      </td>
                                      <td className="py-2 px-3 text-slate-400 truncate max-w-[200px]">
                                        {job.address || '—'}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
                                          {status.replace(/_/g, ' ')}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-300">
                                        {shareToken ? (
                                          <button
                                            type="button"
                                            onClick={() => window.open(`/report/${encodeURIComponent(shareToken)}`, '_blank')}
                                            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
                                          >
                                            View
                                          </button>
                                        ) : (
                                          <span className="text-xs text-slate-500">—</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-slate-300">
                                        {invoice ? (
                                          <span className="text-xs">
                                            {invoice.status === 'paid'
                                              ? 'Paid'
                                              : invoice.status === 'sent'
                                              ? 'Sent'
                                              : 'Draft'}
                                          </span>
                                        ) : status === 'completed' ? (
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/admin/jobs/new?fromJob=${encodeURIComponent(job.id)}&returnTo=invoices`)}
                                            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
                                          >
                                            Create
                                          </button>
                                        ) : (
                                          <span className="text-xs text-slate-500">None</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {staffList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-black text-slate-50 uppercase tracking-tight flex items-center gap-2">
                          <Users size={18} /> Team today
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMapDrawerOpen(true)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-600"
                          >
                            <MapPin size={14} /> Map
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/admin/staff')}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30"
                          >
                            View all
                          </button>
                        </div>
                      </div>
                      <div className="relative flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => teamScrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
                          className="shrink-0 p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 border border-slate-700"
                          aria-label="Scroll left"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <div
                          ref={teamScrollRef}
                          className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide py-1 flex-1 min-w-0"
                          style={{ scrollbarWidth: 'none' }}
                        >
                          {staffList.map((s: any) => {
                            const links = formatPhoneForLink(s.phone);
                            return (
                              <div
                                key={s.id}
                                className="shrink-0 w-[200px] rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-1"
                              >
                                <p className="font-semibold text-slate-50 truncate text-sm">{s.name || s.full_name || 'Staff'}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{s.role || 'staff'}</p>
                                {links && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                                    <a href={links.tel} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700">
                                      <PhoneIcon size={10} /> Call
                                    </a>
                                    <a href={links.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600/80 text-white hover:bg-emerald-500">
                                      <MessageCircle size={10} /> WhatsApp
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => teamScrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
                          className="shrink-0 p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 border border-slate-700"
                          aria-label="Scroll right"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  {bookingsCount > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between flex-wrap gap-2">
                      <p className="font-bold text-amber-100">
                        <span className="font-black">{bookingsCount}</span> pending online booking{bookingsCount !== 1 ? 's' : ''}
                      </p>
                      <button type="button" onClick={() => navigate('/admin/bookings')} className="text-sm font-bold text-amber-100 hover:text-amber-50 underline">View bookings →</button>
                    </div>
                  )}

                    <div>
                      <h3 className="font-black text-slate-50 uppercase tracking-tight mb-4 px-1">Schedule overview</h3>
                      <div className="bg-slate-900/80 p-6 rounded-[3rem] border border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.9)] overview-calendar-wrapper">
                        <div className="w-full overflow-x-auto">
                          <div className="min-w-[720px] md:min-w-[880px]">
                            <FullCalendar
                              plugins={[dayGridPlugin, interactionPlugin]}
                              initialView="dayGridMonth"
                              height="auto"
                              contentHeight={520}
                              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                              events={[]}
                              datesSet={(info: any) => {
                                if (info.startStr && info.endStr) {
                                  setRemarkDatesRange({ from: info.startStr.slice(0, 10), to: info.endStr.slice(0, 10) });
                                }
                              }}
                              dayCellContent={(arg: any) => {
                                const dateKey = arg.date.toISOString().slice(0, 10);
                                const count = events.filter((e) => e.start.slice(0, 10) === dateKey).length;
                                const jobsText = count ? `${count} job${count > 1 ? 's' : ''}` : '';
                                const remark = dailyRemarks[dateKey];
                                const safeRemark = remark ? String(remark).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                                const remarkPreview = safeRemark ? safeRemark.slice(0, 80) + (safeRemark.length > 80 ? '…' : '') : '';
                                const hasRemark = Boolean(remarkPreview);
                                const remarkText = hasRemark ? remarkPreview : 'Remark';
                                const remarkClass = hasRemark
                                  ? 'overview-day-remark'
                                  : 'overview-day-remark overview-day-remark-placeholder';
                                const holiday = isUkBankHoliday(dateKey);
                                const holidayBadge = holiday
                                  ? `<div class="mt-1 text-[9px] font-bold text-rose-300 uppercase tracking-[0.18em]">Bank Holiday</div>`
                                  : '';
                                return {
                                  html:
                                    '<div class="overview-day-cell">' +
                                      '<div class="overview-day-header">' +
                                        `<span class="overview-day-date">${arg.dayNumberText}</span>` +
                                        (jobsText ? `<span class="overview-day-jobs">${jobsText}</span>` : '') +
                                      '</div>' +
                                      `<div class="${remarkClass}">${remarkText}</div>` +
                                      holidayBadge +
                                    '</div>',
                                };
                              }}
                              dateClick={(info: any) => {
                                const dateKey = info.dateStr.slice(0, 10);
                                const jobCount = events.filter((e) => e.start.slice(0, 10) === dateKey).length;
                                setRemarkModal({ dateStr: info.dateStr, jobCount });
                                setRemarkDraft(dailyRemarks[dateKey] ?? '');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                </div>

            </>
          )}
        </div>
      </main>

      {/* --- MODALS - 彈窗組件 --- */}
      {isModalOpen && companyId && (
        <CreateJobModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchData} 
          companyId={companyId} 
          initialDate={selectedDate}
          staffList={staffList} 
        />
      )}

      {isEditModalOpen && selectedJob && (
        <EditJobModal 
          job={selectedJob} 
          staffList={staffList} 
          onClose={() => { setIsEditModalOpen(false); setSelectedJob(null); }} 
          onSuccess={fetchData} 
        />
      )}

      {/* Team map drawer */}
      {mapDrawerOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/40"
          onClick={() => setMapDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-black text-slate-50 flex items-center gap-2">
                <MapPin size={18} /> Team map
              </h2>
              <button
                type="button"
                onClick={() => setMapDrawerOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-900"
              >
                <X size={18} />
              </button>
            </div>
            {!googleMapsApiKey && (
              <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-xl px-3 py-2">
                Google Maps API key is not configured (VITE_GOOGLE_MAPS_API_KEY). Add it to use the
                mini map.
              </p>
            )}
            {googleMapsApiKey && !staticMapUrl && (
              <p className="text-sm text-slate-300">
                No recent GPS locations found for staff yet. Clock-in data will appear here.
              </p>
            )}
            {googleMapsApiKey && staticMapUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
                <img
                  src={staticMapUrl}
                  alt="Team locations"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto mt-2 space-y-2">
              {staffLocations.map((s: any) => (
                <div
                  key={s.staff_id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-50 truncate">{s.staff_name}</p>
                    <span className="text-[11px] text-slate-400">
                      {s.last_time
                        ? new Date(s.last_time).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '—'}
                    </span>
                  </div>
                  {s.job_client_name && (
                    <p className="text-xs text-slate-400">
                      Last job: {s.job_client_name}
                      {s.job_address ? ` — ${s.job_address}` : ''}
                    </p>
                  )}
                  {(!s.last_lat || !s.last_lng) && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      No GPS coordinates for latest attendance record.
                    </p>
                  )}
                </div>
              ))}
              {staffLocations.length === 0 && (
                <p className="text-sm text-slate-400">
                  No attendance records yet. Once staff clock in on jobs, their last locations will
                  show here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Day remark modal (Overview calendar) */}
      {remarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]" onClick={() => setRemarkModal(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-xl max-w-md w-full p-6 text-left" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-50 mb-1">
              {new Date(remarkModal.dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </h3>
            <p className="text-slate-400 text-sm mb-4">{remarkModal.jobCount} job{remarkModal.jobCount !== 1 ? 's' : ''} that day</p>
            <label className="block text-slate-300 text-sm font-medium mb-2">Note for this day</label>
            <textarea
              value={remarkDraft}
              onChange={(e) => setRemarkDraft(e.target.value)}
              placeholder="e.g. Key under mat, extra supplies, client preference…"
              className="w-full h-24 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              autoFocus
            />
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                disabled={remarkSaving}
                onClick={async () => {
                  setRemarkSaving(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(apiUrl('/api/admin/daily-remarks'), {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                      body: JSON.stringify({ date: remarkModal.dateStr.slice(0, 10), note: remarkDraft.trim() || null }),
                    });
                    if (res.ok) {
                      setDailyRemarks((prev) => ({ ...prev, [remarkModal.dateStr.slice(0, 10)]: remarkDraft.trim() }));
                      setRemarkModal(null);
                    }
                  } finally {
                    setRemarkSaving(false);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {remarkSaving ? 'Saving…' : 'Save note'}
              </button>
              <button type="button" onClick={() => setRemarkModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/admin/schedule?view=timeGridDay&date=${remarkModal.dateStr.slice(0, 10)}`);
                  setRemarkModal(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 font-bold text-sm hover:bg-slate-600"
              >
                Open in Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report problem modal */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]" onClick={() => setReportOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-50 mb-1 flex items-center gap-2">
              <AlertCircle className="text-emerald-400" size={24} /> Report a problem
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Describe the issue and we&apos;ll get back to you. This report will be sent to support automatically.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={reportCategory}
                  onChange={e => setReportCategory(e.target.value)}
                  className="w-full border border-slate-700 rounded-xl px-4 py-3 bg-slate-900 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="bug">Bug / Error</option>
                  <option value="feature">Feature request</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Subject (optional)</label>
                <input
                  type="text"
                  value={reportSubject}
                  onChange={e => setReportSubject(e.target.value)}
                  placeholder="Short title"
                  className="w-full border border-slate-700 rounded-xl px-4 py-3 bg-slate-900 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
                <textarea
                  value={reportMessage}
                  onChange={e => setReportMessage(e.target.value)}
                  placeholder="Describe what went wrong or what you need..."
                  rows={4}
                  className="w-full border border-slate-700 rounded-xl px-4 py-3 bg-slate-900 text-slate-50 placeholder:text-slate-500 resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setReportOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 font-bold hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={handleReportSubmit} className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                Send report
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
};

// --- Helper Components ---

const StatCard = ({
  icon, label, value, subtitle, color = "bg-slate-900/80 text-slate-50",
  valueLabel, subtitleLabel, hint,
}: {
  icon: React.ReactNode; label: string; value: string; subtitle?: string; color?: string;
  valueLabel?: string; subtitleLabel?: string; hint?: string;
}) => (
  <div className={`${color} p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 cursor-default group`}>
    <div className={`p-2.5 rounded-xl w-fit mb-3 transition-transform group-hover:scale-105 duration-200 ${
      color.includes('slate-900') ? 'bg-white/10 text-emerald-300' : 'bg-slate-900 text-emerald-300'
    }`}>{icon}</div>
    <p className="opacity-70 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-0.5">{label}</p>
    {hint && <p className="text-[9px] opacity-60 mb-1">{hint}</p>}
    {valueLabel && <p className="text-[9px] opacity-70 font-medium">{valueLabel}</p>}
    <h2 className="text-xl sm:text-2xl font-black tracking-tighter">{value}</h2>
    {subtitleLabel && <p className="text-[9px] opacity-70 font-medium mt-2">{subtitleLabel}</p>}
    {subtitle && <p className="text-[10px] opacity-70 mt-0.5 font-medium">{subtitle}</p>}
  </div>
);
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Loader2 } from 'lucide-react';
import { isUkBankHoliday } from '../config/ukBankHolidays';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';
import { EditJobModal } from '../components/EditJobModal';
import { useLocation } from 'react-router-dom';

interface AdminSchedulePageProps {
  companyId: string | null;
}

/** 22:00–06:00 = night shift (antisocial hours) */
function isNightShift(isoStart: string): boolean {
  const d = new Date(isoStart);
  const h = d.getHours();
  const m = d.getMinutes();
  const mins = h * 60 + m;
  return mins >= 22 * 60 || mins < 6 * 60; // 22:00–05:59
}

interface JobEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  classNames?: string[];
  extendedProps: any;
}

const STANDARD_HOURS = { slotMinTime: '07:00:00', slotMaxTime: '19:00:00', scrollTime: '07:00:00' };
const OUT_OF_HOURS = { slotMinTime: '00:00:00', slotMaxTime: '24:00:00', scrollTime: '07:00:00' };

export function AdminSchedulePage({ companyId }: AdminSchedulePageProps) {
  const location = useLocation();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [showOutOfHours, setShowOutOfHours] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const applyWorkingHours = useCallback((outOfHours: boolean) => {
    const api = calendarRef.current?.getApi?.();
    if (!api) return;
    const opts = outOfHours ? OUT_OF_HOURS : STANDARD_HOURS;
    api.setOption('slotMinTime', opts.slotMinTime);
    api.setOption('slotMaxTime', opts.slotMaxTime);
    api.setOption('scrollTime', opts.scrollTime);
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
      const [jobsRes, staffRes] = await Promise.all([
        fetch(apiUrl('/api/jobs'), { headers }),
        fetch(apiUrl('/api/staff'), { headers }),
      ]);
      const jobsData = await jobsRes.json();
      const staffData = await staffRes.json();
      if (Array.isArray(staffData)) setStaffList(staffData);
      if (Array.isArray(jobsData)) {
        const now = new Date().toISOString();
        const formatted = jobsData
          .map((j: any) => {
            // Hide cancelled jobs from the calendar
            if (j.status === 'cancelled') return null;

          // Base colour by job type (full block colour)
          const serviceType = (j.service_type || '').toString().toLowerCase();
          let typeColor = '#2563eb'; // default one-off clean (blue)
          if (j.recurring_job_id) {
            typeColor = '#0d9488'; // teal for recurring jobs
          }
          if (serviceType.includes('deep') || serviceType.includes('tenancy') || serviceType.includes('eot')) {
            typeColor = '#f97316'; // orange for deep / EOT cleans
          }

          const color = typeColor;

          const staffNames = j.staff_members?.length > 0
            ? ` [${j.staff_members.map((s: any) => s.full_name || s.name).join(', ')}]`
            : ' (Unassigned)';
          const isOverdue = j.scheduled_at < now && j.status !== 'completed' && j.status !== 'cancelled';
          const night = isNightShift(j.scheduled_at);
          const statusClass =
            j.status === 'completed'
              ? 'status-completed'
              : j.status === 'in_progress'
              ? 'status-in-progress'
              : 'status-pending';
          const classNames = [
            statusClass,
            ...(isOverdue ? ['overdue'] : []),
            ...(night ? ['fc-event-night-shift'] : []),
          ];
          // Duration: use details.estimated_hours if present, otherwise default 2h; cap at 12h to avoid giant bars
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
            title: `${j.client_name || 'Unnamed'}${staffNames}`,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            backgroundColor: night ? '#3730a3' : color,
            borderColor: night ? '#4f46e5' : 'transparent',
            classNames,
            extendedProps: { ...j, staff_members: j.staff_members || [], isNightShift: night },
          };
        })
          .filter(Boolean) as JobEvent[];
        setEvents(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deep-link support: /admin/schedule?jobId=... should open that job in EditJobModal.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const jobId = params.get('jobId');
    const date = params.get('date');
    const view = params.get('view');

    if (!jobId || !companyId) return;
    if (selectedJob?.id && String(selectedJob.id) === String(jobId)) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
        const res = await fetch(apiUrl(`/api/jobs/${jobId}`), { headers });
        if (!res.ok) return;
        const job = await res.json();
        if (cancelled) return;
        setSelectedJob(job);

        // Best-effort: move calendar to the requested day/view.
        requestAnimationFrame(() => {
          const api = calendarRef.current?.getApi?.();
          if (!api) return;
          if (view && typeof api.changeView === 'function') api.changeView(view);
          if (date && typeof api.gotoDate === 'function') api.gotoDate(date);
        });
      } catch (e) {
        console.error('Failed to deep-link job:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, companyId, selectedJob]);

  const openEditModal = (job: any) => {
    setSelectedJob(job);
  };

  const handleAddNewJob = () => {
    window.location.href = '/admin/jobs/new?fromSchedule=1&returnTo=schedule';
  };

  const onToggleOutOfHours = () => {
    const next = !showOutOfHours;
    setShowOutOfHours(next);
    applyWorkingHours(next);
  };

  const handleEventDrop = useCallback(async (info: any) => {
    const jobId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;

    const previousEvents = [...events];

    // Recalculate end time based on details.estimated_hours every time we move the job
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== jobId) return e;
        let durationHours = 2;
        const details = e.extendedProps?.details as any;
        if (details && typeof details === 'object') {
          const h = Number(details.estimated_hours);
          if (!Number.isNaN(h) && h > 0) durationHours = Math.min(12, h);
        }
        const startDate = newStart;
        const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
        return {
          ...e,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        };
      }),
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ scheduled_at: newStart.toISOString() }),
      });
      if (!res.ok) {
        setEvents(previousEvents);
        info.revert();
      }
    } catch {
      setEvents(previousEvents);
      info.revert();
    }
  }, [events]);

  // 根據 search term 過濾事件（支援 client_name / address / staff）
  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const job = ev.extendedProps || {};
      const client = (job.client_name || ev.title || '').toString().toLowerCase();
      const addr = (job.address || '').toString().toLowerCase();
      const staff = (job.staff_members || [])
        .map((s: any) => (s.full_name || s.name || '').toString().toLowerCase())
        .join(' ');
      return client.includes(q) || addr.includes(q) || staff.includes(q);
    });
  }, [events, searchTerm]);

  // 計算每位員工喺「目前日曆顯示範圍」內排咗幾多小時（用事件 start/end）
  const staffHoursInRange = useMemo(() => {
    if (!visibleRange) return {};
    const hours: Record<string, number> = {};
    filteredEvents.forEach((ev) => {
      const startStr = ev.start;
      const endStr = ev.end;
      if (!startStr || !endStr) return;
      const start = new Date(startStr);
      const end = new Date(endStr);
      // 只計算與可見範圍有交集嘅事件
      if (end <= visibleRange.start || start >= visibleRange.end) return;
      const job = ev.extendedProps || {};
      const staff = job.staff_members || [];
      if (!Array.isArray(staff) || staff.length === 0) return;
      const h = Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
      staff.forEach((s: any) => {
        if (!s?.id) return;
        hours[s.id] = (hours[s.id] || 0) + h;
      });
    });
    return hours;
  }, [filteredEvents, visibleRange]);

  // 視圖範圍內有幾多日，用嚟計平均每日工時
  const daysInVisibleRange = useMemo(() => {
    if (!visibleRange) return 1;
    const ms = visibleRange.end.getTime() - visibleRange.start.getTime();
    const days = ms / (24 * 60 * 60 * 1000);
    return Math.max(1, Math.round(days));
  }, [visibleRange]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-32 lg:pb-0">
      <PageHeader
        title="Schedule"
        subtitle="Drag jobs to reschedule · Click to assign staff"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        variant="dark"
      />

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-emerald-400" size={40} />
          </div>
        ) : (
          <div className="bg-slate-900/80 rounded-2xl p-6 pb-10 shadow-[0_18px_45px_rgba(15,23,42,0.9)] border border-white/10 admin-schedule-compact mb-20">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-300">Show Out-of-Hours (24h)</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showOutOfHours}
                    onClick={onToggleOutOfHours}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      showOutOfHours ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600 bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                        showOutOfHours ? 'translate-x-5' : 'translate-x-1'
                      }`}
                      style={{ top: '2px' }}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {showOutOfHours ? '24h view · Scroll for night shifts' : 'Standard hours 07:00–19:00'}
                </p>
              </div>
              {/* Search / filter + Add job */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewJob}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500 text-slate-950 text-[11px] font-semibold hover:bg-emerald-400 shadow-sm"
                >
                  + Add new job
                </button>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by client, staff or address..."
                  className="w-40 sm:w-64 bg-slate-950 border border-slate-700 rounded-2xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {/* Job type legend (squares) */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-[3px] bg-blue-600" /> One-off clean
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-[3px] bg-teal-500" /> Recurring
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-[3px] bg-orange-500" /> Deep / EOT
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-[3px] bg-violet-700" /> Night shift
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-[3px] bg-slate-700" /> Other
                </span>
              </div>
              {/* Status legend (circles) */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> In progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
                </span>
                <span className="flex items-center gap-1">
                  🌙 Night shift indicator
                </span>
              </div>
              {/* Staff load bar — 每位員工喺目前日曆範圍內總工時 */}
              {staffList.length > 0 && visibleRange && (
                <div className="mt-3 bg-slate-950/80 border border-slate-700 rounded-2xl px-3 py-2 flex flex-wrap gap-2">
                  <div className="flex items-baseline gap-2 mr-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Staff load
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {(() => {
                        const fmt = (d: Date) =>
                          d.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          });
                        // FullCalendar 嘅 end 係「下一日」exclusive，所以顯示時減一日
                        const endDisplay = new Date(visibleRange.end.getTime() - 24 * 60 * 60 * 1000);
                        return `${fmt(visibleRange.start)} – ${fmt(endDisplay)}`;
                      })()}
                    </span>
                  </div>
                  {staffList.map((s) => {
                    const h = staffHoursInRange[s.id] || 0;
                    const rounded = Math.round(h * 10) / 10;
                    const perDay = h / daysInVisibleRange;
                    const color =
                      perDay >= 8
                        ? 'bg-rose-500/15 border-rose-400/60 text-rose-300'
                        : perDay >= 4
                        ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                        : perDay > 0
                        ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300';
                    const staffName = s.full_name || s.name;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSearchTerm(staffName || '')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium ${color} hover:border-emerald-400/80 hover:shadow-sm`}
                      >
                        <span className="truncate max-w-[90px]">{staffName}</span>
                        <span className="text-[10px] opacity-90">
                          {rounded}h{daysInVisibleRange > 1 ? ` (${Math.round(perDay * 10) / 10}h/day)` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
         </div>
          <div className="overflow-x-auto pb-4">
              <div className="min-w-[900px] lg:min-w-full">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                  initialView="timeGridWeek"
                  events={filteredEvents}
                  headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
                  eventClick={(info) => openEditModal(info.event.extendedProps)}
                  editable={true}
                  eventDurationEditable={false}
                  eventStartEditable={true}
                  eventDrop={handleEventDrop}
                  height="auto"
                  contentHeight={420}
                  expandRows={false}
                  slotMinTime={STANDARD_HOURS.slotMinTime}
                  slotMaxTime={STANDARD_HOURS.slotMaxTime}
                  scrollTime={STANDARD_HOURS.scrollTime}
                  slotDuration="00:30:00"
                  snapDuration="00:30:00"
                  allDaySlot={true}
                  eventMinHeight={10}
                  displayEventTime={false}
                  slotEventOverlap={false}
              eventClassNames={(arg) => {
                const view = arg.view?.type ?? '';
                return view.includes('timeGrid') ? ['fc-event-compact'] : [];
              }}
              fixedWeekCount={false}
              showNonCurrentDates={false}
              datesSet={(arg) => {
                const viewType = arg.view?.type ?? '';
                if (viewType.includes('dayGridMonth')) {
                  const start = new Date(arg.start);
                  const year = start.getFullYear();
                  const month = start.getMonth();
                  const monthStart = new Date(Date.UTC(year, month, 1));
                  const monthEnd = new Date(Date.UTC(year, month + 1, 1)); // exclusive
                  setVisibleRange({ start: monthStart, end: monthEnd });
                } else {
                  setVisibleRange({ start: arg.start, end: arg.end });
                }
              }}
              dayHeaderClassNames={(arg) => {
                const iso = arg.date.toISOString().slice(0, 10);
                return isUkBankHoliday(iso) ? ['fc-holiday-header'] : [];
              }}
              dayHeaderContent={(arg) => {
                const iso = arg.date.toISOString().slice(0, 10);
                const holiday = isUkBankHoliday(iso);
                return (
                  <>
                    <span>{arg.text}</span>
                    {holiday && (
                      <span className="ml-1 text-[9px] font-bold text-rose-300 uppercase tracking-[0.18em]">
                        Bank Holiday
                      </span>
                    )}
                  </>
                );
              }}
              dayCellClassNames={(arg) => {
                const iso = arg.date.toISOString().slice(0, 10);
                return isUkBankHoliday(iso) ? ['fc-holiday-cell'] : [];
              }}
              dayCellContent={(arg) => {
                const viewType = arg.view?.type ?? '';
                const dateKey = arg.date.toISOString().slice(0, 10);
                const holiday = isUkBankHoliday(dateKey);
                if (!viewType.includes('dayGridMonth')) {
                  return arg.dayNumberText;
                }
                if (!holiday) {
                  return arg.dayNumberText;
                }
                const day = arg.dayNumberText;
                return (
                  <div className="flex items-center gap-1 pl-1 pt-1">
                    <span className="text-[9px] font-bold text-rose-300 uppercase tracking-[0.18em]">
                      Bank Holiday
                    </span>
                    <span className="text-xs font-semibold">{day}</span>
                  </div>
                );
              }}
              eventContent={(arg) => {
                const view = arg.view?.type ?? '';
                const job = arg.event.extendedProps as any;
                const staff = job?.staff_members || [];
                const staffNamesFull =
                  Array.isArray(staff) && staff.length
                    ? staff.map((s: any) => s.full_name || s.name).join(', ')
                    : 'Unassigned';

                // List view：保持原有一行文字格式
                if (view.includes('list')) {
                  const start = arg.event.start;
                  const end = arg.event.end;
                  const fmt = (d: Date | null) =>
                    d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                  const startStr = fmt(start);
                  const endStr = fmt(end || null);
                  let hoursStr = '';
                  if (start && end) {
                    const h = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
                    hoursStr = h % 1 === 0 ? `(${h}h)` : `(${h.toFixed(1)}h)`;
                  }
                  const main = `${job?.client_name || arg.event.title || 'Job'}`;
                  const sub = `${staffNamesFull}${job?.address ? ' · ' + job.address : ''}`;
                  const text =
                    [startStr, endStr].filter(Boolean).join(' – ') +
                    (hoursStr ? ` ${hoursStr} ` : ' ') +
                    main +
                    (sub ? ` — ${sub}` : '');
                  const el = document.createElement('div');
                  el.className = 'fc-list-event-content-custom';
                  el.textContent = text;
                  return { domNodes: [el] };
                }

                const clientName = (job?.client_name || arg.event.title || 'Job').toString();
                const ukPostcodeRe = /\b[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}\b/i;
                const addr = (job?.address || '').toString().trim();
                const postcodeMatch = ukPostcodeRe.exec(addr);
                const postcode =
                  (job?.postcode || '').toString().trim() || (postcodeMatch ? postcodeMatch[0] : '');
                let staffSummary = 'Unassigned';
                if (Array.isArray(staff) && staff.length > 0) {
                  const names = staff.map((s: any) => s.full_name || s.name).filter(Boolean);
                  staffSummary =
                    names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
                }

                // Day 視圖：欄闊，詳細顯示 — 時間、狀態、客人名、完整地址、全部員工
                if (view === 'timeGridDay') {
                  const start = arg.event.start;
                  const end = arg.event.end;
                  const timeStr = start
                    ? start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '';
                  let durationStr = '';
                  if (start && end) {
                    const h = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
                    durationStr = h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
                  }
                  const statusLabel =
                    job?.status === 'completed'
                      ? 'Completed'
                      : job?.status === 'in_progress'
                        ? 'In progress'
                        : job?.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Pending';
                  const fullAddress = (job?.address || '').toString().trim() || '—';
                  const allStaffNames =
                    Array.isArray(staff) && staff.length > 0
                      ? staff.map((s: any) => s.full_name || s.name).filter(Boolean).join(', ')
                      : 'Unassigned';
                  const esc = (s: string) => s.replace(/</g, '&lt;');
                  const timeLine = timeStr ? (durationStr ? `${timeStr} · ${durationStr}` : timeStr) : durationStr || '';
                  const el = document.createElement('div');
                  el.className = 'fc-event-content-day';
                  el.innerHTML = `
                    <div class="fc-event-day-line fc-event-day-time">${esc(timeLine)}</div>
                    <div class="fc-event-day-line fc-event-day-status">${esc(statusLabel)}</div>
                    <div class="fc-event-day-line fc-event-day-client">${esc(clientName)}</div>
                    <div class="fc-event-day-line fc-event-day-address">${esc(fullAddress)}</div>
                    <div class="fc-event-day-line fc-event-day-staff">${esc(allStaffNames)}</div>
                  `;
                  return { domNodes: [el] };
                }

                // Week：4 行簡潔（狀態、客人名、Postcode、員工摘要）
                if (view.includes('timeGrid')) {
                  const statusLabel =
                    job?.status === 'completed'
                      ? 'Completed'
                      : job?.status === 'in_progress'
                        ? 'In progress'
                        : job?.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Pending';
                  const el = document.createElement('div');
                  el.className = 'fc-event-content-compact';
                  el.innerHTML = `
                    <div class="fc-event-line fc-event-status">${statusLabel.replace(/</g, '&lt;')}</div>
                    <div class="fc-event-line fc-event-client">${clientName.replace(/</g, '&lt;')}</div>
                    <div class="fc-event-line fc-event-postcode">${(postcode || '—').replace(/</g, '&lt;')}</div>
                    <div class="fc-event-line fc-event-staff">${staffSummary.replace(/</g, '&lt;')}</div>
                  `;
                  return { domNodes: [el] };
                }

                // Month 視圖：2 行（客名·Postcode / 員工·時數）
                const start = arg.event.start;
                const end = arg.event.end;
                const timeStr = start
                  ? start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '';
                let hoursStr = '';
                if (start && end) {
                  const h = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
                  hoursStr = h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
                }
                const isMonth = view.includes('dayGridMonth');
                const line1 = isMonth
                  ? (postcode ? `${clientName} · ${postcode}` : clientName)
                  : (timeStr ? `${timeStr} · ${clientName}` : clientName);
                const line2 = hoursStr ? `${staffSummary} · ${hoursStr}` : staffSummary;
                const line1Safe = line1.replace(/</g, '&lt;');
                const line2Safe = line2.replace(/</g, '&lt;');
                const el = document.createElement('div');
                el.className = 'fc-event-content-custom';
                el.innerHTML = `
                  <div class="fc-event-time-custom">${line1Safe}</div>
                  <div class="fc-event-title-custom fc-event-title-line2">${line2Safe}</div>
                `;
                return { domNodes: [el] };
              }}
              eventDidMount={(info) => {
                const job = info.event.extendedProps as any;
                const staff = job?.staff_members || [];
                const staffNames =
                  Array.isArray(staff) && staff.length
                    ? staff.map((s: any) => s.full_name || s.name).join(', ')
                    : 'Unassigned';
                const lines = [
                  job?.client_name || info.event.title || 'Job',
                  staffNames,
                  job?.address || '',
                  `Status: ${job?.status || 'pending'}`,
                ].filter(Boolean);
                info.el.setAttribute('title', lines.join('\n'));
              }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                  eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                />
              </div>
            </div>
            
          </div>
        )}
      </div>

      {selectedJob && (
        <EditJobModal
          job={selectedJob}
          staffList={staffList.map((s) => ({ ...s, name: s.full_name || s.name }))}
          onClose={() => setSelectedJob(null)}
          onSuccess={() => { setSelectedJob(null); fetchData(); }}
        />
      )}
      <AdminBottomNav />
    </div>
  );
}

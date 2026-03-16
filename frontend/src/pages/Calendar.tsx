import { useState, useEffect, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Loader2, Calendar as CalendarIcon, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

interface Staff {
  id: string;
  full_name: string;
  role: string;
}

interface CalendarProps {
  companyId: string | null;
}

export const Calendar = ({ companyId }: CalendarProps) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<Staff[]>([]); // 儲存員工清單
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  // 1. 獲取員工清單 (解決 Modal 報錯問題)
  const fetchStaff = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('company_id', companyId)
        .eq('role', 'cleaner');

      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error("❌ Fetch staff error:", err);
    }
  }, [companyId]);

  // 2. 獲取任務列表
  const fetchJobs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/jobs'), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const jobs = await res.json();

      const formatted = jobs.map((j: any) => {
        let bgColor = '#6366f1';
        if (j.status === 'in_progress') bgColor = '#3b82f6';
        if (j.status === 'completed') bgColor = '#10b981';

        // 計算結束時間，用 estimated_hours（最多 12 小時）
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
          title: j.client_name || 'Unnamed client',
          start: j.scheduled_at,
          end: endDate.toISOString(),
          backgroundColor: bgColor,
          borderColor: 'transparent',
          extendedProps: {
            status: j.status,
            client_name: j.client_name,
            address: j.address,
            staff_members: j.staff_members || [],
            estimated_hours: durationHours,
          },
        };
      });
      setEvents(formatted);
    } catch (err) {
      console.error("❌ Fetch jobs error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStaff(); // 👈 初始化時同時抓取任務與員工
  }, [fetchJobs, fetchStaff]);

  // 3. 計算每個員工今日總工時（用事件 start/end 計算）
  const staffHours = useMemo(() => {
    const hours: Record<string, number> = {};
    (events as any[]).forEach((ev) => {
      const job = ev.extendedProps || {};
      const staff = job.staff_members || [];
      if (!ev.start || !ev.end || !Array.isArray(staff) || staff.length === 0) return;
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      const h = Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
      staff.forEach((s: any) => {
        if (!s?.id) return;
        hours[s.id] = (hours[s.id] || 0) + h;
      });
    });
    return hours;
  }, [events]);

  // 4. 處理日曆點擊選擇時間
  const handleDateSelect = (selectInfo: any) => {
    // For now, go to admin new job page; future: can pass date via state/query
    navigate('/admin/jobs/new');
  };

  // 5. 處理點擊事件切換狀態
  const handleEventClick = async (clickInfo: any) => {
    const jobId = clickInfo.event.id;
    const currentStatus = clickInfo.event.extendedProps.status;
    
    const statusOrder = ['pending', 'in_progress', 'completed'];
    const nextStatus = statusOrder[(statusOrder.indexOf(currentStatus) + 1) % statusOrder.length];

    if (window.confirm(`Change status to ${nextStatus.replace('_', ' ').toUpperCase()}?`)) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (res.ok) {
          fetchJobs();
        }
      } catch (err) {
        alert("Failed to update status");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <CalendarIcon className="text-indigo-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Cleaning Schedule</h2>
            <p className="text-xs text-slate-500 font-medium">Click on a job to cycle through status.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-4 mr-4 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-slate-400">
              <AlertCircle size={14} className="text-indigo-500" /> Pending
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Clock size={14} className="text-blue-500" /> In Progress
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 size={14} className="text-emerald-500" /> Completed
            </span>
          </div>

          <button 
            onClick={() => navigate('/admin/jobs/new')}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 font-black text-sm active:scale-95"
          >
            <Plus size={18} /> New Job
          </button>
        </div>
      </div>

      {/* Staff load bar — 每個員工今日總工時 */}
      {staffList.length > 0 && (
        <div className="bg-white/90 border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mr-2">
            Staff load today
          </span>
          {staffList.map((s) => {
            const h = staffHours[s.id] || 0;
            const rounded = Math.round(h * 10) / 10;
            const color =
              h >= 8 ? 'bg-rose-500/10 border-rose-400/60 text-rose-400' :
              h >= 4 ? 'bg-amber-500/10 border-amber-400/60 text-amber-300' :
              h > 0 ? 'bg-emerald-500/10 border-emerald-400/60 text-emerald-300' :
              'bg-slate-900 text-slate-300 border-slate-700';
            return (
              <div
                key={s.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium ${color}`}
              >
                <span className="truncate max-w-[90px]">{s.full_name}</span>
                <span className="text-[10px] opacity-90">{rounded}h</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
        {loading ? (
          <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="text-slate-400 font-bold animate-pulse">Loading schedule...</p>
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            events={events}
            selectable={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            editable={true}
            nowIndicator={true}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek'
            }}
            height="75vh"
            eventClassNames="cursor-pointer hover:opacity-90 transition-opacity rounded-xl border-none p-1.5 font-bold text-[11px] shadow-sm"
            dayMaxEvents={true}
            slotMinTime="07:00:00"
            allDaySlot={false}
            eventContent={(arg) => {
              const job = arg.event.extendedProps as any;
              const staff = job?.staff_members || [];
              const staffNames = Array.isArray(staff) && staff.length
                ? staff.map((s: any) => s.full_name || s.name).join(', ')
                : 'Unassigned';
              const address = job?.address || '';
              return (
                <div className="flex flex-col text-[11px] leading-tight">
                  <span className="font-bold text-slate-50 truncate">
                    {job?.client_name || arg.event.title}
                  </span>
                  <span className="text-[10px] text-slate-200 truncate">
                    {staffNames}{address ? ` · ${address}` : ''}
                  </span>
                </div>
              );
            }}
            eventDidMount={(info) => {
              const job = info.event.extendedProps as any;
              const staff = job?.staff_members || [];
              const staffNames = Array.isArray(staff) && staff.length
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
          />
        )}
      </div>

      {/* Old CreateJobModal has been replaced by full-page AdminNewJobPage */}
    </div>
  );
};
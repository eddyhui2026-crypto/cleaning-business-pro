import { MapPin, Users, ChevronRight, Clock, ExternalLink, RefreshCw, Mail } from 'lucide-react';

// --- 類型定義 ---
interface Props {
  events: any[];
  onEdit: (job: any) => void;
  onRefresh: () => void;
}

export const JobHistoryTable = ({ events, onEdit, onRefresh }: Props) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* 頂部工具列 */}
      <div className="flex justify-between items-center px-4">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">
          Job Logs ({events.length})
        </h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-emerald-300 uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95 shadow-sm bg-slate-900/80 border border-white/10"
        >
          <RefreshCw size={12} />
          Sync Data
        </button>
      </div>

      {/* 表格主體 */}
      <div className="bg-slate-900/80 rounded-[2.5rem] border border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.9)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/70 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">Job Details</th>
                <th className="px-8 py-5 text-center">Assigned Team</th>
                <th className="px-8 py-5">Schedule</th>
                <th className="px-8 py-5">Current Status</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center">
                        <Users size={32} className="opacity-40" />
                      </div>
                      <p className="font-bold text-sm tracking-tight text-slate-300">No active schedules found.</p>
                      <button 
                        onClick={onRefresh}
                        className="text-[10px] text-emerald-300 font-black uppercase underline decoration-2 underline-offset-4"
                      >
                        Try refreshing
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((item) => {
                  /**
                   * 🛠️ 重要：資料結構適配邏輯
                   * 檢查資料是來自 FullCalendar (extendedProps) 還是直接來自 API (item)
                   */
                  const job = item.extendedProps || item; 
                  const displayTitle = item.title || job.client_name || 'Unnamed Client';
                  const displayDate = item.start || job.scheduled_at;
                  const staffMembers = job.staff_members || []; // 預期為 {name, id} 的陣列
                  const status = job.status || 'pending';
                  const shareToken = job.share_token;
                  
                  return (
                    <tr 
                      key={item.id || job.id} 
                      className="hover:bg-slate-900 cursor-pointer transition-all group"
                    >
                      {/* 客戶與地址 */}
                      <td className="px-8 py-6" onClick={() => onEdit(job)}>
                        <div className="flex items-center gap-4">
                          <div className={`w-2.5 h-2.5 rounded-full ring-4 ${
                            status === 'in_progress' ? 'bg-blue-500 ring-blue-50 animate-pulse' : 
                            status === 'pending' ? 'bg-amber-400 ring-amber-50' : 
                            status === 'completed' ? 'bg-emerald-500 ring-emerald-50' : 'bg-slate-200 ring-slate-50'
                          }`} />
                          
                          <div>
                            <div className="font-black text-slate-50 group-hover:text-emerald-300 transition-colors tracking-tight text-sm">
                              {displayTitle}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1 font-bold">
                              <MapPin size={10} className="text-slate-500" /> 
                              <span className="truncate max-w-[200px]">
                                {job.address || 'Location Unspecified'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* 團隊顯示 */}
                      <td className="px-8 py-6 text-center" onClick={() => onEdit(job)}>
                        <div className="flex items-center justify-center -space-x-2.5">
                          {staffMembers.length > 0 ? (
                            <>
                              {staffMembers.slice(0, 3).map((staff: any, idx: number) => (
                                <div 
                                  key={staff.id || idx}
                                  title={staff.full_name || staff.name}
                                  className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-800 shadow-sm flex items-center justify-center overflow-hidden ring-1 ring-slate-700"
                                >
                                  <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center text-emerald-300 font-black text-[10px] uppercase">
                                    {(staff.full_name || staff.name || 'S').charAt(0)}
                                  </div>
                                </div>
                              ))}
                              {staffMembers.length > 3 && (
                                <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center text-white font-black text-[9px] shadow-sm">
                                  +{staffMembers.length - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest px-3 py-1 bg-slate-900 rounded-lg border border-slate-700">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* 時間顯示 */}
                      <td className="px-8 py-6" onClick={() => onEdit(job)}>
                        <div className="flex items-center gap-2 text-slate-200 font-bold text-[11px] bg-slate-900 w-fit px-3 py-1.5 rounded-xl border border-slate-700">
                          <Clock size={12} className="text-slate-400" />
                          {displayDate ? new Date(displayDate).toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : 'No Date'}
                        </div>
                      </td>
                      
                      {/* 狀態標籤 */}
                      <td className="px-8 py-6" onClick={() => onEdit(job)}>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          status === 'completed' 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' 
                            : status === 'in_progress'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-400/40'
                            : status === 'pending'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}>
                          {status === 'completed' ? 'Archived' : 
                           status === 'in_progress' ? 'Running' : 
                           status === 'pending' ? 'Scheduled' : status}
                        </span>
                      </td>

                      {/* 操作欄 */}
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {shareToken && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = `${window.location.origin}/report/${shareToken}`;
                                  window.location.href = `mailto:?subject=${encodeURIComponent('Service Report')}&body=${encodeURIComponent(`View report: ${url}`)}`;
                                }}
                                className="p-2.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-900 rounded-xl transition-all"
                                title="Email report link"
                              >
                                <Mail size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/report/${shareToken}`, '_blank');
                                }}
                                className="p-2.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-900 rounded-xl transition-all"
                                title="View Public Report"
                              >
                                <ExternalLink size={16} />
                              </button>
                            </>
                          )}
                          <div 
                            onClick={() => onEdit(job)}
                            className="p-2.5 text-slate-500 group-hover:text-emerald-300 transition-all group-hover:translate-x-1 duration-300"
                          >
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
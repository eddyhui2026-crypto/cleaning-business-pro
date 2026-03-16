import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Calendar, ClipboardList, AlertCircle, Loader2, Building2, Mail, Download, CheckCircle2 } from 'lucide-react';
import type { JobChecklistSnapshot } from '../types/checklist';
import { apiUrl } from '../lib/api';
import { DATA_RETENTION_REPORT } from '../lib/dataRetention';

export const JobReport = () => {
  const { token } = useParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [token]);

  const fetchReportData = async () => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(apiUrl(`/api/reports/report/${encodeURIComponent(token)}`));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(true);
        setJob(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJob(data);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(true);
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadPdf = async () => {
    if (!token) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(apiUrl(`/api/reports/report/${encodeURIComponent(token)}/pdf`));
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-report-${job?.client_name || 'job'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <div className="text-slate-500 font-black uppercase tracking-widest text-xs">Generating Report...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={48} className="text-rose-400" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Report Not Found</h2>
        <p className="text-slate-500 mt-3 font-medium max-w-xs mx-auto">
          This link may have expired or the security token is incorrect.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-slate-800 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  // 提取公司資訊
  const company = job.company || {};

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 pb-24">
      <div className="max-w-4xl mx-auto bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        
        {/* 動態 Header - 顯示公司 Logo */}
        <div className="bg-slate-900 p-12 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center">
            {company.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-20 w-auto mb-6 drop-shadow-lg" />
            ) : (
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-md">
                <Building2 size={40} className="text-white" />
              </div>
            )}
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Service Report</h1>
            <div className="px-4 py-1 bg-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
              Status: Completed
            </div>
          </div>
          {/* 背景裝飾 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        </div>

        <div className="p-8 md:p-16 space-y-16">
          {/* 基本資料區 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-b border-slate-50 pb-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 block">Customer Information</label>
              <h2 className="text-3xl font-black text-slate-800 leading-tight">{job.client_name}</h2>
              <div className="flex items-start gap-3 text-slate-500">
                <MapPin size={20} className="shrink-0 mt-1 text-slate-300" /> 
                <span className="font-bold text-lg leading-snug">{job.address || "On-site Service"}</span>
              </div>
            </div>
            
            <div className="flex flex-col md:items-end justify-center">
              <div className="bg-slate-50 p-6 rounded-[2rem] inline-block text-left border border-slate-100">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Completion Date</span>
                </div>
                <p className="font-black text-xl text-slate-800 tracking-tight">{formatDate(job.scheduled_at)}</p>
              </div>
            </div>
          </div>

          {/* Service Summary / Notes */}
          {job.notes && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-800">
                <ClipboardList size={24} className="text-indigo-500" />
                <h3 className="text-xl font-black uppercase tracking-tight">Service Summary</h3>
              </div>
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                <p className="text-slate-600 leading-relaxed font-bold text-lg italic underline decoration-indigo-100 decoration-4 underline-offset-4">
                  "{job.notes}"
                </p>
              </div>
            </div>
          )}

          {/* Checklist completed — for owner & customer */}
          {job.details?.checklist && (() => {
            const checklist = job.details.checklist as JobChecklistSnapshot;
            const tasks = checklist.tasks?.filter(Boolean).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)) ?? [];
            if (tasks.length === 0) return null;
            const done = tasks.filter((t: any) => t.completed).length;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-800">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Tasks Completed</h3>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                  <p className="text-slate-500 text-sm font-bold mb-4">
                    {checklist.template_name} · {done}/{tasks.length} completed
                  </p>
                  <ul className="space-y-3">
                    {tasks.map((t: any) => (
                      <li key={t.id} className="flex items-center gap-3 text-slate-700">
                        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black ${t.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                          {t.completed ? '✓' : '—'}
                        </span>
                        <span className={t.completed ? 'font-medium' : 'text-slate-500'}>{t.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}

          {/* Visual Verification — Before/After photos */}
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tighter">Visual Verification</h3>
              <div className="h-1 bg-slate-100 flex-1 rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Before Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-l-4 border-slate-200 pl-4">
                  <span className="text-slate-400 text-xs font-black uppercase tracking-widest italic">Pre-Service (Before)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {job.before_photos?.length > 0 ? job.before_photos.map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-[2rem] overflow-hidden bg-slate-100 border-4 border-white shadow-md">
                      <img src={url} className="w-full h-full object-cover" alt="Before" />
                    </div>
                  )) : (
                    <div className="col-span-2 py-12 bg-slate-50 rounded-[2rem] text-center text-slate-300 font-bold text-xs uppercase tracking-widest border border-dashed border-slate-200">
                      No images provided
                    </div>
                  )}
                </div>
              </div>

              {/* After Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-l-4 border-emerald-500 pl-4">
                  <span className="text-emerald-500 text-xs font-black uppercase tracking-widest italic">Service Result (After)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {job.after_photos?.length > 0 ? job.after_photos.map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-[2rem] overflow-hidden bg-emerald-50 border-4 border-white shadow-xl ring-2 ring-emerald-500/5">
                      <img src={url} className="w-full h-full object-cover" alt="After" />
                    </div>
                  )) : (
                    <div className="col-span-2 py-12 bg-slate-50 rounded-[2rem] text-center text-slate-300 font-bold text-xs uppercase tracking-widest border border-dashed border-slate-200">
                      No images provided
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] italic mt-4">{DATA_RETENTION_REPORT}</p>
          </div>
          
          {/* 動態 Footer - 顯示公司資訊 */}
          <div className="pt-16 border-t border-slate-100 text-center space-y-6">
            <div className="max-w-md mx-auto">
              <p className="text-slate-400 text-sm font-bold leading-relaxed">
                {company.report_footer || `Thank you for choosing ${company.name || 'our services'}. We appreciate your business!`}
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <span className="px-4 py-2 bg-slate-100 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Verified Digital Report
              </span>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-tighter">
                Generated by CleanPro OS • Secure Token: {token?.substring(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-12 flex justify-between items-center px-6">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
          © 2026 {company.name || 'CleanPro Service'}.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download PDF
          </button>
          <button onClick={() => window.print()} className="text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors">Print</button>
          <a
            href={`mailto:?subject=${encodeURIComponent(`Service Report: ${job.client_name || 'Job'} - ${company.name || 'CleanPro'}`)}&body=${encodeURIComponent(`View the full service report: ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
            className="inline-flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors"
          >
            <Mail size={14} /> Email report
          </a>
        </div>
      </div>
    </div>
  );
};
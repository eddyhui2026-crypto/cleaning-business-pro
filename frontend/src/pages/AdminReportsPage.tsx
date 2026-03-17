import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, BarChart2, Download, TrendingUp, TrendingDown, Calendar, DollarSign, Briefcase, Users, Clock, Loader2 } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

interface AdminReportsPageProps {
  companyId: string | null;
}

function getPeriodLabel(period: ReportPeriod): string {
  return period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Yearly';
}

function getPeriodRange(period: ReportPeriod): { from: string; to: string; prevFrom: string; prevTo: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const getMonday = (date: Date) => {
    const x = new Date(date);
    const day = x.getDay();
    x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
    x.setHours(0, 0, 0, 0);
    return x;
  };

  if (period === 'weekly') {
    const mon = getMonday(now);
    const to = new Date(mon);
    to.setDate(to.getDate() + 6);
    const prevMon = new Date(mon);
    prevMon.setDate(prevMon.getDate() - 7);
    const prevTo = new Date(prevMon);
    prevTo.setDate(prevTo.getDate() + 6);
    return {
      from: mon.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      prevFrom: prevMon.toISOString().slice(0, 10),
      prevTo: prevTo.toISOString().slice(0, 10),
    };
  }
  if (period === 'monthly') {
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    const prevFrom = new Date(y, m - 1, 1);
    const prevTo = new Date(y, m, 0);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      prevFrom: prevFrom.toISOString().slice(0, 10),
      prevTo: prevTo.toISOString().slice(0, 10),
    };
  }
  const from = new Date(y, 0, 1);
  const to = new Date(y, 11, 31);
  const prevFrom = new Date(y - 1, 0, 1);
  const prevTo = new Date(y - 1, 11, 31);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10),
  };
}

function formatDateRange(from: string, to: string, period: ReportPeriod): string {
  const a = new Date(from);
  const b = new Date(to);
  if (period === 'yearly') return `${a.getFullYear()}`;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${a.toLocaleDateString('en-GB', opts)} – ${b.toLocaleDateString('en-GB', opts)}`;
}

interface ReportPeriodData {
  revenue: number;
  jobsCompleted: number;
  jobsByStatus: { status: string; count: number; value: string }[];
  totalHours: number;
  labourCost: number;
  netProfit: number;
  topCustomers: { name: string; jobs: number; revenue: string }[];
}

interface ReportApiResponse {
  date_from: string;
  date_to: string;
  prev_date_from: string;
  prev_date_to: string;
  current: ReportPeriodData;
  previous: ReportPeriodData;
}

export function AdminReportsPage({ companyId }: AdminReportsPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodFromUrl = (searchParams.get('period') || 'monthly') as ReportPeriod;
  const [period, setPeriod] = useState<ReportPeriod>(['weekly', 'monthly', 'yearly'].includes(periodFromUrl) ? periodFromUrl : 'monthly');
  const [companyName, setCompanyName] = useState<string>('');
  const [reportData, setReportData] = useState<ReportApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const range = getPeriodRange(period);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('cleaning_app_report_last_viewed', new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      fetch(apiUrl('/api/companies'), { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => r.json())
        .then((c: any) => setCompanyName(c?.name || 'Company'))
        .finally(() => setLoading(false));
    });
  }, [companyId]);

  const fetchReport = useCallback(async () => {
    if (!companyId) return;
    setReportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        apiUrl(`/api/admin/report?date_from=${encodeURIComponent(range.from)}&date_to=${encodeURIComponent(range.to)}`),
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        setReportData(null);
      }
    } catch {
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  }, [companyId, range.from, range.to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    const p = searchParams.get('period') as ReportPeriod | null;
    if (p && p !== period && ['weekly', 'monthly', 'yearly'].includes(p)) setPeriod(p);
  }, [searchParams]);

  const setPeriodAndUrl = (p: ReportPeriod) => {
    setPeriod(p);
    setSearchParams({ period: p });
  };

  const generatedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const cur = reportData?.current;
  const prev = reportData?.previous;
  const pct = (curr: number, prevVal: number) => (prevVal === 0 ? (curr === 0 ? 0 : 100) : Math.round(((curr - prevVal) / prevVal) * 100));

  const handleExportPdf = () => {
    setExportingPdf(true);
    try {
      window.print();
    } finally {
      setTimeout(() => setExportingPdf(false), 600);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-black text-2xl uppercase tracking-tight text-slate-50 flex items-center gap-2">
            <BarChart2 size={28} className="text-emerald-400" />
            Reports
          </h1>
          <div className="w-10" />
        </div>

        <p className="text-slate-400 text-sm mb-6">Business report by period. All figures from your jobs and payroll.</p>

        <div className="flex gap-2 mb-8">
          {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodAndUrl(p)}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                period === p ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>

        {reportLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-emerald-400" size={36} />
          </div>
        ) : (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 sm:p-8 border-b border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Business Report</p>
                  <h2 className="text-xl font-black text-slate-50">{companyName || 'Your Company'}</h2>
                  <p className="text-emerald-400 font-semibold mt-1">{getPeriodLabel(period)} Report</p>
                  <p className="text-slate-500 text-sm mt-2 flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatDateRange(range.from, range.to, period)}
                  </p>
                  <p className="text-slate-600 text-xs mt-1">Generated {generatedAt}</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                >
                  {exportingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Export PDF
                </button>
              </div>
            </div>

            {cur && prev && (
              <>
                <div className="p-6 sm:p-8 border-b border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Executive Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <DollarSign size={16} />
                        <span className="text-xs font-bold uppercase">Revenue</span>
                      </div>
                      <p className="text-xl font-black text-emerald-400">£{cur.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs mt-1 flex items-center gap-1">
                        {pct(cur.revenue, prev.revenue) >= 0 ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-rose-400" />}
                        <span className={pct(cur.revenue, prev.revenue) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {pct(cur.revenue, prev.revenue)}% vs previous {period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'year'}
                        </span>
                      </p>
                    </div>
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Briefcase size={16} />
                        <span className="text-xs font-bold uppercase">Jobs completed</span>
                      </div>
                      <p className="text-xl font-black text-slate-50">{cur.jobsCompleted}</p>
                      <p className="text-xs mt-1 text-slate-500">{pct(cur.jobsCompleted, prev.jobsCompleted)}% vs previous period</p>
                    </div>
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Users size={16} />
                        <span className="text-xs font-bold uppercase">Labour cost</span>
                      </div>
                      <p className="text-xl font-black text-amber-400">£{cur.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs mt-1 text-slate-500">vs £{prev.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })} previous</p>
                    </div>
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <TrendingUp size={16} />
                        <span className="text-xs font-bold uppercase">Net profit</span>
                      </div>
                      <p className="text-xl font-black text-emerald-300">£{cur.netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs mt-1 text-emerald-400/80">{pct(cur.netProfit, prev.netProfit)}% vs previous period</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 border-b border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Period comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-2 text-slate-400 font-bold uppercase tracking-wider">Metric</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-bold uppercase tracking-wider">This period</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-bold uppercase tracking-wider">Previous</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-bold uppercase tracking-wider">Change</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        <tr className="border-b border-slate-800/80">
                          <td className="py-2.5 px-2">Revenue</td>
                          <td className="text-right">£{cur.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right">£{prev.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right text-emerald-400">{pct(cur.revenue, prev.revenue) >= 0 ? '+' : ''}{pct(cur.revenue, prev.revenue)}%</td>
                        </tr>
                        <tr className="border-b border-slate-800/80">
                          <td className="py-2.5 px-2">Jobs completed</td>
                          <td className="text-right">{cur.jobsCompleted}</td>
                          <td className="text-right">{prev.jobsCompleted}</td>
                          <td className="text-right text-emerald-400">{pct(cur.jobsCompleted, prev.jobsCompleted) >= 0 ? '+' : ''}{pct(cur.jobsCompleted, prev.jobsCompleted)}%</td>
                        </tr>
                        <tr className="border-b border-slate-800/80">
                          <td className="py-2.5 px-2">Total hours</td>
                          <td className="text-right">{cur.totalHours.toFixed(1)} h</td>
                          <td className="text-right">{prev.totalHours.toFixed(1)} h</td>
                          <td className="text-right text-slate-400">{pct(cur.totalHours, prev.totalHours) >= 0 ? '+' : ''}{pct(cur.totalHours, prev.totalHours)}%</td>
                        </tr>
                        <tr className="border-b border-slate-800/80">
                          <td className="py-2.5 px-2">Labour cost</td>
                          <td className="text-right">£{cur.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right">£{prev.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right text-amber-400">{pct(cur.labourCost, prev.labourCost) >= 0 ? '+' : ''}{pct(cur.labourCost, prev.labourCost)}%</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-2">Net profit</td>
                          <td className="text-right font-semibold">£{cur.netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right">£{prev.netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right text-emerald-400">{pct(cur.netProfit, prev.netProfit) >= 0 ? '+' : ''}{pct(cur.netProfit, prev.netProfit)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-6 sm:p-8 border-b border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Jobs by status</h3>
                  <div className="space-y-2">
                    {(cur.jobsByStatus || []).map((row) => (
                      <div key={row.status} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="font-medium text-slate-200">{row.status}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-slate-400">{row.count} jobs</span>
                          <span className="text-emerald-400/90 font-semibold">{row.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 sm:p-8 border-b border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Top customers (by revenue)</h3>
                  {(cur.topCustomers && cur.topCustomers.length > 0) ? (
                    <div className="space-y-2">
                      {cur.topCustomers.map((c, i) => (
                        <div key={c.name + i} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-950/60 border border-slate-800">
                          <span className="text-slate-300 font-medium">#{i + 1} {c.name}</span>
                          <div className="flex items-center gap-6">
                            <span className="text-slate-400">{c.jobs} jobs</span>
                            <span className="text-emerald-400 font-semibold">{c.revenue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm py-4">No completed jobs in this period.</p>
                  )}
                </div>

                <div className="p-6 sm:p-8">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Payroll summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Clock size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total hours (period)</p>
                        <p className="text-lg font-black text-slate-50">{cur.totalHours.toFixed(1)} h</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                        <DollarSign size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total pay (period)</p>
                        <p className="text-lg font-black text-slate-50">£{cur.labourCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!reportLoading && !reportData && (
              <div className="p-8 text-center text-slate-500">
                <p>Could not load report. Try again later.</p>
              </div>
            )}

            <div className="px-6 sm:px-8 py-4 bg-slate-950/80 border-t border-slate-800">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">
                CleanPro Business Report · {getPeriodLabel(period)}
              </p>
            </div>
          </div>
        )}
      </div>
      <AdminBottomNav />
    </div>
  );
}

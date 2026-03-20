import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Plus, Loader2, FileText, Briefcase, Search } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';
import { HelpLink } from '../components/HelpLink';
import { HelpAnchor } from '../config/helpAnchors';
import { useToast } from '../context/ToastContext';

interface AdminQuotesPageProps {
  companyId: string | null;
}

const SERVICE_OPTIONS = [
  'House cleaning',
  'Office cleaning',
  'Deep clean',
  'End of tenancy',
  'Carpet cleaning',
  'Window cleaning',
  'Other',
];

export function AdminQuotesPage({ companyId }: AdminQuotesPageProps) {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const toast = useToast();

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) (h as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  const fetchQuotes = async () => {
    if (!companyId) return;
    setLoading(true);
    setPage(1);
    const h = await getAuthHeaders();
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('page', '1');
      params.set('page_size', '50');
      const res = await fetch(apiUrl(`/api/admin/quotes?${params.toString()}`), { headers: h });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setQuotes(list);
      setHasMorePages(list.length === 50);
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [companyId, statusFilter]);

  const loadMoreQuotes = async () => {
    if (!companyId || !hasMorePages) return;
    const h = await getAuthHeaders();
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('page', String(nextPage));
      params.set('page_size', '50');
      const res = await fetch(apiUrl(`/api/admin/quotes?${params.toString()}`), { headers: h });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        setQuotes(prev => [...prev, ...list]);
        setPage(nextPage);
        setHasMorePages(list.length === 50);
      } else {
        setHasMorePages(false);
      }
    } catch {
      // ignore for now
    }
  };

  const previewPdf = async (id: string, quoteNumber: string) => {
    const h = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/admin/quotes/${id}/pdf`), { headers: h });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote-${quoteNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendQuote = async (id: string) => {
    setSending(id);
    const h = await getAuthHeaders();
    try {
      const res = await fetch(apiUrl(`/api/admin/quotes/${id}/send`), { method: 'POST', headers: h });
      if (res.ok) {
        const data = await res.json();
        setQuotes(prev => prev.map(q => q.id === id ? data : q));
        toast.success('Quote sent.');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error ?? 'Failed to send quote');
      }
    } catch {
      toast.error('Failed to send quote');
    }
    setSending(null);
  };

  const goToConvertJob = (quoteId: string) => {
    navigate(`/admin/jobs/new?fromQuote=${quoteId}`);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatCurrency = (n: number) => `£${Number(n).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-0">
      <PageHeader
        title="Quotes"
        subtitle="Create and manage quotes"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        variant="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HelpLink anchor={HelpAnchor.Quotes} />
            <button
              onClick={() => navigate('/admin/quotes/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Plus size={20} /> New quote
            </button>
          </div>
        }
      />

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-4 flex flex-wrap gap-4 items-end shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-200 mb-1">Search (customer name / quote number)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchQuotes()}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-50 placeholder:text-slate-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-700 rounded-xl px-4 py-2 bg-slate-950 text-slate-50">
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">From date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-700 rounded-xl px-4 py-2 bg-slate-950 text-slate-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">To date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-700 rounded-xl px-4 py-2 bg-slate-950 text-slate-50" />
          </div>
          <button onClick={fetchQuotes} className="px-4 py-2 bg-slate-900 text-slate-100 rounded-xl font-medium hover:bg-slate-800">Apply</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-12 text-center text-slate-300 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            No quotes found. Create your first quote to get started.
          </div>
        ) : (
          <>
            <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <ul className="divide-y divide-slate-100">
                {quotes.map((q) => {
                const cust = q.customer as any;
                return (
                  <li key={q.id} className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 last:border-b-0 hover:bg-slate-900">
                    <div>
                      <p className="font-bold text-slate-50">{q.quote_number} — {cust?.full_name ?? 'Customer'}</p>
                      <p className="text-slate-200 text-sm">{q.service_type} · {q.quantity} × £{Number(q.unit_price).toFixed(2)} = {formatCurrency(Number(q.total_price))}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Created {formatDate(q.created_at)}
                        {q.sent_at && ` · Sent ${formatDate(q.sent_at)}`}
                        {q.approved_at && ` · Approved ${formatDate(q.approved_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        q.status === 'draft'
                          ? 'bg-slate-900 text-slate-300 border border-slate-700'
                          : q.status === 'sent'
                          ? 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
                          : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'
                      }`}>
                        {q.status}
                      </span>
                      <button onClick={() => previewPdf(q.id, q.quote_number)} className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg" title="Preview PDF">
                        <FileText size={18} />
                      </button>
                      {q.status === 'draft' && (
                        <>
                          <button onClick={() => navigate(`/admin/quotes/${q.id}/edit`)} className="p-2 text-emerald-300 hover:bg-slate-800 rounded-lg text-sm font-semibold" title="Edit">Edit</button>
                          <button onClick={() => sendQuote(q.id)} disabled={!!sending} className="p-2 text-amber-200 hover:bg-amber-500/10 rounded-lg text-sm font-semibold" title="Send quote">
                            {sending === q.id ? <Loader2 size={18} className="animate-spin" /> : 'Send'}
                          </button>
                        </>
                      )}
                      {!q.job_id && (
                        <button onClick={() => goToConvertJob(q.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-400 text-slate-950 rounded-lg text-sm font-medium hover:bg-emerald-300">
                          <Briefcase size={16} />
                          Convert to Job
                        </button>
                      )}
                      {q.job_id && (
                        <span className="text-xs text-slate-400">Job created</span>
                      )}
                    </div>
                  </li>
                );
              })}
              </ul>
            </div>
            {hasMorePages && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={loadMoreQuotes}
                  className="px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-800 rounded-xl"
                >
                  Load more quotes
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <AdminBottomNav />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ListTodo,
  Search,
  Receipt,
  FileText,
} from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';

/** Job detail: list ALL jobs (one-off + recurring). Edit goes to Edit Detail page. */
interface AdminRecurringJobsPageProps {
  companyId: string | null;
}

interface JobRow {
  id: string;
  client_name: string;
  address: string | null;
  scheduled_at: string;
  status: string;
  recurring_job_id: string | null;
  staff_members: { id: string; name?: string; full_name?: string }[];
  invoice?: { id: string; invoice_number: string; status: string } | null;
  [key: string]: unknown;
}

export function AdminRecurringJobsPage({ companyId }: AdminRecurringJobsPageProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [completeJob, setCompleteJob] = useState<JobRow | null>(null);
  const [completeSaving, setCompleteSaving] = useState(false);
  const [addOnCarpet, setAddOnCarpet] = useState(false);
  const [addOnFridge, setAddOnFridge] = useState(false);

  const fetchList = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl('/api/jobs'), { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const staffNames = (job: JobRow) => {
    const members = job.staff_members || [];
    return members.map((s: any) => s.full_name || s.name || '—').filter(Boolean).join(', ') || '—';
  };

  const handleDelete = async (jobId: string, clientName: string) => {
    if (!window.confirm(`Delete this job (${clientName || 'Unnamed'})? This cannot be undone.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) fetchList();
      else alert('Failed to delete job.');
    } catch {
      alert('Failed to delete job.');
    }
  };

  const handleConfirmDoneAndInvoice = async () => {
    if (!completeJob) return;
    const customerId = (completeJob as any).customer_id;
    if (!customerId) {
      alert('This job has no linked customer. Please attach a customer on the job detail page first.');
      return;
    }
    setCompleteSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const basePrice = Number(completeJob.price) || 0;
      const lineItems: any[] = [];
      lineItems.push({
        description: 'Cleaning service',
        quantity: 1,
        unit_price: basePrice,
        amount: basePrice,
      });
      if (addOnCarpet) {
        lineItems.push({
          description: 'Carpet cleaning add-on',
          quantity: 1,
          unit_price: 20,
          amount: 20,
        });
      }
      if (addOnFridge) {
        lineItems.push({
          description: 'Fridge interior add-on',
          quantity: 1,
          unit_price: 15,
          amount: 15,
        });
      }

      const invRes = await fetch(apiUrl('/api/admin/invoices'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer_id: customerId,
          job_id: completeJob.id,
          line_items: lineItems,
        }),
      });
      if (!invRes.ok) {
        alert('Failed to create invoice.');
      } else {
        await fetch(apiUrl(`/api/jobs/complete/${completeJob.id}`), {
          method: 'POST',
          headers,
        }).catch(() => {});
        setCompleteJob(null);
        setAddOnCarpet(false);
        setAddOnFridge(false);
        fetchList();
      }
    } catch {
      alert('Failed to create invoice.');
    }
    setCompleteSaving(false);
  };

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? list.filter((row) => {
        const client = (row.client_name || '').toLowerCase();
        const addr = (row.address || '').toLowerCase();
        const status = (row.status || '').toLowerCase();
        const type = row.recurring_job_id ? 'recurring' : 'one-off';
        const staffStr = staffNames(row).toLowerCase();
        return (
          client.includes(searchLower) ||
          addr.includes(searchLower) ||
          status.includes(searchLower) ||
          type.includes(searchLower) ||
          staffStr.includes(searchLower)
        );
      })
    : list;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-0">
      <div className="bg-slate-950/90 border-b border-slate-800 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-900 rounded-xl text-slate-300">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="font-black text-2xl text-slate-50">Job detail</h1>
            <p className="text-slate-400 text-sm mt-1">All jobs — use search above; click the pencil to open Edit Detail.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/jobs/new')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-400 text-slate-950 rounded-xl font-semibold hover:bg-emerald-300"
        >
          <Plus size={20} /> Add New Job
        </button>
      </div>

      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, address, status, staff..."
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-12 text-center text-slate-300 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <ListTodo className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <p className="font-medium">{list.length === 0 ? 'No jobs yet' : 'No jobs match your search'}</p>
            <p className="text-sm mt-1">{list.length === 0 ? 'Add a job from Schedule or use Add New Job above.' : 'Try a different search term.'}</p>
            <button
              onClick={() => navigate('/admin/jobs/new')}
              className="mt-6 px-4 py-2 bg-emerald-400 text-slate-950 rounded-xl font-semibold hover:bg-emerald-300"
            >
              Add New Job
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-950/70 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Date & time</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Client</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Address</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Staff</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Invoice</th>
                    <th className="w-32 py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-900">
                      <td className="py-3 px-4 text-slate-200 text-sm whitespace-nowrap">{formatDateTime(row.scheduled_at)}</td>
                      <td className="py-3 px-4 font-medium text-slate-50">{row.client_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-200 text-sm max-w-[200px] truncate" title={row.address || ''}>{row.address || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          row.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          row.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' :
                          row.status === 'cancelled' ? 'bg-slate-500/20 text-slate-400' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200 text-sm">{row.recurring_job_id ? 'Recurring' : 'One-off'}</td>
                      <td className="py-3 px-4 text-slate-200 text-sm max-w-[160px] truncate" title={staffNames(row)}>{staffNames(row)}</td>
                      <td className="py-3 px-4">
                        {row.invoice ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/invoices?invoice=${row.invoice?.id}`)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                              row.invoice.status === 'paid'
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                : row.invoice.status === 'sent'
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25'
                                : 'bg-slate-500/15 border-slate-500/40 text-slate-300 hover:bg-slate-500/25'
                            }`}
                            title={row.invoice.invoice_number}
                          >
                            <Receipt size={12} />
                            {row.invoice.status === 'paid' ? 'Paid' : row.invoice.status === 'sent' ? 'Sent' : 'Draft'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2 py-1" title="No invoice">
                            <FileText size={12} /> —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {row.status !== 'completed' && (
                            <button
                              onClick={() => {
                                setCompleteJob(row);
                                setAddOnCarpet(false);
                                setAddOnFridge(false);
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                              title="Mark done & create invoice"
                            >
                              Done & Invoice
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/admin/jobs/new?fromJob=${row.id}`)}
                            className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg"
                            title="Edit detail"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(row.id, row.client_name)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                            title="Delete job"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {completeJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !completeSaving && setCompleteJob(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">Mark done & create invoice</h2>
            <p className="text-sm text-slate-600 mb-4">
              {completeJob.client_name || 'Job'} —{' '}
              {new Date(completeJob.scheduled_at).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </p>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span>Cleaning service</span>
                <span className="font-semibold">
                  £{(Number(completeJob.price) || 0).toFixed(2)}
                </span>
              </div>
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <div>
                  <span className="font-medium">Carpet cleaning add-on</span>
                  <p className="text-xs text-slate-500">Add carpet cleaning to this job</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">£20.00</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={addOnCarpet}
                    onChange={(e) => setAddOnCarpet(e.target.checked)}
                  />
                </div>
              </label>
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <div>
                  <span className="font-medium">Fridge interior add-on</span>
                  <p className="text-xs text-slate-500">Include fridge interior cleaning</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">£15.00</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={addOnFridge}
                    onChange={(e) => setAddOnFridge(e.target.checked)}
                  />
                </div>
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              This will mark the job as completed and create a draft invoice linked to this job.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                disabled={completeSaving}
                onClick={() => setCompleteJob(null)}
                className="flex-1 py-2 border border-slate-300 rounded-xl font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={completeSaving}
                onClick={handleConfirmDoneAndInvoice}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {completeSaving ? 'Saving…' : 'Done & Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
}

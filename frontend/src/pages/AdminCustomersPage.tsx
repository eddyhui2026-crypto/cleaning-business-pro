import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { CreditCard, Loader2, X, Plus, User } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';

interface AdminCustomersPageProps {
  companyId: string | null;
}

interface CustomerRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  welcome_email_sent_at: string | null;
}

const PAYMENT_METHODS = [
  { value: 'self_collect', label: 'Self-collect (cash / bank transfer)' },
  { value: 'payment_link', label: 'Send payment link' },
  { value: 'stripe_connect', label: 'Stripe Connect (future)' },
];

export function AdminCustomersPage({ companyId }: AdminCustomersPageProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCustomer, setModalCustomer] = useState<CustomerRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('self_collect');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', email: '', address: '', notes: '' });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!companyId) return;
    const fetchList = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch(apiUrl('/api/admin/customers'), { headers });
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [companyId]);

  const openPaymentModal = async (customer: CustomerRow) => {
    setModalCustomer(customer);
    setPaymentMethod('self_collect');
    setPaymentLinkUrl('');
    setInstructions('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/customers/${customer.id}/payment-settings`), {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.payment_method) setPaymentMethod(data.payment_method);
      if (data.payment_link_url) setPaymentLinkUrl(data.payment_link_url);
      if (data.instructions) setInstructions(data.instructions);
    } catch {}
  };

  const savePaymentSettings = async () => {
    if (!modalCustomer) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/customers/${modalCustomer.id}/payment-settings`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          payment_method: paymentMethod,
          payment_link_url: paymentLinkUrl || null,
          instructions: instructions || null,
        }),
      });
      if (res.ok) setModalCustomer(null);
    } catch {}
    setSaving(false);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.phone?.trim()) return;
    setSaving(true);
    setCreatedPassword(null);
    setAddError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAddError('Please log in as admin first.');
        setSaving(false);
        return;
      }
      const res = await fetch(apiUrl('/api/admin/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          full_name: addForm.full_name || 'Customer',
          phone: addForm.phone.trim(),
          email: addForm.email?.trim() || null,
          address: addForm.address?.trim() || null,
          notes: addForm.notes?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.customer) setList(prev => [data.customer, ...prev]);
        if (data.temporary_password) setCreatedPassword(data.temporary_password);
        else setAddOpen(false);
      } else {
        setAddError((data as any).error || 'Failed to add customer.');
      }
    } catch (e: any) {
      setAddError(e?.message || 'Network error.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-0">
      <PageHeader
        title="Customers (CRM)"
        subtitle="Client profiles, notes, bookings, invoices and payments"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        action={
          <button onClick={() => { setAddOpen(true); setCreatedPassword(null); setAddError(null); setAddForm({ full_name: '', phone: '', email: '', address: '', notes: '' }); }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            <Plus size={18} /> Add customer
          </button>
        }
        variant="dark"
      />
      <div className="p-4 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
        ) : list.length === 0 ? (
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-12 text-center text-slate-300 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <p>No customers yet. Add a customer above or add a client phone when creating a job.</p>
            <button onClick={() => { setAddOpen(true); setAddError(null); }} className="mt-4 px-4 py-2 bg-emerald-400 text-slate-950 rounded-xl font-medium hover:bg-emerald-300">Add customer</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-3 mb-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, email or address..."
                className="w-full md:w-72 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 rounded-2xl border border-white/10 bg-slate-900/80 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead className="bg-slate-950/70 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Address</th>
                    <th className="w-40 py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {list
                    .filter((row) => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      return (
                        row.full_name?.toLowerCase().includes(q) ||
                        row.phone?.toLowerCase().includes(q) ||
                        (row.email ?? '').toLowerCase().includes(q) ||
                        (row.address ?? '').toLowerCase().includes(q)
                      );
                    })
                    .map((row) => (
                      <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-900">
                        <td className="py-3 px-4 font-medium text-slate-50">{row.full_name}</td>
                        <td className="py-3 px-4 text-slate-300">{row.phone}</td>
                        <td className="py-3 px-4 text-slate-400">{row.email ?? '—'}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{row.address ?? '—'}</td>
                        <td className="py-3 px-4 flex gap-2">
                          <button
                            onClick={() => navigate(`/admin/customers/${row.id}`)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-900 rounded-lg border border-slate-700"
                          >
                            <User size={16} /> View
                          </button>
                          <button
                            onClick={() => openPaymentModal(row)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-slate-900 rounded-lg border border-emerald-400/40"
                          >
                            <CreditCard size={16} /> Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => { setAddOpen(false); setCreatedPassword(null); }}>
          <div className="bg-slate-950 rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,1)] max-w-md w-full p-6 border border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Add customer</h2>
              <button onClick={() => { setAddOpen(false); setCreatedPassword(null); }} className="p-2 text-slate-500 hover:bg-slate-900 rounded-lg"><X size={20} /></button>
            </div>
            {createdPassword ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-400/40 rounded-xl mb-4">
                <p className="font-medium text-emerald-100">Customer created. Default password (share with customer):</p>
                <p className="mt-2 font-mono text-lg font-bold text-emerald-300">12345678</p>
                <p className="text-sm text-emerald-100 mt-2">They can log in at <strong>Customer login</strong> with their phone number and this password, then change it if they wish.</p>
                <button onClick={() => { setAddOpen(false); setCreatedPassword(null); }} className="mt-4 px-4 py-2 bg-emerald-400 text-slate-950 rounded-xl font-medium hover:bg-emerald-300">Done</button>
              </div>
            ) : (
              <form onSubmit={handleAddCustomer} className="space-y-4">
                {addError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-100 text-sm" role="alert">{addError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Full name *</label>
                  <input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Phone <span className="text-red-400">*</span></label>
                  <input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500" placeholder="07XXXXXXXX" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
                  <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500" placeholder="customer@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Address</label>
                  <input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500" placeholder="Full address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Notes</label>
                  <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-700 bg-slate-900 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500" placeholder="Internal notes" />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setAddOpen(false)} className="flex-1 py-2 border border-slate-700 rounded-xl font-medium text-slate-200 hover:bg-slate-900">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2 bg-emerald-400 text-slate-950 rounded-xl font-medium hover:bg-emerald-300 disabled:opacity-50">Create</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {modalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setModalCustomer(null)}>
          <div className="bg-slate-950 rounded-2xl shadow-[0_24px_80px_rgba(15,23,42,1)] max-w-md w-full p-6 border border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Payment — {modalCustomer.full_name}</h2>
              <button onClick={() => setModalCustomer(null)} className="p-2 text-slate-500 hover:bg-slate-900 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-700 bg-slate-900 rounded-xl px-3 py-2 text-slate-50"
                >
                  {PAYMENT_METHODS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {paymentMethod === 'payment_link' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Payment link URL</label>
                  <input
                    type="url"
                    value={paymentLinkUrl}
                    onChange={(e) => setPaymentLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-slate-700 bg-slate-900 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Instructions (optional)</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-700 bg-slate-900 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500"
                  placeholder="Custom message for customer"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalCustomer(null)} className="flex-1 py-2 border border-slate-700 rounded-xl font-medium text-slate-200 hover:bg-slate-900">Cancel</button>
              <button onClick={savePaymentSettings} disabled={saving} className="flex-1 py-2 bg-emerald-400 text-slate-950 rounded-xl font-medium hover:bg-emerald-300 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNav />
    </div>
  );
}

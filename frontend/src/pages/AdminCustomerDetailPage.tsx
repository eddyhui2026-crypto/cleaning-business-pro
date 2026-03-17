import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { formatDateUK } from '../lib/dateFormat';
import { ChevronLeft, FileText, Calendar, Receipt, CreditCard, MessageSquare, Loader2, Plus, X, FileCheck } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';

interface AdminCustomerDetailPageProps {
  companyId: string | null;
}

type Tab = 'profile' | 'notes' | 'bookings' | 'quotes' | 'invoices' | 'payments';

export function AdminCustomerDetailPage({ companyId }: AdminCustomerDetailPageProps) {
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '', address: '', notes: '' });
  const [newNote, setNewNote] = useState('');
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('self_collect');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [instructions, setInstructions] = useState('');

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) (h as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  useEffect(() => {
    if (!companyId || !customerId) return;
    (async () => {
      setLoading(true);
      const h = await getAuthHeaders();
      try {
        const [custRes, notesRes, bookRes, quotesRes, invRes, payRes] = await Promise.all([
          fetch(apiUrl(`/api/admin/customers/${customerId}`), { headers: h }),
          fetch(apiUrl(`/api/admin/customers/${customerId}/notes`), { headers: h }),
          fetch(apiUrl(`/api/admin/customers/${customerId}/bookings`), { headers: h }),
          fetch(apiUrl(`/api/admin/customers/${customerId}/quotes`), { headers: h }),
          fetch(apiUrl(`/api/admin/customers/${customerId}/invoices`), { headers: h }),
          fetch(apiUrl(`/api/admin/customers/${customerId}/payments`), { headers: h }),
        ]);
        const custData = await custRes.json();
        if (custRes.ok && custData.id) {
          setCustomer(custData);
          setEditForm({
            full_name: custData.full_name ?? '',
            phone: custData.phone ?? '',
            email: custData.email ?? '',
            address: custData.address ?? '',
            notes: custData.notes ?? '',
          });
        }
        setNotes(await notesRes.json().then(d => Array.isArray(d) ? d : []));
        setBookings(await bookRes.json().then(d => Array.isArray(d) ? d : []));
        setQuotes(await quotesRes.json().then(d => Array.isArray(d) ? d : []));
        setInvoices(await invRes.json().then(d => Array.isArray(d) ? d : []));
        setPayments(await payRes.json().then(d => Array.isArray(d) ? d : []));
      } catch {
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, customerId]);

  const fetchPayments = async () => {
    if (!customerId) return;
    const h = await getAuthHeaders();
    const data = await fetch(apiUrl(`/api/admin/customers/${customerId}/payments`), { headers: h }).then(r => r.json());
    setPayments(Array.isArray(data) ? data : []);
  };

  const handleSaveProfile = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/admin/customers/${customerId}`), {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer((prev: any) => ({ ...prev, ...data }));
      }
    } catch {}
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !customerId) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/admin/customers/${customerId}/notes`), {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(prev => [data, ...prev]);
        setNewNote('');
      }
    } catch {}
    setSaving(false);
  };

  const openPaymentSettings = async () => {
    setPaymentModal(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/admin/customers/${customerId}/payment-settings`), { headers: h });
      const data = await res.json();
      setPaymentMethod(data.payment_method ?? 'self_collect');
      setPaymentLinkUrl(data.payment_link_url ?? '');
      setInstructions(data.instructions ?? '');
    } catch {}
  };

  const savePaymentSettings = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      await fetch(apiUrl(`/api/admin/customers/${customerId}/payment-settings`), {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ payment_method: paymentMethod, payment_link_url: paymentLinkUrl || null, instructions: instructions || null }),
      });
      setPaymentModal(false);
    } catch {}
    setSaving(false);
  };

  if (loading && !customer) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-50">
        <button
          onClick={() => navigate('/admin/customers')}
          className="text-emerald-300 font-medium hover:text-emerald-200"
        >
          ← Back to customers
        </button>
        <p className="mt-4 text-slate-400">Customer not found.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: FileText },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'quotes', label: 'Quotes', icon: FileCheck },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-0">
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/customers')}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-300"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="font-black text-2xl text-slate-50">{customer.full_name}</h1>
            <p className="text-slate-400 text-sm">
              {customer.phone} {customer.email ? ` · ${customer.email}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={openPaymentSettings}
          className="flex items-center gap-2 px-4 py-2 border border-emerald-400/40 rounded-xl font-medium text-emerald-300 hover:bg-slate-800"
        >
          <CreditCard size={18} /> Payment method
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex gap-2 border-b border-slate-800 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-medium whitespace-nowrap ${
                tab === t.id
                  ? 'bg-slate-900 border border-b-0 border-slate-700 text-emerald-300'
                  : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Full name</label>
              <input
                value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Phone</label>
              <input
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Address</label>
              <input
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-2 bg-emerald-500 text-slate-950 rounded-xl font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}

        {tab === 'notes' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="p-4 border-b border-slate-800 flex gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add internal note..."
                rows={2}
                className="flex-1 border border-slate-700 bg-slate-950 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500"
              />
              <button
                onClick={handleAddNote}
                disabled={saving}
                className="self-end px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-medium hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1"
              >
                <Plus size={18} /> Add
              </button>
            </div>
            <ul>
              {notes.length === 0 ? <li className="p-4 text-slate-500 text-sm">No notes yet.</li> : notes.map((n) => (
                <li key={n.id} className="p-4 border-b border-slate-800 last:border-0">
                  <p className="text-slate-100">{n.content}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}{' '}
                    {n.created_by_name ? `· ${n.created_by_name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'bookings' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            {bookings.length === 0 ? <p className="p-4 text-slate-500">No bookings.</p> : (
              <ul>
                {bookings.map((b) => (
                  <li key={b.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between">
                    <span className="text-slate-100">
                      {formatDateUK(b.preferred_date)} — {b.service_type?.replace(/_/g, ' ')} ({b.status})
                    </span>
                    <span className="text-slate-400 text-sm">{b.payment_status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'quotes' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="p-4 border-b border-slate-800">
              <button
                onClick={() => navigate(`/admin/quotes/new?customer=${customerId}`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-medium hover:bg-emerald-400"
              >
                <Plus size={18} /> New quote
              </button>
            </div>
            {quotes.length === 0 ? <p className="p-4 text-slate-500">No quotes yet.</p> : (
              <ul>
                {quotes.map((q) => (
                  <li key={q.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between items-center">
                    <span className="text-slate-100">
                      {q.quote_number} — {q.service_type} · £{Number(q.total_price).toFixed(2)} ({q.status})
                    </span>
                    <button
                      onClick={() => navigate(`/admin/quotes`)}
                      className="text-emerald-300 text-sm font-medium hover:text-emerald-200"
                    >
                      View all quotes
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <div className="p-4 border-b border-slate-800">
              <button
                onClick={() => navigate(`/admin/invoices?new=${customerId}`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-medium hover:bg-emerald-400"
              >
                <Plus size={18} /> Create invoice
              </button>
            </div>
            {invoices.length === 0 ? <p className="p-4 text-slate-500">No invoices.</p> : (
              <ul>
                {invoices.map((inv) => (
                  <li key={inv.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between items-center">
                    <span className="text-slate-100">
                      {inv.invoice_number} — {inv.currency} {Number(inv.total).toFixed(2)} ({inv.status})
                    </span>
                    <button
                      onClick={() => navigate(`/admin/invoices`)}
                      className="text-emerald-300 text-sm font-medium hover:text-emerald-200"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'payments' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            {payments.length === 0 ? <p className="p-4 text-slate-500">No payment records.</p> : (
              <ul>
                {payments.map((p) => (
                  <li key={p.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between">
                    <span className="text-slate-100">
                      £{Number(p.amount).toFixed(2)} — {p.method} ({p.status})
                    </span>
                    <span className="text-slate-400 text-sm">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {paymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPaymentModal(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl shadow-[0_22px_60px_rgba(15,23,42,0.95)] max-w-md w-full p-6 border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Payment method</h2>
              <button
                onClick={() => setPaymentModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-slate-50"
                >
                  <option value="self_collect">Self-collect (cash / bank transfer)</option>
                  <option value="payment_link">Send payment link</option>
                  <option value="stripe_connect">Stripe Connect (future)</option>
                </select>
              </div>
              {paymentMethod === 'payment_link' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Payment link URL</label>
                  <input
                    type="url"
                    value={paymentLinkUrl}
                    onChange={e => setPaymentLinkUrl(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500"
                    placeholder="https://..."
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Instructions (optional)
                </label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPaymentModal(false)}
                className="flex-1 py-2 border border-slate-700 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={savePaymentSettings}
                disabled={saving}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-medium hover:bg-emerald-400 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNav />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth, customerAuthHeaders } from '../context/CustomerAuthContext';
import { apiUrl } from '../lib/api';
import { formatDateUK } from '../lib/dateFormat';
import {
  LogOut,
  Calendar,
  FileText,
  CreditCard,
  BookOpen,
  Loader2,
  Image as ImageIcon,
  ChevronRight,
  Receipt,
  Download,
  FileCheck,
  CheckCircle,
  Lock,
  Bell,
} from 'lucide-react';
import { enablePushCustomer } from '../lib/pushNotifications';

export function CustomerDashboard() {
  const navigate = useNavigate();
  const { token, customer, logout, companyId } = useCustomerAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [paymentInstruction, setPaymentInstruction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const fetchData = () => {
    if (!token) return;
    const headers = customerAuthHeaders(token);
    Promise.all([
      fetch(apiUrl('/api/customer/jobs'), { headers }).then((r) => r.json()),
      fetch(apiUrl('/api/customer/bookings'), { headers }).then((r) => r.json()),
      fetch(apiUrl('/api/customer/invoices'), { headers }).then((r) => r.json()),
      fetch(apiUrl('/api/customer/quotes'), { headers }).then((r) => r.json()),
      fetch(apiUrl('/api/customer/payment-instruction'), { headers }).then((r) => r.json()),
    ])
      .then(([jobsData, bookingsData, invoicesData, quotesData, paymentData]) => {
        setJobs(Array.isArray(jobsData) ? jobsData : []);
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
        setPaymentInstruction(paymentData?.instruction ? paymentData : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      navigate('/customer/login');
      return;
    }
    fetchData();
  }, [token, navigate]);

  const downloadInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/customer/invoices/${invoiceId}/pdf`), { headers: customerAuthHeaders(token) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const approveQuote = async (quoteId: string) => {
    if (!token) return;
    setApprovingId(quoteId);
    try {
      const res = await fetch(apiUrl(`/api/customer/quotes/${quoteId}/approve`), {
        method: 'POST',
        headers: customerAuthHeaders(token),
        body: JSON.stringify({}),
      });
      if (res.ok) fetchData();
    } catch {}
    setApprovingId(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New password and confirm do not match.');
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (!token) return;
    setPasswordSaving(true);
    try {
      const res = await fetch(apiUrl('/api/customer/me/password'), {
        method: 'PATCH',
        headers: customerAuthHeaders(token),
        body: JSON.stringify({ current_password: passwordForm.current, new_password: passwordForm.new }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPasswordSuccess(true);
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        setPasswordError((data as any).error || 'Failed to update password.');
      }
    } catch (e: any) {
      setPasswordError(e?.message || 'Network error.');
    }
    setPasswordSaving(false);
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-50">My Account</h1>
          <p className="text-slate-400 text-sm">{customer.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!token) return;
              setPushLoading(true);
              setPushMessage(null);
              const result = await enablePushCustomer(token);
              setPushMessage(result.ok ? 'Notifications enabled' : (result.error || 'Failed'));
              setPushLoading(false);
            }}
            disabled={pushLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 text-sm font-medium disabled:opacity-50"
            title="Enable push notifications"
          >
            <Bell size={18} />
            {pushLoading ? <Loader2 size={16} className="animate-spin" /> : 'Notifications'}
          </button>
          {pushMessage && (
            <span className={`text-xs ${pushMessage === 'Notifications enabled' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {pushMessage}
            </span>
          )}
          <button
            onClick={() => { logout(); navigate('/customer/login'); }}
            className="flex items-center gap-2 text-slate-300 hover:text-red-400 font-medium text-sm px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/customer/book')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-400 text-slate-950 font-black hover:bg-emerald-300 shadow-lg shadow-emerald-500/40"
        >
          <BookOpen size={24} />
          <span>New Booking</span>
          <ChevronRight className="ml-auto" size={20} />
        </button>

        {/* Change password — 只在 localStorage 未標記為已改密碼時顯示 */}
        {!localStorage.getItem(`customer_pw_changed_${customer.id}`) && (
          <section className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <h2 className="flex items-center gap-2 font-bold text-slate-50 p-4 border-b border-slate-800">
              <Lock size={20} /> Change password
            </h2>
            <div className="p-4">
              {passwordSuccess && (
                <p className="p-3 rounded-xl bg-emerald-500/10 text-emerald-200 border border-emerald-500/40 text-sm mb-4">
                  Password updated. Use your new password next time you log in.
                </p>
              )}
              <form
                onSubmit={async (e) => {
                  await handleChangePassword(e);
                  // 如果成功（有 success flag），標記只需改一次
                  if (!passwordError) {
                    try {
                      localStorage.setItem(`customer_pw_changed_${customer.id}`, 'true');
                    } catch {}
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Current password</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                    placeholder="Current password"
                    className="w-full border border-slate-800 rounded-xl px-4 py-2 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">New password</label>
                  <input
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
                    placeholder="At least 6 characters"
                    className="w-full border border-slate-800 rounded-xl px-4 py-2 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Confirm new password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                    placeholder="Confirm new password"
                    className="w-full border border-slate-800 rounded-xl px-4 py-2 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    required
                  />
                </div>
                {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full py-2 rounded-xl bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
                >
                  {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update password
                </button>
              </form>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            {/* Payment instruction (dummy) */}
            {paymentInstruction && (
              <section className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
                <h2 className="flex items-center gap-2 font-bold text-slate-50 mb-2">
                  <CreditCard size={20} /> Payment
                </h2>
                <p className="text-slate-400 text-sm">{paymentInstruction.instruction}</p>
                {paymentInstruction.is_dummy && (
                  <p className="text-xs text-amber-300 mt-2">(Dummy instruction – no real payment required for MVP)</p>
                )}
              </section>
            )}

            {/* Quotes */}
            <section className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <h2 className="flex items-center gap-2 font-bold text-slate-50 p-4 border-b border-slate-800">
                <FileCheck size={20} /> Quotes
              </h2>
              {quotes.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No quotes sent to you yet.</p>
              ) : (
                <ul>
                  {quotes.map((q) => (
                    <li key={q.id} className="p-4 border-b border-slate-800 last:border-0 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-50">{q.quote_number} — {q.service_type}</p>
                        <p className="text-sm text-slate-400">£{Number(q.total_price).toFixed(2)} · {q.status}</p>
                      </div>
                      {q.status === 'sent' && (
                        <button
                          onClick={() => approveQuote(q.id)}
                          disabled={!!approvingId}
                          className="flex items-center gap-1 px-4 py-2 bg-emerald-400 text-slate-950 rounded-xl text-sm font-medium hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/40"
                        >
                          {approvingId === q.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          Approve
                        </button>
                      )}
                      {q.status === 'approved' && (
                        <span className="text-sm text-emerald-300 font-medium">Approved</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Invoices */}
            <section className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <h2 className="flex items-center gap-2 font-bold text-slate-50 p-4 border-b border-slate-800">
                <Receipt size={20} /> Invoices
              </h2>
              {invoices.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No invoices yet.</p>
              ) : (
                <ul>
                  {invoices.map((inv) => (
                    <li key={inv.id} className="p-4 border-b border-slate-800 last:border-0 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-50">{inv.invoice_number}</p>
                        <p className="text-sm text-slate-400">{inv.currency} {Number(inv.total).toFixed(2)} — {inv.status}</p>
                      </div>
                      <button
                        onClick={() => downloadInvoicePdf(inv.id, inv.invoice_number)}
                        className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 hover:underline text-sm font-medium"
                      >
                        <Download size={16} /> PDF
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Bookings */}
            <section className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <h2 className="flex items-center gap-2 font-bold text-slate-50 p-4 border-b border-slate-800">
                <Calendar size={20} /> Upcoming & recent bookings
              </h2>
              {bookings.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No bookings yet.</p>
              ) : (
                <ul>
                  {bookings.slice(0, 10).map((b) => (
                    <li
                      key={b.id}
                      className="p-4 border-b border-slate-800 last:border-0 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-50">{formatDateUK(b.preferred_date)} — {b.service_type?.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-slate-400">Status: {b.status}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-500" />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Completed jobs / reports */}
            <section className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <h2 className="flex items-center gap-2 font-bold text-slate-50 p-4 border-b border-slate-800">
                <FileText size={20} /> Job history & reports
              </h2>
              {jobs.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No completed jobs yet.</p>
              ) : (
                <ul>
                  {jobs.slice(0, 10).map((j) => (
                    <li
                      key={j.id}
                      className="p-4 border-b border-slate-800 last:border-0"
                    >
                      <p className="font-medium text-slate-50">{j.client_name}</p>
                      <p className="text-sm text-slate-400">
                        {j.scheduled_at ? formatDateUK(j.scheduled_at) : ''} — {j.status}
                      </p>
                      {(j.before_photos?.length > 0 || j.after_photos?.length > 0) && (
                        <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
                          <ImageIcon size={14} /> Photos available
                        </p>
                      )}
                      {j.share_token && (
                        <a
                          href={`/report/${j.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-300 hover:text-emerald-200 hover:underline mt-1 inline-block"
                        >
                          View report →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Plus, Loader2, Download, Send, Receipt, X, Search } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';
import { HelpLink } from '../components/HelpLink';
import { HelpAnchor } from '../config/helpAnchors';
import { useToast } from '../context/ToastContext';

interface AdminInvoicesPageProps {
  companyId: string | null;
}

interface LineItem { description: string; quantity: number; unit_price: number; amount: number; }

interface CompanySettings {
  id: string;
  default_payment_method?: string | null;
  default_payment_instructions?: string | null;
  default_payment_terms_days?: number | null;
  invoice_number_prefix?: string | null;
}

export function AdminInvoicesPage({ companyId }: AdminInvoicesPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const newCustomerId = searchParams.get('new');
  const highlightInvoiceId = searchParams.get('invoice');
  const openPaymentSettings = searchParams.get('open') === 'payment-settings';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(!!newCustomerId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(openPaymentSettings);
  const [saving, setSaving] = useState(false);
  const [createCustomerId, setCreateCustomerId] = useState(newCustomerId || '');
  const [createLineItems, setCreateLineItems] = useState<LineItem[]>([{ description: 'Cleaning service', quantity: 1, unit_price: 0, amount: 0 }]);
  const [createDueAt, setCreateDueAt] = useState(new Date().toISOString().slice(0, 10));
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payReference, setPayReference] = useState('');
  const [defaultMethodDraft, setDefaultMethodDraft] = useState<string>('cash');
  const [defaultInstructionsDraft, setDefaultInstructionsDraft] = useState<string>('');
  const [defaultTermsDraft, setDefaultTermsDraft] = useState<string>('');
  const [invoicePrefixDraft, setInvoicePrefixDraft] = useState<string>('');
  const [catalogServices, setCatalogServices] = useState<{ id: string; name: string; base_price: number | null }[]>([]);
  const [createUseTotalOnly, setCreateUseTotalOnly] = useState(false);
  const [createTotalAmount, setCreateTotalAmount] = useState('');
  const toast = useToast();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);
  const [sendIncludePhotos, setSendIncludePhotos] = useState(false);
  const LIST_LIMIT_DEFAULT = 20;
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [hasMoreInvoicePages, setHasMoreInvoicePages] = useState(true);
  const [hasMorePaymentPages, setHasMorePaymentPages] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceLimit, setInvoiceLimit] = useState(LIST_LIMIT_DEFAULT);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentLimit, setPaymentLimit] = useState(LIST_LIMIT_DEFAULT);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) (h as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      setInvoicePage(1);
      setPaymentPage(1);
      const h = await getAuthHeaders();
      try {
        const [invRes, custRes, payRes, companyRes] = await Promise.all([
          fetch(apiUrl('/api/admin/invoices?page=1&page_size=50'), { headers: h }),
          fetch(apiUrl('/api/admin/customers'), { headers: h }),
          fetch(apiUrl('/api/admin/invoices/payments?page=1&page_size=50'), { headers: h }),
          fetch(apiUrl('/api/companies'), { headers: h }),
        ]);
        const invData = await invRes.json().then(d => Array.isArray(d) ? d : []);
        const payData = await payRes.json().then(d => Array.isArray(d) ? d : []);
        setInvoices(invData);
        setCustomers(await custRes.json().then(d => Array.isArray(d) ? d : []));
        setPayments(payData);
        setHasMoreInvoicePages(invData.length === 50);
        setHasMorePaymentPages(payData.length === 50);
        const companyData = await companyRes.json().then(d => (d && d.id ? d : null));
        if (companyData) {
          setCompany(companyData);
          const method = (companyData as any).default_payment_method || 'cash';
          setPayMethod(method);
          setDefaultMethodDraft(method);
          setDefaultInstructionsDraft((companyData as any).default_payment_instructions || '');
          setInvoicePrefixDraft((companyData as any).invoice_number_prefix || '');
          const termsDaysRaw = (companyData as any).default_payment_terms_days;
          const termsDays =
            termsDaysRaw != null && !Number.isNaN(Number(termsDaysRaw)) ? Number(termsDaysRaw) : null;
          setDefaultTermsDraft(termsDays != null ? String(termsDays) : '');
          if (termsDays != null && termsDays > 0) {
            const today = new Date();
            const due = new Date(today);
            due.setDate(today.getDate() + termsDays);
            setCreateDueAt(due.toISOString().slice(0, 10));
          }
        }
      } catch {
        setInvoices([]);
        setCustomers([]);
        setPayments([]);
        setCompany(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  useEffect(() => {
    if (!createOpen || !companyId) return;
    (async () => {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/admin/services'), { headers: h });
      const list = await res.json().catch(() => []);
      setCatalogServices(Array.isArray(list) ? list : []);
    })();
  }, [createOpen, companyId]);

  const addLineItem = () => setCreateLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  const removeLineItem = (i: number) => {
    setCreateLineItems(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length === 0 ? [{ description: 'Cleaning service', quantity: 1, unit_price: 0, amount: 0 }] : next;
    });
  };
  const addFromCatalog = (service: { name: string; base_price: number | null }) => {
    const price = service.base_price != null ? Number(service.base_price) : 0;
    setCreateLineItems(prev => [...prev, { description: service.name, quantity: 1, unit_price: price, amount: price }]);
  };
  const updateLineItem = (i: number, f: Partial<LineItem>) => {
    setCreateLineItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...f };
      if (f.quantity !== undefined || f.unit_price !== undefined) next[i].amount = next[i].quantity * next[i].unit_price;
      return next;
    });
  };

  const handleCreateInvoice = async () => {
    if (!createCustomerId) return;
    const items = createUseTotalOnly
      ? (() => {
          const total = parseFloat(createTotalAmount);
          if (Number.isNaN(total) || total < 0) return [];
          return [{ description: 'Invoice total', quantity: 1, unit_price: total, amount: total }];
        })()
      : createLineItems.map(row => ({
          description: row.description || 'Item',
          quantity: row.quantity,
          unit_price: row.unit_price,
          amount: row.quantity * row.unit_price,
        }));
    if (items.length === 0) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/admin/invoices'), {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ customer_id: createCustomerId, line_items: items, due_at: createDueAt }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => [data, ...prev]);
        setCreateLineItems([{ description: 'Cleaning service', quantity: 1, unit_price: 0, amount: 0 }]);
        setCreateCustomerId(newCustomerId || '');
        setCreateUseTotalOnly(false);
        setCreateTotalAmount('');
        setCreateOpen(false);
        // Open Record payment with new invoice pre-filled and default method so user can confirm or change and record
        setPayCustomerId(createCustomerId);
        setPayInvoiceId(data.id);
        setPayAmount(String(Number(data.total) ?? 0));
        setPayMethod((company as any)?.default_payment_method || 'cash');
        setPaymentOpen(true);
      }
    } catch {}
    setSaving(false);
  };

  const downloadPdf = async (id: string, invoiceNumber: string) => {
    const h = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/admin/invoices/${id}/pdf`), { headers: h });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendInvoice = async (id: string, includePhotos: boolean) => {
    const h = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/admin/invoices/${id}/send`), {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ include_photos: includePhotos }),
    });
    if (res.ok) {
      const data = await res.json();
      setInvoices(prev => prev.map(inv => inv.id === id ? data : inv));
      const customerName = (data as any).customer?.full_name ?? 'Customer';
      toast.success('Invoice sent.');
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error((err as any).error ?? 'Failed to send invoice');
    }
  };

  const handleSavePaymentSettings = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      const body: any = {
        default_payment_method: defaultMethodDraft,
        default_payment_instructions: defaultInstructionsDraft,
        invoice_number_prefix: invoicePrefixDraft.trim() || null,
      };
      if (defaultTermsDraft.trim() !== '') {
        body.default_payment_terms_days = Number(defaultTermsDraft);
      } else {
        body.default_payment_terms_days = null;
      }
      const res = await fetch(apiUrl('/api/companies'), {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
        const method = (data as any).default_payment_method || 'cash';
        setPayMethod(method);
        toast.success('Payment settings saved.');
        setSettingsOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error ?? 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  // Only show invoices that have no payment recorded yet; once paid they appear only in Payment records below
  const invoicesWithoutPayment = invoices.filter((inv) => !payments.some((p: any) => p.invoice_id === inv.id));
  const invoiceSearchLower = invoiceSearch.trim().toLowerCase();
  const filteredInvoices = invoiceSearchLower
    ? invoicesWithoutPayment.filter(
        (inv) =>
          (inv.invoice_number ?? '').toLowerCase().includes(invoiceSearchLower) ||
          ((inv.customer as any)?.full_name ?? '').toLowerCase().includes(invoiceSearchLower) ||
          String(Number(inv.total)).includes(invoiceSearchLower)
      )
    : invoicesWithoutPayment;
  const displayedInvoices = filteredInvoices.slice(0, invoiceLimit);
  const hasMoreInvoices = filteredInvoices.length > invoiceLimit;

  const paymentSearchLower = paymentSearch.trim().toLowerCase();
  const filteredPayments = paymentSearchLower
    ? payments.filter((p) => {
        const inv = invoices.find((i: any) => i.id === p.invoice_id);
        const invNum = (inv?.invoice_number ?? '').toLowerCase();
        return (
          ((p.customer as any)?.full_name ?? '').toLowerCase().includes(paymentSearchLower) ||
          String(Number(p.amount)).includes(paymentSearchLower) ||
          (p.method ?? '').toLowerCase().includes(paymentSearchLower) ||
          invNum.includes(paymentSearchLower)
        );
      })
    : payments;
  const displayedPayments = filteredPayments.slice(0, paymentLimit);
  const hasMorePayments = filteredPayments.length > paymentLimit;

  const loadMoreInvoicesFromServer = async () => {
    if (!companyId || !hasMoreInvoicePages) return;
    try {
      const h = await getAuthHeaders();
      const nextPage = invoicePage + 1;
      const res = await fetch(apiUrl(`/api/admin/invoices?page=${nextPage}&page_size=50`), { headers: h });
      const data = await res.json().then(d => Array.isArray(d) ? d : []);
      if (data.length > 0) {
        setInvoices(prev => [...prev, ...data]);
        setInvoicePage(nextPage);
        setHasMoreInvoicePages(data.length === 50);
      } else {
        setHasMoreInvoicePages(false);
      }
    } catch {
      // keep old state; user can retry via refresh
    }
  };

  const loadMorePaymentsFromServer = async () => {
    if (!companyId || !hasMorePaymentPages) return;
    try {
      const h = await getAuthHeaders();
      const nextPage = paymentPage + 1;
      const res = await fetch(apiUrl(`/api/admin/invoices/payments?page=${nextPage}&page_size=50`), { headers: h });
      const data = await res.json().then(d => Array.isArray(d) ? d : []);
      if (data.length > 0) {
        setPayments(prev => [...prev, ...data]);
        setPaymentPage(nextPage);
        setHasMorePaymentPages(data.length === 50);
      } else {
        setHasMorePaymentPages(false);
      }
    } catch {
      // ignore for now
    }
  };

  const handleRecordPayment = async () => {
    if (!payCustomerId || !payAmount) return;
    setSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/admin/invoices/payments'), {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          customer_id: payCustomerId,
          invoice_id: payInvoiceId || undefined,
          amount: parseFloat(payAmount),
          method: payMethod,
          reference: payReference || undefined,
        }),
      });
      if (res.ok) {
        setPaymentOpen(false);
        const data = await res.json();
        setPayments(prev => [data, ...prev]);
        setPayCustomerId('');
        setPayInvoiceId('');
        setPayAmount('');
        setPayReference('');
        setInvoices(prev => prev.map(inv => inv.id === payInvoiceId ? { ...inv, status: 'paid' } : inv));
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-0">
      <PageHeader
        title="Invoices & Payments"
        subtitle="Create invoices, send by email, record payments"
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        variant="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HelpLink anchor={HelpAnchor.Invoices} className="px-1" />
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 shadow-[0_10px_25px_rgba(16,185,129,0.45)]"
            >
              <Receipt size={18} /> Payment defaults
            </button>
            <button
              onClick={() => {
                setCreateOpen(true);
                setCreateCustomerId(newCustomerId || '');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <Plus size={18} /> Create invoice
            </button>
          </div>
        }
      />

      <div className="p-4 max-w-5xl mx-auto space-y-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h2 className="font-bold text-slate-50">Invoices</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Unpaid only — once you record a payment, the invoice moves to Payment records below.</p>
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search by number, customer, total..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-50 placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <span className="text-slate-400 text-sm">
                  Showing {displayedInvoices.length} of {filteredInvoices.length}
                </span>
              </div>
              {filteredInvoices.length === 0 ? (
                <p className="p-4 text-slate-300">
                  {invoiceSearch.trim()
                    ? 'No invoices match your search.'
                    : invoices.length === 0
                    ? 'No invoices yet.'
                    : 'No unpaid invoices. Once you record a payment, the invoice moves to Payment records below.'}
                </p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <table className="w-full min-w-[600px] text-left border-collapse">
                  <thead className="bg-slate-950/70 border-b border-slate-800">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Number</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Job</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Payment</th>
                      <th className="w-40 py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedInvoices.map((inv) => (
                      <tr key={inv.id} className={`border-b border-slate-800 hover:bg-slate-900 ${inv.id === highlightInvoiceId ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/40' : ''}`}>
                        <td className="py-3 px-4 font-medium text-slate-50">{inv.invoice_number}</td>
                        <td className="py-3 px-4 text-slate-300">{(inv.customer as any)?.full_name ?? '—'}</td>
                        <td className="py-3 px-4">
                          {(inv as any).job_id ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/jobs/new?fromJob=${(inv as any).job_id}&returnTo=invoices`)}
                              className="text-sm text-emerald-300 hover:underline font-medium"
                            >
                              Job detail
                            </button>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{inv.currency} {Number(inv.total).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                                : inv.status === 'sent'
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-400/40'
                                : 'bg-slate-900 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {(() => {
                            const invPayments = payments.filter(p => p.invoice_id === inv.id);
                            if (!invPayments.length) return 'No payment recorded';
                            const latest = invPayments[0];
                            return `£${Number(latest.amount).toFixed(2)} via ${latest.method}`;
                          })()}
                        </td>
                        <td className="py-3 px-4 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                            className="flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                          >
                            <Download size={14} /> PDF
                          </button>
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => {
                                setSendInvoiceId(inv.id);
                                setSendIncludePhotos(false);
                                setSendDialogOpen(true);
                              }}
                              className="flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                            >
                              <Send size={14} /> Send
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPayCustomerId(inv.customer_id);
                              setPayInvoiceId(inv.id);
                              setPayAmount(String(Number(inv.total) || 0));
                              setPayMethod((company as any)?.default_payment_method || 'cash');
                              setPaymentOpen(true);
                            }}
                            className="flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                          >
                            <Receipt size={14} /> Record payment
                          </button>
                          {inv.status === 'draft' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm('Delete this draft invoice? This cannot be undone.')) return;
                                try {
                                  const h = await getAuthHeaders();
                                  const res = await fetch(apiUrl(`/api/admin/invoices/${inv.id}`), { method: 'DELETE', headers: h });
                                  if (res.ok) {
                                    setInvoices(prev => prev.filter(i => i.id !== inv.id));
                                    setPayments(prev => prev.filter(p => p.invoice_id !== inv.id));
                                    toast.success('Invoice deleted');
                                  } else {
                                    const d = await res.json();
                                    toast.error(d.error || 'Could not delete');
                                  }
                                } catch {
                                  toast.error('Could not delete');
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                              aria-label="Delete invoice"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
              {hasMoreInvoices && (
                <div className="p-3 border-t border-slate-800 flex justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (hasMoreInvoicePages) {
                        await loadMoreInvoicesFromServer();
                      } else {
                        setInvoiceLimit((prev) => prev + LIST_LIMIT_DEFAULT);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-800 rounded-xl"
                  >
                    {hasMoreInvoicePages
                      ? 'Load more invoices'
                      : `Show more (${filteredInvoices.length - invoiceLimit} more)`}
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h2 className="font-bold text-slate-50">Payment records</h2>
                  <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      placeholder="Search by number, customer, amount, method..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-50 placeholder-slate-500 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <span className="text-slate-400 text-sm">
                    Showing {displayedPayments.length} of {filteredPayments.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPayMethod((company as any)?.default_payment_method || 'cash');
                    setPaymentOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-slate-500 rounded-xl text-slate-100 hover:bg-slate-800 shrink-0"
                >
                  <Receipt size={14} /> Record payment
                </button>
              </div>
              {filteredPayments.length === 0 ? (
                <p className="p-4 text-slate-300">{paymentSearch.trim() ? 'No payments match your search.' : 'No payments recorded yet.'}</p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <table className="w-full min-w-[700px] text-left border-collapse">
                  <thead className="bg-slate-950/70 border-b border-slate-800">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Number</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Job</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Payment</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-200 text-xs uppercase tracking-[0.16em]">Paid</th>
                      <th className="w-24 py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPayments.map((p) => {
                      const inv = invoices.find((i: any) => i.id === p.invoice_id);
                      return (
                        <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-900">
                          <td className="py-3 px-4 font-medium text-slate-50">{inv?.invoice_number ?? '—'}</td>
                          <td className="py-3 px-4 text-slate-300">{(p.customer as any)?.full_name ?? '—'}</td>
                          <td className="py-3 px-4">
                            {inv?.job_id ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/jobs/new?fromJob=${inv.job_id}&returnTo=invoices`)}
                                className="text-sm text-emerald-300 hover:underline font-medium"
                              >
                                Job detail
                              </button>
                            ) : (
                              <span className="text-slate-500 text-sm">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {inv ? `${inv.currency || '£'} ${Number(inv.total).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {inv ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  inv.status === 'paid'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                                    : inv.status === 'sent'
                                    ? 'bg-sky-500/15 text-sky-300 border border-sky-400/40'
                                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {inv.status}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">£{Number(p.amount).toFixed(2)} via {p.method}</td>
                          <td className="py-3 px-4 text-slate-400 text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                          <td className="py-3 px-4">
                            {inv ? (
                              <button
                                onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                                className="flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                              >
                                <Download size={14} /> PDF
                              </button>
                            ) : (
                              <span className="text-slate-500 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              )}
              {hasMorePayments && (
                <div className="p-3 border-t border-slate-800 flex justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (hasMorePaymentPages) {
                        await loadMorePaymentsFromServer();
                      } else {
                        setPaymentLimit((prev) => prev + LIST_LIMIT_DEFAULT);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-800 rounded-xl"
                  >
                    {hasMorePaymentPages
                      ? 'Load more payments'
                      : `Show more (${filteredPayments.length - paymentLimit} more)`}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setCreateOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 text-slate-50 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Create invoice</h2>
              <button onClick={() => setCreateOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Customer *</label>
                <select value={createCustomerId} onChange={e => setCreateCustomerId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" required>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Due date</label>
                <input type="date" value={createDueAt} onChange={e => setCreateDueAt(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>

              <div className="border-t border-slate-800 pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={createUseTotalOnly} onChange={e => setCreateUseTotalOnly(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-slate-300">Enter total only (no line items)</span>
                </label>
                {createUseTotalOnly ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Total amount (£)</label>
                    <input type="number" min={0} step={0.01} value={createTotalAmount} onChange={e => setCreateTotalAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-slate-300">Line items</label>
                      {catalogServices.length > 0 && (
                        <select
                          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value=""
                          onChange={e => {
                            const id = e.target.value;
                            if (!id) return;
                            const s = catalogServices.find(sv => sv.id === id);
                            if (s) addFromCatalog(s);
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Add from catalog</option>
                          {catalogServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name} — £{(s.base_price ?? 0).toFixed(2)}</option>
                          ))}
                        </select>
                      )}
                      <button type="button" onClick={addLineItem} className="text-sm text-emerald-400 font-medium hover:underline">+ Add line</button>
                    </div>
                    {createLineItems.map((row, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                        <input placeholder="Description" value={row.description} onChange={e => updateLineItem(i, { description: e.target.value })} className="col-span-5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none" />
                        <input type="number" min={0} step={1} value={row.quantity} onChange={e => updateLineItem(i, { quantity: parseFloat(e.target.value) || 0 })} className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" />
                        <input type="number" min={0} step={0.01} value={row.unit_price} onChange={e => updateLineItem(i, { unit_price: parseFloat(e.target.value) || 0 })} className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Price" />
                        <span className="col-span-2 flex items-center text-sm text-slate-400">£{(row.quantity * row.unit_price).toFixed(2)}</span>
                        <button type="button" onClick={() => removeLineItem(i)} aria-label="Remove line" className="col-span-1 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCreateOpen(false)} className="flex-1 py-2 border border-slate-600 rounded-xl font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleCreateInvoice} disabled={saving || (createUseTotalOnly ? !createTotalAmount || parseFloat(createTotalAmount) < 0 : false)} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-slate-950 border border-slate-800 text-slate-50 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Default payment settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Invoice number prefix
                </label>
                <input
                  type="text"
                  value={invoicePrefixDraft}
                  onChange={e => setInvoicePrefixDraft(e.target.value.replace(/[^A-Za-z0-9-_]/g, '').toUpperCase().slice(0, 20))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. INV or ACME"
                />
                <p className="text-xs text-slate-500 mt-1">New invoices: {invoicePrefixDraft || 'INV'}-{new Date().getFullYear()}-0001</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Default payment method
                </label>
                <select
                  value={defaultMethodDraft}
                  onChange={e => setDefaultMethodDraft(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="payment_link">Payment link</option>
                  <option value="stripe_placeholder">Stripe (placeholder)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Bank details / payment instructions
                </label>
                <textarea
                  value={defaultInstructionsDraft}
                  onChange={e => setDefaultInstructionsDraft(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 min-h-[96px] text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Bank name, account number, sort code, payment reference format"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Standard payment terms (days)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={defaultTermsDraft}
                  onChange={e => setDefaultTermsDraft(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. 7, 14, 30"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSettingsOpen(false)}
                className="flex-1 py-2 border border-slate-600 rounded-xl font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePaymentSettings}
                disabled={saving}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {sendDialogOpen && sendInvoiceId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSendDialogOpen(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Send invoice</h2>
              <button
                onClick={() => setSendDialogOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Do you want to include any available after-cleaning photos in the email?
            </p>
            <label className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Include photos in email</p>
                <p className="text-xs text-slate-500">
                  If this job has after photos, they will be attached or linked in the email.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sendIncludePhotos}
                onChange={(e) => setSendIncludePhotos(e.target.checked)}
              />
            </label>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSendDialogOpen(false)}
                className="flex-1 py-2 border border-slate-300 rounded-xl font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = sendInvoiceId;
                  setSendDialogOpen(false);
                  await sendInvoice(id, sendIncludePhotos);
                }}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50"
              >
                Send now
              </button>
            </div>
          </div>
        </div>
      )}
      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPaymentOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 text-slate-50 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-50">Record payment</h2>
              <button onClick={() => setPaymentOpen(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Customer *</label>
                <select value={payCustomerId} onChange={e => { setPayCustomerId(e.target.value); setPayInvoiceId(''); }} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" required>
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Invoice (optional)</label>
                <select value={payInvoiceId} onChange={e => setPayInvoiceId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">— None —</option>
                  {invoices.filter(i => i.customer_id === payCustomerId).map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — £{Number(inv.total).toFixed(2)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount *</label>
                <input type="number" min={0} step={0.01} value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="payment_link">Payment link</option>
                  <option value="stripe_placeholder">Stripe (placeholder)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Reference (optional)</label>
                <input value={payReference} onChange={e => setPayReference(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-50 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. ref number" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaymentOpen(false)} className="flex-1 py-2 border border-slate-600 rounded-xl font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleRecordPayment} disabled={saving} className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold hover:bg-emerald-400 disabled:opacity-50">Record</button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNav />
    </div>
  );
}

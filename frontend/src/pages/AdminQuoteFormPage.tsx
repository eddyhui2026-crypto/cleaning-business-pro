import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Loader2, Save, Send, FileText, Zap, X } from 'lucide-react';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';

interface CatalogService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_type: string;
  base_price: number | null;
  suggested_price_min: number | null;
  suggested_price_max: number | null;
  display_order: number;
}

interface LineItem {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  quantity: number;
  unit_price: number | null;
  total: number | null;
}

function newLineItem(s: CatalogService): LineItem {
  const qty = 1;
  const up = s.base_price ?? null;
  const total = up != null ? Math.round(qty * up * 100) / 100 : null;
  return {
    id: crypto.randomUUID(),
    service_id: s.id,
    name: s.name,
    slug: s.slug,
    quantity: qty,
    unit_price: up,
    total,
  };
}

const NIGHT_SHIFT_SURCHARGE_LABEL = 'Night Shift Surcharge (22:00 – 06:00)';

// Align with Create New Job (AdminNewJobPage) for easy quote → job conversion
const PROPERTY_TYPES = [
  { value: 'flat', label: 'Flat (residential)' },
  { value: 'terraced', label: 'Terraced house' },
  { value: 'semi_detached', label: 'Semi-detached house' },
  { value: 'detached', label: 'Detached house' },
  { value: 'studio', label: 'Studio' },
  { value: 'hmo', label: 'HMO / Shared house' },
  { value: 'office', label: 'Office (commercial)' },
  { value: 'shop', label: 'Shop / Retail unit' },
  { value: 'restaurant', label: 'Restaurant / Hospitality' },
];
const RESIDENTIAL_PROPERTY_TYPES = new Set(['flat', 'terraced', 'semi_detached', 'detached', 'studio', 'hmo']);
const COMMERCIAL_PROPERTY_TYPES = new Set(['office', 'shop', 'restaurant']);

function newNightShiftSurchargeLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    service_id: '',
    name: NIGHT_SHIFT_SURCHARGE_LABEL,
    slug: 'night_shift_surcharge',
    quantity: 1,
    unit_price: null,
    total: null,
  };
}

interface AdminQuoteFormPageProps {
  companyId: string | null;
}

export function AdminQuoteFormPage({ companyId }: AdminQuoteFormPageProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer') || '';
  const isEdit = !!id;

  const [customers, setCustomers] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [quoteAddress, setQuoteAddress] = useState('');
  const [quotePhone, setQuotePhone] = useState('');
  const [quoteEmail, setQuoteEmail] = useState('');
  const [quotePreferredDate, setQuotePreferredDate] = useState('');
  const [quotePropertyType, setQuotePropertyType] = useState('');
  const [quoteBedrooms, setQuoteBedrooms] = useState(2);
  const [quoteBathrooms, setQuoteBathrooms] = useState(1);
  const [quotePropertySizeSqft, setQuotePropertySizeSqft] = useState('');
  const [quoteFrequency, setQuoteFrequency] = useState('');
  const [addVat, setAddVat] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quickAddSelected, setQuickAddSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const { totalFromLines, hasPriceTbc } = useMemo(() => {
    let sum = 0;
    let hasTbc = false;
    lineItems.forEach((row) => {
      const q = row.quantity;
      const u = row.unit_price;
      if (u != null && Number.isFinite(u)) {
        sum += Math.round(q * u * 100) / 100;
      } else {
        hasTbc = true;
      }
    });
    return { totalFromLines: Math.round(sum * 100) / 100, hasPriceTbc: hasTbc };
  }, [lineItems]);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) (h as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const h = await getAuthHeaders();
      const [custRes, servicesRes] = await Promise.all([
        fetch(apiUrl('/api/admin/customers'), { headers: h }),
        fetch(apiUrl('/api/admin/services'), { headers: h }),
      ]);
      const custList = await custRes.json().then((d: any) => (Array.isArray(d) ? d : []));
      const servList = await servicesRes.json().catch(() => []);
      setCustomers(custList);
      setCatalogServices(Array.isArray(servList) ? servList : []);
      if (!isEdit && preselectedCustomerId) {
        setCustomerId(preselectedCustomerId);
        const preselected = custList.find((c: any) => c.id === preselectedCustomerId);
        if (preselected) {
          setCustomerNameInput(preselected.full_name ?? '');
          setQuotePhone(preselected.phone ?? '');
          setQuoteEmail(preselected.email ?? '');
          setQuoteAddress(preselected.address ?? '');
        }
      }
      if (isEdit && id) {
        const quoteRes = await fetch(apiUrl(`/api/admin/quotes/${id}`), { headers: h });
        if (quoteRes.ok) {
          const q = await quoteRes.json();
          const custId = q.customer_id ?? '';
          setCustomerId(custId);
          const cust = custList.find((c: any) => c.id === custId);
          if (cust) {
            setCustomerNameInput(cust.full_name ?? '');
            setQuotePhone(cust.phone ?? '');
            setQuoteEmail(cust.email ?? '');
            setQuoteAddress(cust.address ?? '');
          }
          const notesStr = q.notes ?? '';
          const lines = notesStr.split('\n').map((s: string) => s.trim()).filter(Boolean);
          const userNoteLines: string[] = [];
          for (const line of lines) {
            if (/^Address:/i.test(line)) setQuoteAddress(line.replace(/^Address:\s*/i, '').trim());
            else if (/^Preferred date:/i.test(line)) setQuotePreferredDate(line.replace(/^Preferred date:\s*/i, '').trim());
            else if (/^Property type:/i.test(line)) setQuotePropertyType(line.replace(/^Property type:\s*/i, '').trim());
            else if (/^Property:/i.test(line)) setQuotePropertyType(line.replace(/^Property:\s*/i, '').trim());
            else if (/^Bedrooms:/i.test(line)) setQuoteBedrooms(Math.max(0, parseInt(line.replace(/^Bedrooms:\s*/i, ''), 10) || 2));
            else if (/^Bathrooms:/i.test(line)) setQuoteBathrooms(Math.max(0, parseInt(line.replace(/^Bathrooms:\s*/i, ''), 10) || 1));
            else if (/^Property size \(sq ft\):/i.test(line)) setQuotePropertySizeSqft(line.replace(/^Property size \(sq ft\):\s*/i, '').trim());
            else if (/^Frequency:/i.test(line)) setQuoteFrequency(line.replace(/^Frequency:\s*/i, '').trim());
            else if (/^Add VAT \(20%\):\s*yes/i.test(line)) setAddVat(true);
            else if (/^Add VAT:\s*yes/i.test(line)) setAddVat(true);
            else userNoteLines.push(line);
          }
          setNotes(userNoteLines.join('\n').trim());
          const items = q.line_items;
          if (Array.isArray(items) && items.length > 0) {
            setLineItems(
              items.map((row: any) => ({
                id: row.id || crypto.randomUUID(),
                service_id: row.service_id ?? '',
                name: row.name ?? 'Service',
                slug: row.slug ?? '',
                quantity: Math.max(0, Number(row.quantity) || 1),
                unit_price: row.unit_price != null && row.unit_price !== '' ? Number(row.unit_price) : null,
                total: row.total != null && row.total !== '' ? Number(row.total) : null,
              }))
            );
          } else {
            setLineItems([
              {
                id: crypto.randomUUID(),
                service_id: '',
                name: q.service_type || 'Cleaning service',
                slug: '',
                quantity: Number(q.quantity) || 1,
                unit_price: Number(q.unit_price) || 0,
                total: Number(q.total_price) || 0,
              },
            ]);
          }
          if (q.status !== 'draft') setError('Only draft quotes can be edited.');
        }
      }
      setLoading(false);
    })();
  }, [companyId, isEdit, id, preselectedCustomerId]);

  const toggleQuickAdd = (slug: string) => {
    setQuickAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const addSelectedToLines = () => {
    const toAdd = catalogServices.filter((s) => quickAddSelected.has(s.slug));
    const newItems = toAdd.map((s) => newLineItem(s));
    setLineItems((prev) => [...prev, ...newItems]);
    setQuickAddSelected(new Set());
  };

  const updateLineItem = (lineId: string, field: 'quantity' | 'unit_price', value: number | null) => {
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== lineId) return row;
        if (field === 'quantity') {
          const q = Math.max(0, value ?? 0);
          const u = row.unit_price;
          const total = u != null ? Math.round(q * u * 100) / 100 : null;
          return { ...row, quantity: q, total };
        }
        const u = value;
        const total = u != null ? Math.round(row.quantity * u * 100) / 100 : null;
        return { ...row, unit_price: u, total };
      })
    );
  };

const removeLineItem = (lineId: string) => {
      setLineItems((prev) => prev.filter((r) => r.id !== lineId));
    };

  const buildNotesWithUkFields = () => {
    const parts: string[] = [];
    if (notes.trim()) parts.push(notes.trim());
    if (quoteAddress.trim()) parts.push(`Address: ${quoteAddress.trim()}`);
    if (quotePreferredDate) parts.push(`Preferred date: ${quotePreferredDate}`);
    if (quotePropertyType) parts.push(`Property type: ${quotePropertyType}`);
    if (RESIDENTIAL_PROPERTY_TYPES.has(quotePropertyType)) {
      parts.push(`Bedrooms: ${quoteBedrooms}`);
      parts.push(`Bathrooms: ${quoteBathrooms}`);
    }
    if (COMMERCIAL_PROPERTY_TYPES.has(quotePropertyType) && quotePropertySizeSqft.trim()) parts.push(`Property size (sq ft): ${quotePropertySizeSqft.trim()}`);
    if (quoteFrequency) parts.push(`Frequency: ${quoteFrequency}`);
    parts.push(`Add VAT (20%): ${addVat ? 'yes' : 'no'}`);
    return parts.length ? parts.join('\n') : null;
  };

  const handlePostcodeLookup = () => {
    const pc = postcode.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!pc) return;
    if (typeof (window as any).google === 'undefined' || !(window as any).google.maps?.Geocoder) {
      setError('Address lookup not available. Enter address manually.');
      return;
    }
    setAddressLookupLoading(true);
    setError('');
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address: pc }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]) {
        setQuoteAddress(results[0].formatted_address);
      } else {
        setError('Address not found for this postcode. Enter address manually.');
      }
      setAddressLookupLoading(false);
    });
  };

  const handleSaveDraft = async () => {
    setError('');
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && customerNameInput.trim()) {
      if (!quotePhone.trim()) {
        setError('Phone is required when adding a new customer.');
        return;
      }
      setSaving(true);
      const h = await getAuthHeaders();
      try {
        const createRes = await fetch(apiUrl('/api/admin/customers'), {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            full_name: customerNameInput.trim(),
            phone: quotePhone.trim(),
            email: quoteEmail.trim() || null,
            address: quoteAddress.trim() || null,
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          setError((createData as any).error || 'Failed to create customer');
          setSaving(false);
          return;
        }
        resolvedCustomerId = (createData as any).customer?.id;
        if (resolvedCustomerId) setCustomers((prev) => [...prev, (createData as any).customer]);
      } catch {
        setError('Network error');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (!resolvedCustomerId) {
      setError('Please enter or select a customer.');
      return;
    }
    if (lineItems.length === 0) {
      setError('Add at least one service line.');
      return;
    }
    setSaving(true);
    const h = await getAuthHeaders();
    const payload = lineItems.map((row) => ({
      id: row.id,
      service_id: row.service_id,
      name: row.name,
      slug: row.slug,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total: row.unit_price != null ? Math.round(row.quantity * row.unit_price * 100) / 100 : null,
    }));
    const notesFinal = buildNotesWithUkFields();
    try {
      if (isEdit && id) {
        const res = await fetch(apiUrl(`/api/admin/quotes/${id}`), {
          method: 'PATCH',
          headers: h,
          body: JSON.stringify({ line_items: payload, notes: notesFinal }),
        });
        if (res.ok) {
          setSaving(false);
          navigate('/admin/quotes');
          return;
        }
        const err = await res.json();
        setError(err.error || 'Update failed');
      } else {
        const res = await fetch(apiUrl('/api/admin/quotes'), {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            customer_id: resolvedCustomerId,
            line_items: payload,
            notes: notesFinal,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSaving(false);
          navigate(`/admin/quotes/${data.id}/edit`);
          return;
        }
        const err = await res.json();
        setError(err.error || 'Create failed');
      }
    } catch (e) {
      setError('Network error');
    }
    setSaving(false);
  };

  const handleSendQuote = async () => {
    setError('');
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (lineItems.length === 0) {
      setError('Add at least one service line.');
      return;
    }
    if (!isEdit || !id) {
      setError('Save as draft first, then send.');
      return;
    }
    setSending(true);
    const h = await getAuthHeaders();
    try {
      const res = await fetch(apiUrl(`/api/admin/quotes/${id}/send`), { method: 'POST', headers: h });
      if (res.ok) {
        navigate('/admin/quotes');
        return;
      }
      const err = await res.json();
      setError(err.error || 'Send failed');
    } catch {
      setError('Network error');
    }
    setSending(false);
  };

  const handlePreviewPdf = async () => {
    if (!id) {
      setError('Save as draft first to preview PDF.');
      return;
    }
    setError('');
    setSaving(true);
    const h = await getAuthHeaders();
    const payload = lineItems.map((row) => ({
      id: row.id,
      service_id: row.service_id,
      name: row.name,
      slug: row.slug,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total: row.unit_price != null ? Math.round(row.quantity * row.unit_price * 100) / 100 : null,
    }));
    const notesFinal = buildNotesWithUkFields();
    try {
      const patchRes = await fetch(apiUrl(`/api/admin/quotes/${id}`), {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ line_items: payload, notes: notesFinal }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        setError((err as any).error || 'Update failed');
        setSaving(false);
        return;
      }
      const pdfRes = await fetch(apiUrl(`/api/admin/quotes/${id}/pdf`), { headers: h });
      if (!pdfRes.ok) {
        setError('Could not generate PDF');
        setSaving(false);
        return;
      }
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-28 lg:pb-10">
      <PageHeader
        title={isEdit ? 'Edit quote' : 'New quote'}
        backTo="/admin/quotes"
        backLabel="Back to Quotes"
        variant="dark"
      />

      <div className="p-4 max-w-4xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Quick-add: multi-select checklist from catalog */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-slate-900/80 rounded-2xl border border-slate-700 p-4 sticky top-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-2">
              <Zap size={18} className="text-amber-400" /> Quick-add from catalog
            </h3>
            <p className="text-xs text-slate-400 mb-3">Tick services then click Add Selected. Prices sync from your Service catalog.</p>
            {catalogServices.length === 0 ? (
              <p className="text-xs text-slate-500">No services in catalog. Add them in <strong>Services</strong>.</p>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {catalogServices.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={quickAddSelected.has(s.slug)}
                        onChange={() => toggleQuickAdd(s.slug)}
                        className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-200 flex-1 truncate">{s.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {s.base_price != null && s.base_price > 0 ? `£${s.base_price}` : 'Price TBC'}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSelectedToLines}
                  disabled={quickAddSelected.size === 0}
                  className="mt-3 w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add selected ({quickAddSelected.size})
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {error && (
            <div className="mb-4 p-4 bg-red-500/15 border border-red-500/40 rounded-xl text-red-200 text-sm">{error}</div>
          )}

          <div className="bg-slate-900/80 rounded-2xl border border-slate-700 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Customer name *</label>
              <input
                type="text"
                list="customer-list"
                value={customerId ? (selectedCustomer?.full_name ?? '') : customerNameInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomerNameInput(v);
                  const match = customers.find((c) => c.full_name === v);
                  if (match) {
                    setCustomerId(match.id);
                    setQuotePhone(match.phone ?? '');
                    setQuoteEmail(match.email ?? '');
                    setQuoteAddress(match.address ?? '');
                  } else {
                    setCustomerId('');
                  }
                }}
                placeholder="Type name or select from list"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                disabled={isEdit}
              />
              <datalist id="customer-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.full_name} />
                ))}
              </datalist>
              {!customerId && customerNameInput.trim() && (
                <p className="text-xs text-slate-400 mt-1">New customer will be created. Enter phone number below (required for new customers).</p>
              )}
            </div>

            {/* UK quote fields: postcode lookup, address, phone, email, preferred date, property type + rooms/sqft, frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Postcode search (same as New Job)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="e.g. SW1A 1AA"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePostcodeLookup}
                    disabled={addressLookupLoading || !postcode.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-slate-950 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {addressLookupLoading ? '…' : 'Look up'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Enter postcode then Look up to fill address.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                <textarea
                  value={quoteAddress}
                  onChange={(e) => setQuoteAddress(e.target.value)}
                  placeholder="Full address (from lookup or type manually)"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone {!customerId && customerNameInput.trim() ? '*' : ''}</label>
                <input
                  type="text"
                  value={quotePhone}
                  onChange={(e) => setQuotePhone(e.target.value)}
                  placeholder="Client phone"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={quoteEmail}
                  onChange={(e) => setQuoteEmail(e.target.value)}
                  placeholder="Client email"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Preferred date</label>
                <input
                  type="date"
                  value={quotePreferredDate}
                  onChange={(e) => setQuotePreferredDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Property type (same as New Job)</label>
                <select
                  value={quotePropertyType}
                  onChange={(e) => setQuotePropertyType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Select property type (optional)</option>
                  {PROPERTY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {quotePropertyType && RESIDENTIAL_PROPERTY_TYPES.has(quotePropertyType) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Bedrooms</label>
                    <select
                      value={quoteBedrooms}
                      onChange={(e) => setQuoteBedrooms(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Bathrooms</label>
                    <select
                      value={quoteBathrooms}
                      onChange={(e) => setQuoteBathrooms(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {quotePropertyType && COMMERCIAL_PROPERTY_TYPES.has(quotePropertyType) && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Property size (approx sq ft)</label>
                  <input
                    type="number"
                    min={0}
                    value={quotePropertySizeSqft}
                    onChange={(e) => setQuotePropertySizeSqft(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Frequency</label>
                <select
                  value={quoteFrequency}
                  onChange={(e) => setQuoteFrequency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">—</option>
                  <option value="One-off">One-off</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Fortnightly">Fortnightly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            {selectedCustomer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl text-sm text-slate-300 border border-slate-700">
                <div><span className="font-medium text-slate-200">Name:</span> {selectedCustomer.full_name}</div>
                <div><span className="font-medium text-slate-200">Email:</span> {selectedCustomer.email || '—'}</div>
                <div><span className="font-medium text-slate-200">Phone:</span> {selectedCustomer.phone || '—'}</div>
                <div><span className="font-medium text-slate-200">Address:</span> {selectedCustomer.address || '—'}</div>
              </div>
            )}

            {/* Line items */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Quote lines</label>
              <p className="text-xs text-slate-400 mb-2">
                For jobs between 22:00–06:00 (night/overnight), consider adding a <strong>Night Shift Surcharge</strong> line.
              </p>
              <button
                type="button"
                onClick={() => setLineItems((prev) => [...prev, newNightShiftSurchargeLine()])}
                className="mb-3 px-3 py-1.5 text-sm font-medium rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              >
                + Add Night Shift Surcharge (22:00–06:00)
              </button>
              {lineItems.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">Use Quick-add to add services from your catalog, or add the Night Shift Surcharge above for overnight jobs.</p>
              ) : (
                <ul className="space-y-3">
                  {lineItems.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700"
                    >
                      <span className="w-32 font-medium text-slate-200 truncate shrink-0">{row.name}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.quantity}
                        onChange={(e) => updateLineItem(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-50"
                      />
                      <span className="text-slate-500 text-xs">×</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unit_price ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLineItem(row.id, 'unit_price', v === '' ? null : parseFloat(v) || 0);
                        }}
                        placeholder="TBC"
                        className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-50"
                      />
                      <span className="text-slate-500 text-xs">£</span>
                      <span className="w-16 text-right text-sm font-medium text-slate-200">
                        {row.unit_price != null && Number.isFinite(row.unit_price)
                          ? `£${(row.quantity * row.unit_price).toFixed(2)}`
                          : 'Price TBC'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLineItem(row.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 ml-auto"
                        aria-label="Remove line"
                      >
                        <X size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 bg-emerald-500/15 rounded-xl border border-emerald-500/40 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addVat}
                  onChange={(e) => setAddVat(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-200">Add VAT (20% on top of quote total)</span>
              </label>
              {addVat ? (
                <div className="text-sm space-y-1 pt-2 border-t border-emerald-500/30">
                  <div className="flex justify-between text-slate-200"><span>Subtotal (ex VAT)</span><span>£{totalFromLines.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-200"><span>VAT (20%)</span><span>£{(totalFromLines * 0.2).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-emerald-300 text-base pt-1"><span>Total (inc VAT)</span><span>£{(totalFromLines * 1.2).toFixed(2)}</span></div>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-medium text-slate-200">Quotation amount: </span>
                  <span className="text-xl font-bold text-emerald-300">£{totalFromLines.toFixed(2)}</span>
                  {hasPriceTbc && <span className="text-sm text-slate-300 ml-1">+ Price TBC for certain items</span>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Notes (for client)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Optional notes for the client"
              />
            </div>

            <p className="text-xs text-slate-500 italic">
              Kindly note: Final price is subject to parking availability and property condition.
            </p>

            <div className="flex flex-wrap gap-3 pt-4 pb-8">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || lineItems.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-slate-100 rounded-xl font-medium hover:bg-slate-600 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save draft
              </button>
              {isEdit && id && (
                <>
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-600 text-slate-200 rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} Preview PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleSendQuote}
                    disabled={sending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    Send quote
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <AdminBottomNav />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Loader2,
  ArrowLeft,
  Package,
  Users,
  CalendarClock,
  AlertCircle,
  Plus,
  Home,
  Key,
  Receipt,
  Repeat,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

// Align with customer online booking (CustomerBookPage)
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
const KEY_ACCESS_OPTIONS = [
  { value: 'i_will_be_home', label: 'I will be home' },
  { value: 'key_safe', label: 'Key safe / Hidden key' },
  { value: 'neighbor', label: 'Pick up key from neighbor' },
];
const PARKING_OPTIONS = [
  { value: 'visitor_permit', label: 'Visitor parking permit provided' },
  { value: 'paid_street', label: 'Paid street parking available' },
  { value: 'no_parking', label: 'No parking (surcharge may apply)' },
];
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { CatalogService, LineItem, newLineItemFromCatalog, newLineItemFromFallback, computeLineTotal } from '../lib/pricing';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { snapshotFromTemplate, DEFAULT_CHECKLIST_TEMPLATES } from '../config/checklistTemplates';
import type { ChecklistTemplate, JobChecklistSnapshot, JobChecklistTask } from '../types/checklist';

interface AdminNewJobPageProps {
  companyId: string | null;
}

interface Staff {
  id: string;
  full_name: string;
  name?: string;
  pay_type?: string | null;
  pay_hourly_rate?: number | null;
  pay_percentage?: number | null;
  pay_fixed_amount?: number | null;
}

function parsePreferredDate(str: string): Date | null {
  const s = str.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const dmY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmY) {
    const [, day, month, year] = dmY;
    const y = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    const d = new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), 9, 0, 0);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function AdminNewJobPage({ companyId }: AdminNewJobPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromJobId = searchParams.get('fromJob');
  const fromQuoteId = searchParams.get('fromQuote');
  const returnTo = searchParams.get('returnTo'); // 'invoices' | 'schedule' | null
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string; phone?: string; email?: string; address?: string }>>([]);
  const [customerId, setCustomerId] = useState('');
  const [services, setServices] = useState<CatalogService[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [companyPay, setCompanyPay] = useState<{
    default_pay_type?: string | null;
    default_hourly_rate?: number | null;
    default_pay_percentage?: number | null;
    default_fixed_pay?: number | null;
  } | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [address, setAddress] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [frequency, setFrequency] = useState<'one-off' | 'weekly' | 'fortnightly' | 'monthly' | 'custom'>('one-off');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<string | null>(null);
  // Align with customer online booking
  const [property_type, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [property_size_sqft, setPropertySizeSqft] = useState('');
  const [key_access, setKeyAccess] = useState('i_will_be_home');
  const [key_instructions, setKeyInstructions] = useState('');
  const [parking, setParking] = useState('visitor_permit');
  const [postcode, setPostcode] = useState('');
  const [provide_supplies, setProvideSupplies] = useState(false);
  const [has_pets, setHasPets] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(false);
  const [currentJob, setCurrentJob] = useState<{ id: string; invoice?: { id: string; invoice_number: string; status: string } | null } | null>(null);
  const [customTotalPrice, setCustomTotalPrice] = useState('');
  const [priceIncludesVat, setPriceIncludesVat] = useState(false);
  const [payType, setPayType] = useState<'' | 'hourly' | 'percentage' | 'fixed'>('');
  const [payHourlyRate, setPayHourlyRate] = useState('');
  const [payPercentage, setPayPercentage] = useState('');
  const [payFixedAmount, setPayFixedAmount] = useState('');
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState<string | null>(null);
  const [checklistOverride, setChecklistOverride] = useState<JobChecklistSnapshot | null>(null);
  const [checklistSidebarOpen, setChecklistSidebarOpen] = useState(false);
  const [checklistEditDraft, setChecklistEditDraft] = useState<JobChecklistTask[]>([]);
  const [checklistEditMeta, setChecklistEditMeta] = useState<{ template_name: string; template_id: string }>({ template_name: '', template_id: '' });

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };
        const [custRes, svcRes, staffRes, checkRes, companiesRes] = await Promise.all([
          fetch(apiUrl('/api/admin/customers'), { headers }),
          fetch(apiUrl('/api/admin/services'), { headers }),
          fetch(apiUrl('/api/staff'), { headers }),
          fetch(apiUrl('/api/companies/checklist-templates'), { headers }),
          fetch(apiUrl('/api/companies'), { headers }),
        ]);
        const custData = await custRes.json().then((d: any) => (Array.isArray(d) ? d : [])).catch(() => []);
        const svcData = await svcRes.json().catch(() => []);
        const staffData = await staffRes.json().catch(() => []);
        const checkData = await checkRes.json().catch(() => ({}));
        const companiesData = await companiesRes.json().catch(() => ({}));
        setCustomers(custData);
        setServices(Array.isArray(svcData) ? svcData : []);
        setStaffList(Array.isArray(staffData) ? staffData : []);
        const templates = Array.isArray(checkData?.templates) && checkData.templates.length > 0
          ? checkData.templates
          : DEFAULT_CHECKLIST_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] }));
        setChecklistTemplates(templates);
        setCompanyPay({
          default_pay_type: companiesData?.default_pay_type ?? null,
          default_hourly_rate: companiesData?.default_hourly_rate ?? null,
          default_pay_percentage: companiesData?.default_pay_percentage ?? null,
          default_fixed_pay: companiesData?.default_fixed_pay ?? null,
        });
      } catch {
        setServices([]);
        setStaffList([]);
        setCompanyPay(null);
      } finally {
        setLoading(true);
      }
    })();
  }, [companyId]);

  // If opened from an existing job, fetch that job once and prefill
  useEffect(() => {
    if (!companyId || !fromJobId) return;
    (async () => {
      try {
        setLoadingJob(true);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(apiUrl(`/api/jobs/${fromJobId}`), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!res.ok) return;
        const job = await res.json();
        setCurrentJob({ id: job.id, invoice: job.invoice ?? null });
        setClientName(job.client_name || '');
        setAddress(job.address || '');
        if (job.customer_id) {
          setClientPhone(job.client_phone || '');
          setClientEmail(job.client_email || '');
        }
        if (job.scheduled_at) {
          const d = new Date(job.scheduled_at);
          setScheduledAt(d);
        }
        if (Array.isArray(job.staff_members)) {
          setStaffIds(job.staff_members.map((s: any) => s.id));
        }
        if (job.details && typeof job.details === 'object') {
          const d = job.details as any;
          if (typeof d.estimated_hours === 'number') {
            setEstimatedHours(d.estimated_hours);
          }
          if (Array.isArray(d.line_items)) {
            const mapped: LineItem[] = d.line_items.map((row: any) => ({
              id: row.id || crypto.randomUUID(),
              service_id: row.service_id || '',
              name: row.name || '',
              slug: row.slug || '',
              quantity: row.quantity ?? 1,
              unit_price: row.unit_price ?? null,
              price_type: row.price_type === 'hourly' ? 'hourly' : 'fixed',
              total: row.total ?? null,
            }));
            setLineItems(mapped);
          }
          if (d.property_type) setPropertyType(d.property_type);
          if (d.bedrooms != null) setBedrooms(Number(d.bedrooms));
          if (d.bathrooms != null) setBathrooms(Number(d.bathrooms));
          if (d.property_size_sqft != null) setPropertySizeSqft(String(d.property_size_sqft));
          else if (d.sq_ft != null) setPropertySizeSqft(String(d.sq_ft));
          if (d.key_access) setKeyAccess(d.key_access);
          if (d.key_instructions) setKeyInstructions(d.key_instructions || '');
          if (d.parking) setParking(d.parking);
          if (d.postcode) setPostcode(d.postcode || '');
          if (d.provide_supplies != null) setProvideSupplies(!!d.provide_supplies);
          if (d.has_pets != null) setHasPets(!!d.has_pets);
          if (d.checklist?.template_id) setSelectedChecklistTemplateId(d.checklist.template_id);
          if (d.checklist?.tasks?.length) setChecklistOverride(d.checklist as JobChecklistSnapshot);
        }
        if (job.notes) setNotes(job.notes);
        if (job.price_includes_vat) setPriceIncludesVat(true);
      } catch {
        // ignore prefill errors; form can still be used blank
      } finally {
        setLoadingJob(false);
      }
    })();
  }, [companyId, fromJobId]);

  // Pre-fill from quote when Convert to job was used (only filled fields from quote; rest stay empty)
  useEffect(() => {
    if (!companyId || !fromQuoteId || fromJobId) return;
    (async () => {
      try {
        setLoadingJob(true);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(apiUrl(`/api/admin/quotes/${fromQuoteId}`), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!res.ok) return;
        const q = await res.json();
        const cust = q.customer as { id?: string; full_name?: string; phone?: string; email?: string; address?: string } | null;
        if (q.customer_id && cust?.id) setCustomerId(q.customer_id);
        if (cust?.full_name) setClientName(cust.full_name);
        if (cust?.phone) setClientPhone(cust.phone);
        if (cust?.email) setClientEmail(cust.email);
        const notesStr = q.notes ?? '';
        const lines = notesStr.split('\n').map((s: string) => s.trim()).filter(Boolean);
        let parsedAddress = cust?.address ?? '';
        let parsedPreferredDate = '';
        let parsedPropertyType = '';
        let parsedBedrooms = 2;
        let parsedBathrooms = 1;
        let parsedPropertySizeSqft = '';
        let parsedFrequency = '';
        for (const line of lines) {
          if (/^Address:/i.test(line)) parsedAddress = line.replace(/^Address:\s*/i, '').trim();
          else if (/^Preferred date:/i.test(line)) parsedPreferredDate = line.replace(/^Preferred date:\s*/i, '').trim();
          else if (/^Property type:/i.test(line)) parsedPropertyType = line.replace(/^Property type:\s*/i, '').trim();
          else if (/^Property:/i.test(line)) parsedPropertyType = line.replace(/^Property:\s*/i, '').trim();
          else if (/^Bedrooms:/i.test(line)) parsedBedrooms = Math.max(0, parseInt(line.replace(/^Bedrooms:\s*/i, ''), 10) || 2);
          else if (/^Bathrooms:/i.test(line)) parsedBathrooms = Math.max(0, parseInt(line.replace(/^Bathrooms:\s*/i, ''), 10) || 1);
          else if (/^Property size \(sq ft\):/i.test(line)) parsedPropertySizeSqft = line.replace(/^Property size \(sq ft\):\s*/i, '').trim();
          else if (/^Frequency:/i.test(line)) parsedFrequency = line.replace(/^Frequency:\s*/i, '').trim();
        }
        if (parsedAddress) setAddress(parsedAddress);
        if (parsedPreferredDate) {
          const d = parsePreferredDate(parsedPreferredDate);
          if (d) setScheduledAt(d);
        }
        if (parsedPropertyType) setPropertyType(parsedPropertyType);
        setBedrooms(parsedBedrooms);
        setBathrooms(parsedBathrooms);
        if (parsedPropertySizeSqft) setPropertySizeSqft(parsedPropertySizeSqft);
        if (parsedFrequency) {
          const f = parsedFrequency.toLowerCase();
          if (/week|weekly/i.test(f)) setFrequency('weekly');
          else if (/fortnight|biweek|every 2/i.test(f)) setFrequency('fortnightly');
          else if (/month|monthly/i.test(f)) setFrequency('monthly');
        }
        if (q.notes) setNotes(q.notes);
        const items = q.line_items;
        if (Array.isArray(items) && items.length > 0) {
          setLineItems(
            items.map((row: any) => ({
              id: row.id || crypto.randomUUID(),
              service_id: row.service_id ?? '',
              name: row.name ?? 'Service',
              slug: row.slug ?? '',
              quantity: row.quantity ?? 1,
              unit_price: row.unit_price != null && row.unit_price !== '' ? Number(row.unit_price) : null,
              price_type: row.price_type === 'hourly' ? 'hourly' : 'fixed',
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
              unit_price: Number(q.unit_price) ?? 0,
              price_type: 'fixed' as const,
              total: Number(q.total_price) ?? 0,
            },
          ]);
        }
      } catch {
        // ignore; form stays blank
      } finally {
        setLoadingJob(false);
      }
    })();
  }, [companyId, fromQuoteId, fromJobId]);

  const totalHours = useMemo(() => Math.max(0.5, estimatedHours), [estimatedHours]);

  const suppliesCatalogService = useMemo(
    () => services.find((s) => /provide/i.test(s.name) && /suppl/i.test(s.name)),
    [services],
  );
  const petCatalogService = useMemo(
    () =>
      services.find(
        (s) =>
          s.slug.startsWith('pet_hair_removal_surcharge') ||
          /pet hair removal surcharge/i.test(s.name),
      ),
    [services],
  );

  useEffect(() => {
    setLineItems((prev) => {
      const hasSuppliesLine = prev.some((r) => r.slug === 'cleaning_supplies_provided');
      const hasPetLine = prev.some((r) => r.slug === 'pet_surcharge');
      let next = prev;
      if (provide_supplies && !hasSuppliesLine) {
        const unitPrice = suppliesCatalogService?.base_price ?? 0;
        next = [
          ...next,
          {
            id: crypto.randomUUID(),
            service_id: suppliesCatalogService?.id ?? '',
            name: suppliesCatalogService?.name ?? 'Cleaning supplies (client provides)',
            slug: 'cleaning_supplies_provided',
            quantity: 1,
            unit_price: unitPrice,
            price_type: 'hourly' as const,
            total: Math.round(unitPrice * totalHours * 100) / 100,
          },
        ];
      }
      if (!provide_supplies && hasSuppliesLine) {
        next = next.filter((r) => r.slug !== 'cleaning_supplies_provided');
      }
      if (has_pets && !hasPetLine) {
        const unitPrice = petCatalogService?.base_price ?? 0;
        next = [
          ...next,
          {
            id: crypto.randomUUID(),
            service_id: petCatalogService?.id ?? '',
            name: petCatalogService?.name ?? 'Pet surcharge',
            slug: 'pet_surcharge',
            quantity: 1,
            unit_price: unitPrice,
            price_type: 'fixed' as const,
            total: unitPrice,
          },
        ];
      }
      if (!has_pets && hasPetLine) {
        next = next.filter((r) => r.slug !== 'pet_surcharge');
      }
      return next;
    });
  }, [provide_supplies, has_pets, suppliesCatalogService, petCatalogService, totalHours]);

  const hasAnyHourly = useMemo(
    () => lineItems.some((row) => row.price_type === 'hourly'),
    [lineItems],
  );

  const { estimatedTotal, hasPriceOnRequest } = useMemo(() => {
    let sum = 0;
    let hasPOR = false;
    lineItems.forEach((row) => {
      const t = computeLineTotal(row, totalHours);
      if (t != null) sum += t;
      else hasPOR = true;
    });
    return { estimatedTotal: Math.round(sum * 100) / 100, hasPriceOnRequest: hasPOR };
  }, [lineItems, totalHours]);

  const customTotalNum = useMemo(() => {
    const s = customTotalPrice.trim();
    if (!s) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }, [customTotalPrice]);

  const effectiveTotal = customTotalNum ?? estimatedTotal;
  const useCustomTotal = customTotalNum != null;

  const { staffPay, profit } = useMemo(() => {
    const revenue = effectiveTotal;
    if (staffIds.length === 0) return { staffPay: null as number | null, profit: null as number | null };

    const round2 = (n: number) => Math.round(n * 100) / 100;

    let totalStaffPay: number | null = null;

    // Case 1: Cleaner pay is explicitly set on THIS job (job pay_type is provided).
    if (payType === 'hourly' && payHourlyRate.trim() !== '') {
      const rate = Number(payHourlyRate);
      if (Number.isFinite(rate) && rate >= 0) totalStaffPay = round2(totalHours * rate * staffIds.length);
    } else if (payType === 'percentage' && payPercentage.trim() !== '') {
      const pct = Number(payPercentage);
      if (Number.isFinite(pct) && pct >= 0) {
        // For percentage coming from job settings, backend splits per staff but total still = revenue * pct%
        totalStaffPay = round2(revenue * (pct / 100));
      }
    } else if (payType === 'fixed' && payFixedAmount.trim() !== '') {
      const fixed = Number(payFixedAmount);
      if (Number.isFinite(fixed) && fixed >= 0) {
        // For fixed coming from job settings, backend splits per staff but total still = fixed amount
        totalStaffPay = round2(fixed);
      }
    }

    // Case 2: "Use company default" (no job pay_type sent) => backend resolves per staff:
    //   job pay_type missing -> staff.profile.pay_type if set, otherwise company.default_pay_*
    if (payType === '' && totalStaffPay == null) {
      const companyTypeRaw = companyPay?.default_pay_type ?? 'hourly';
      const companyType = ['hourly', 'percentage', 'fixed'].includes(companyTypeRaw) ? companyTypeRaw : 'hourly';

      const selectedStaff = staffList.filter((s) => staffIds.includes(s.id));
      if (selectedStaff.length === 0) {
        totalStaffPay = null;
      } else {
        let total: number | null = 0;

        for (const s of selectedStaff) {
          if (total == null) break;

          const profileTypeRaw = s.pay_type;
          const resolvedType =
            profileTypeRaw && ['hourly', 'percentage', 'fixed'].includes(profileTypeRaw) ? profileTypeRaw : companyType;

          if (resolvedType === 'hourly') {
            const rateRaw = s.pay_hourly_rate ?? companyPay?.default_hourly_rate;
            if (rateRaw == null) {
              total = null;
              break;
            }
            const rate = Number(rateRaw);
            if (!Number.isFinite(rate) || rate < 0) {
              total = null;
              break;
            }
            total += round2(totalHours * rate);
          } else if (resolvedType === 'percentage') {
            const pctRaw = s.pay_percentage ?? companyPay?.default_pay_percentage;
            if (pctRaw == null) {
              total = null;
              break;
            }
            const pct = Number(pctRaw);
            if (!Number.isFinite(pct) || pct < 0) {
              total = null;
              break;
            }
            total += round2(revenue * (pct / 100));
          } else {
            // fixed
            const fixedRaw = s.pay_fixed_amount ?? companyPay?.default_fixed_pay;
            if (fixedRaw == null) {
              total = null;
              break;
            }
            const fixed = Number(fixedRaw);
            if (!Number.isFinite(fixed) || fixed < 0) {
              total = null;
              break;
            }
            total += round2(fixed);
          }
        }

        totalStaffPay = total != null ? round2(total) : null;
      }
    }

    const profit = totalStaffPay != null ? round2(revenue - totalStaffPay) : null;
    return { staffPay: totalStaffPay, profit };
  }, [
    effectiveTotal,
    payType,
    payHourlyRate,
    payPercentage,
    payFixedAmount,
    totalHours,
    staffIds,
    staffList,
    companyPay,
  ]);

  const addService = (s: CatalogService) => {
    setLineItems((prev) => [...prev, newLineItemFromCatalog(s, totalHours)]);
  };

  const updateLineQuantity = (lineId: string, quantity: number) => {
    const q = Math.max(1, Math.floor(quantity));
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== lineId) return row;
        const total = row.unit_price != null ? computeLineTotal({ ...row, quantity: q }, totalHours) : null;
        return { ...row, quantity: q, total };
      }),
    );
  };

  const removeLineItem = (lineId: string) => {
    setLineItems((prev) => prev.filter((r) => r.id !== lineId));
  };

  const updateLineUnitPrice = (lineId: string, value: number | null) => {
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== lineId) return row;
        const total = value != null ? computeLineTotal({ ...row, unit_price: value }, totalHours) : null;
        return { ...row, unit_price: value, total };
      }),
    );
  };

  const updateLineName = (lineId: string, name: string) => {
    setLineItems((prev) => prev.map((row) => (row.id !== lineId ? row : { ...row, name: name.trim() || row.name })));
  };

  const addCustomLine = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), service_id: '', name: '', slug: 'custom', quantity: 1, unit_price: null, total: null, price_type: 'fixed' as const },
    ]);
  };

  const handlePostcodeLookup = () => {
    const pc = postcode.trim();
    if (!pc) return;
    if (typeof (window as any).google === 'undefined' || !(window as any).google.maps?.Geocoder) {
      setError('Address lookup is loading. Refresh or try again in a moment.');
      return;
    }
    setAddressLookupLoading(true);
    setError(null);
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address: pc }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]) {
        setAddress(results[0].formatted_address);
      } else {
        setError('Address not found for this postcode. Enter address manually.');
      }
      setAddressLookupLoading(false);
    });
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerSearchLower = customerSearch.trim().toLowerCase();
  const filteredCustomers = customerSearchLower
    ? customers.filter(
        (c) =>
          (c.full_name ?? '').toLowerCase().includes(customerSearchLower) ||
          (c.email ?? '').toLowerCase().includes(customerSearchLower) ||
          (c.phone ?? '').replace(/\s/g, '').includes(customerSearch.replace(/\s/g, ''))
      )
    : customers;

  const toggleStaff = (id: string) => {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredStaff = staffList.filter((s) =>
    (s.full_name ?? s.name ?? '').toLowerCase().includes(staffSearch.toLowerCase()),
  );

  const validate = (): string | null => {
    if (!clientName.trim()) return 'Please enter client name';
    if (!address.trim()) return 'Please enter address';
    if (!scheduledAt) return 'Please choose date & start time';
    if (frequency === 'one-off') {
      const hasCustomTotal = customTotalNum != null && customTotalNum >= 0;
      if (lineItems.length === 0 && !hasCustomTotal) return 'Please add at least one service or enter a total price';
      if (hasAnyHourly && totalHours < 2) return 'Minimum 2 hours required for hourly services';
    }
    if (frequency === 'weekly' && repeatDays.length === 0 && scheduledAt) {
      // Allow empty: backend will use start date's weekday only
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!companyId || !scheduledAt) return;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      };

      if (frequency === 'one-off') {
        const hasCustomTotal = customTotalNum != null && customTotalNum >= 0;
        if (lineItems.length === 0 && !hasCustomTotal) {
          setError('Please add at least one service or enter a total price');
          setSubmitting(false);
          return;
        }
        const lineItemsToSend = lineItems.length > 0
          ? lineItems.map((row) => ({
              id: row.id,
              service_id: row.service_id,
              name: row.name,
              slug: row.slug,
              quantity: row.quantity,
              unit_price: row.unit_price,
              price_type: row.price_type,
              total: computeLineTotal(row, totalHours),
            }))
          : [{ id: crypto.randomUUID(), service_id: '', name: 'Custom / Total', slug: 'custom', quantity: 1, unit_price: customTotalNum!, price_type: 'fixed' as const, total: customTotalNum! }];
        const details: Record<string, unknown> = {
          estimated_hours: totalHours,
          line_items: lineItemsToSend,
          estimated_total: effectiveTotal,
        };
        if (property_type) details.property_type = property_type;
        if (RESIDENTIAL_PROPERTY_TYPES.has(property_type)) {
          details.bedrooms = bedrooms;
          details.bathrooms = bathrooms;
        }
        if (COMMERCIAL_PROPERTY_TYPES.has(property_type) && property_size_sqft.trim()) {
          details.property_size_sqft = parseInt(property_size_sqft, 10) || undefined;
        }
        if (key_access) details.key_access = key_access;
        if (key_instructions.trim()) details.key_instructions = key_instructions.trim();
        if (parking) details.parking = parking;
        if (postcode.trim()) details.postcode = postcode.trim();
        details.provide_supplies = provide_supplies;
        details.has_pets = has_pets;
        if (checklistOverride) {
          details.checklist = checklistOverride;
        } else if (selectedChecklistTemplateId) {
          const template = checklistTemplates.find((t) => t.id === selectedChecklistTemplateId);
          if (template) details.checklist = snapshotFromTemplate(template);
        }
        const serviceType = lineItems.length === 1 ? lineItems[0].slug : (lineItems.length > 1 ? 'Multiple' : 'custom');
        const payload: Record<string, unknown> = {
          client_name: clientName.trim(),
          address: address.trim(),
          scheduled_at: scheduledAt.toISOString(),
          notes: notes || undefined,
          staffIds,
          status: 'pending',
          price: String(effectiveTotal.toFixed(2)),
          price_includes_vat: priceIncludesVat,
          service_type: serviceType,
          details,
        };
        if (payType) {
          payload.pay_type = payType;
          if (payType === 'hourly' && payHourlyRate !== '') payload.pay_hourly_rate = Number(payHourlyRate);
          if (payType === 'percentage' && payPercentage !== '') payload.pay_percentage = Number(payPercentage);
          if (payType === 'fixed' && payFixedAmount !== '') payload.pay_fixed_amount = Number(payFixedAmount);
        }
        if (clientPhone.trim()) payload.client_phone = clientPhone.trim();
        if (clientEmail.trim()) payload.client_email = clientEmail.trim();
        if (customerId) payload.customer_id = customerId;

        const jobRes = await Promise.race([
          fetch(apiUrl('/api/jobs'), { method: 'POST', headers, body: JSON.stringify(payload) }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout — try again')), 20000),
          ),
        ]);
        if (!jobRes.ok) {
          const data = await jobRes.json().catch(() => ({}));
          throw new Error((data as any).error || 'Failed to create job');
        }
        const job = await jobRes.json();
        if (createInvoice && job.customer_id) {
          const invoiceLineItems = (details.line_items as Array<{ name?: string; quantity?: number; unit_price?: number | null; total?: number | null }>).map((row) => ({
            description: row.name ?? 'Service',
            quantity: row.quantity ?? 1,
            unit_price: row.unit_price ?? 0,
            amount: Number((row.total ?? 0).toFixed(2)),
          }));
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);
          const invoicePromise = fetch(apiUrl('/api/admin/invoices'), {
            method: 'POST',
            headers,
            body: JSON.stringify({
              customer_id: job.customer_id,
              job_id: job.id,
              line_items: invoiceLineItems,
              due_at: dueDate.toISOString().slice(0, 10),
            }),
          });
          const timeoutMs = 8000;
          try {
            await Promise.race([
              invoicePromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Invoice request timeout')), timeoutMs),
              ),
            ]);
          } catch {
            // Invoice failed or timed out — job is created, redirect anyway
          }
        }
        window.location.href = '/admin/schedule';
        return;
      }

      const repeatType = frequency === 'fortnightly' ? 'biweekly' : frequency === 'custom' ? 'weekly' : frequency;
      const startDate = scheduledAt.toISOString().slice(0, 10);
      const startTime = `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;
      const recurringPayload = {
        job_template_name: clientName.trim(),
        address: address.trim(),
        repeat_type: repeatType,
        repeat_interval: 1,
        start_date: startDate,
        end_date: endDate && endDate.trim() ? endDate.trim() : null,
        start_time: startTime,
        end_time: null,
        preferred_staff_id: staffIds.length > 0 ? staffIds[0] : null,
        repeat_days: (frequency === 'weekly' || frequency === 'custom') && repeatDays.length > 0 ? repeatDays : null,
      };
      const res = await fetch(apiUrl('/api/admin/recurring-job'), {
        method: 'POST',
        headers,
        body: JSON.stringify(recurringPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'Failed to create recurring schedule');
      }
      window.location.href = '/admin/schedule';
    } catch (e: any) {
      setError(e?.message || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExisting = async () => {
    if (!companyId || !fromJobId || !scheduledAt) return;
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const updateLineItems = lineItems.length > 0
        ? lineItems.map((row) => ({
            id: row.id,
            service_id: row.service_id,
            name: row.name,
            slug: row.slug,
            quantity: row.quantity,
            unit_price: row.unit_price,
            price_type: row.price_type,
            total: computeLineTotal(row, totalHours),
          }))
        : [{ id: crypto.randomUUID(), service_id: '', name: 'Custom / Total', slug: 'custom', quantity: 1, unit_price: customTotalNum!, price_type: 'fixed' as const, total: customTotalNum! }];
      const details: Record<string, unknown> = {
        estimated_hours: totalHours,
        line_items: updateLineItems,
        estimated_total: effectiveTotal,
      };
      if (property_type) details.property_type = property_type;
      if (RESIDENTIAL_PROPERTY_TYPES.has(property_type)) {
        details.bedrooms = bedrooms;
        details.bathrooms = bathrooms;
      }
      if (COMMERCIAL_PROPERTY_TYPES.has(property_type) && property_size_sqft.trim()) {
        details.property_size_sqft = parseInt(property_size_sqft, 10) || undefined;
      }
      if (key_access) details.key_access = key_access;
      if (key_instructions.trim()) details.key_instructions = key_instructions.trim();
      if (parking) details.parking = parking;
      if (postcode.trim()) details.postcode = postcode.trim();
      details.provide_supplies = provide_supplies;
      details.has_pets = has_pets;
      if (checklistOverride) {
        details.checklist = checklistOverride;
      } else if (selectedChecklistTemplateId) {
        const template = checklistTemplates.find((t) => t.id === selectedChecklistTemplateId);
        if (template) details.checklist = snapshotFromTemplate(template);
      }
      const serviceType = lineItems.length === 1 ? lineItems[0].slug : (lineItems.length > 1 ? 'Multiple' : 'custom');
      const payload: Record<string, unknown> = {
        client_name: clientName.trim(),
        address: address.trim(),
        scheduled_at: scheduledAt.toISOString(),
        notes: notes || undefined,
        staffIds,
        price: String(effectiveTotal.toFixed(2)),
        price_includes_vat: priceIncludesVat,
        service_type: serviceType,
        details,
      };
      if (payType) {
        payload.pay_type = payType;
        if (payType === 'hourly' && payHourlyRate !== '') payload.pay_hourly_rate = Number(payHourlyRate);
        if (payType === 'percentage' && payPercentage !== '') payload.pay_percentage = Number(payPercentage);
        if (payType === 'fixed' && payFixedAmount !== '') payload.pay_fixed_amount = Number(payFixedAmount);
      }
      if (clientPhone.trim()) payload.client_phone = clientPhone.trim();
      if (clientEmail.trim()) payload.client_email = clientEmail.trim();

      const res = await fetch(apiUrl(`/api/jobs/${fromJobId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'Failed to update job');
      }

      window.location.href = '/admin/schedule';
    } catch (e: any) {
      setError(e?.message || 'Failed to update job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="flex flex-col min-w-0 text-left pb-20">
        <header className="h-24 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">
              Jobs
            </p>
            <h1 className="text-xl md:text-2xl font-black text-slate-50 tracking-tight">
              Add New Job
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              One-off or recurring — build from your service catalog and send to the schedule.
            </p>
          </div>
          <button
            onClick={() => navigate(returnTo === 'invoices' ? '/admin/invoices' : '/admin/schedule')}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-slate-100 text-xs font-bold border border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft size={16} /> {returnTo === 'invoices' ? 'Back to Invoices' : 'Back to schedule'}
          </button>
        </header>

        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loadingJob && (
              <div className="p-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading job details…
              </div>
            )}
            {error && !loadingJob && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/40 text-sm">
                {error}
              </div>
            )}

            {fromJobId && currentJob && !loadingJob && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Receipt className="text-slate-400 shrink-0" size={20} />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</p>
                    {currentJob.invoice ? (
                      <p className="text-sm font-semibold text-slate-100">
                        {currentJob.invoice.invoice_number}
                        <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          currentJob.invoice.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' :
                          currentJob.invoice.status === 'sent' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {currentJob.invoice.status === 'paid' ? 'Paid' : currentJob.invoice.status === 'sent' ? 'Sent' : 'Draft'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">No invoice for this job</p>
                    )}
                  </div>
                </div>
                {currentJob.invoice ? (
                  <button
                    type="button"
                    onClick={() => currentJob.invoice && navigate(`/admin/invoices?invoice=${currentJob.invoice.id}`)}
                    className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-600"
                  >
                    View invoice
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/admin/invoices')}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30"
                  >
                    Create invoice
                  </button>
                )}
              </div>
            )}

            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <ArrowLeft size={18} className="rotate-90 text-emerald-400" /> Client & Address
              </h2>
              <div className="mb-4 relative">
                <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                  Select customer (optional) — search by name, email or phone
                </label>
                <input
                  type="text"
                  value={selectedCustomer ? selectedCustomer.full_name : customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerId('');
                  }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                  placeholder="Search or type below..."
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
                {customerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl z-50">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">No customer found. Type name, email or phone.</div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCustomerId(c.id);
                            setClientName(c.full_name || '');
                            setClientPhone(c.phone || '');
                            setClientEmail(c.email || '');
                            setAddress(c.address || '');
                            setCustomerSearch('');
                            setCustomerDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0 text-sm"
                        >
                          <span className="font-medium text-slate-100">{c.full_name}</span>
                          {(c.email || c.phone) && (
                            <span className="block text-xs text-slate-400 mt-0.5">
                              {[c.email, c.phone].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-300 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Phone:</span> <span>{selectedCustomer.phone || '—'}</span>
                    <span>Email:</span> <span>{selectedCustomer.email || '—'}</span>
                    <span>Address:</span> <span className="col-span-2">{selectedCustomer.address || '—'}</span>
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Client name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    placeholder="e.g. John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Total price <span className="font-normal normal-case text-slate-500 tracking-normal">(add services below or enter the total)</span>
                  </label>
                  <div className="flex flex-wrap items-baseline gap-3 mt-2">
                    <p className="text-3xl font-black text-emerald-400">
                      {useCustomTotal
                        ? `£${effectiveTotal.toFixed(2)}`
                        : hasPriceOnRequest && estimatedTotal === 0
                          ? 'Price TBC'
                          : `£${effectiveTotal.toFixed(2)}`}
                      {!useCustomTotal && hasPriceOnRequest && estimatedTotal > 0 && ' + Price on Request'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-sm font-medium">£</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={customTotalPrice}
                        onChange={(e) => setCustomTotalPrice(e.target.value)}
                        placeholder="Enter total"
                        className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={!priceIncludesVat}
                        onChange={(e) => setPriceIncludesVat(!e.target.checked)}
                        className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                      />
                      <span className="text-sm text-slate-400">Add VAT to invoice (20%)</span>
                    </label>
                    {!priceIncludesVat && effectiveTotal > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Subtotal £{effectiveTotal.toFixed(2)} + 20% VAT = Invoice total £{(effectiveTotal * 1.2).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Client phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    placeholder="07XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Client email (optional)
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    placeholder="client@example.com"
                  />
                </div>
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Postcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                      placeholder="e.g. SW1A 1AA"
                      className="flex-1 border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePostcodeLookup}
                      disabled={addressLookupLoading || !postcode.trim()}
                      className="px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {addressLookupLoading ? '…' : 'Look up'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Enter postcode then choose address.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Address *
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none min-h-[60px]"
                    placeholder="Full address (from lookup or type manually)"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Property details — align with customer online booking */}
            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <Home size={18} className="text-emerald-400" /> Property details
              </h2>
              <div>
                <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Property type</label>
                <select
                  value={property_type}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  <option value="">Select property type (optional)</option>
                  {PROPERTY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {property_type && RESIDENTIAL_PROPERTY_TYPES.has(property_type) && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Bedrooms</label>
                    <select
                      value={bedrooms}
                      onChange={(e) => setBedrooms(Number(e.target.value))}
                      className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Bathrooms</label>
                    <select
                      value={bathrooms}
                      onChange={(e) => setBathrooms(Number(e.target.value))}
                      className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {property_type && COMMERCIAL_PROPERTY_TYPES.has(property_type) && (
                <div className="mt-4">
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Property size (approx sq ft)</label>
                  <input
                    type="number"
                    min={0}
                    value={property_size_sqft}
                    onChange={(e) => setPropertySizeSqft(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
              )}
            </section>

            {/* Access & logistics — align with customer online booking */}
            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <Key size={18} className="text-emerald-400" /> Access & logistics
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-2 uppercase tracking-widest">Key access</label>
                  <div className="space-y-2">
                    {KEY_ACCESS_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${
                          key_access === o.value
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="key_access"
                          value={o.value}
                          checked={key_access === o.value}
                          onChange={() => setKeyAccess(o.value)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{o.label}</span>
                      </label>
                    ))}
                  </div>
                  {(key_access === 'key_safe' || key_access === 'neighbor') && (
                    <div className="mt-3">
                      <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Key instructions (optional)</label>
                      <textarea
                        value={key_instructions}
                        onChange={(e) => setKeyInstructions(e.target.value)}
                        placeholder="e.g. Key safe code, neighbour's flat number"
                        rows={2}
                        className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Parking</label>
                  <select
                    value={parking}
                    onChange={(e) => setParking(e.target.value)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                  >
                    {PARKING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">Postcode (for Congestion/ULEZ)</label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="e.g. SW1A 1AA"
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                </div>
                <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                  <span className="text-sm font-medium text-slate-200">Client will provide cleaning supplies?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={provide_supplies}
                    onClick={() => setProvideSupplies((v) => !v)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${provide_supplies ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        provide_supplies ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={has_pets}
                    onChange={(e) => setHasPets(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span className="text-sm font-medium text-slate-200">Pets (cats/dogs)</span>
                </label>
              </div>
            </section>

            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <CalendarClock size={18} className="text-emerald-400" /> Time & team
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    {frequency === 'one-off' ? 'Date & start time *' : 'Start date & time *'}
                  </label>
                  <DatePicker
                    selected={scheduledAt}
                    onChange={(date: Date | null) => setScheduledAt(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy HH:mm"
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    minDate={new Date()}
                  />
                  {scheduledAt &&
                    (() => {
                      const h = scheduledAt.getHours();
                      const m = scheduledAt.getMinutes();
                      const mins = h * 60 + m;
                      const outsideStandard = mins < 7 * 60 || mins >= 19 * 60;
                      return outsideStandard ? (
                        <p className="text-[10px] text-amber-300 mt-1 font-medium">
                          Outside standard hours (07:00–19:00) — night shift rates may apply.
                        </p>
                      ) : null;
                    })()}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Estimated hours
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value) || 0)}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                  {hasAnyHourly && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Used for hourly services when calculating total.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                  Assign staff {staffIds.length > 0 && (
                    <span className="font-normal normal-case text-emerald-400">({staffIds.length} staff{staffIds.length !== 1 ? 's' : ''} selected)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search staff by name..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none mb-2"
                />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {filteredStaff.map((s) => {
                    const selected = staffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStaff(s.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                          selected
                            ? 'bg-slate-50 border-slate-50 text-slate-900'
                            : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-400'
                        }`}
                      >
                        {s.full_name ?? s.name}
                      </button>
                    );
                  })}
                  {filteredStaff.length === 0 && (
                    <span className="text-[11px] text-slate-500">No staff found</span>
                  )}
                </div>
                <div className="mt-4">
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Cleaner pay (optional)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">How to calculate pay for staff on this job. Leave as default to use company setting.</p>
                  <select
                    value={payType}
                    onChange={(e) => setPayType((e.target.value || '') as '' | 'hourly' | 'percentage' | 'fixed')}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                  >
                    <option value="">Use company default</option>
                    <option value="hourly">Hourly (hours × rate)</option>
                    <option value="percentage">Percentage of job price</option>
                    <option value="fixed">Fixed amount per job</option>
                  </select>
                  {payType === 'hourly' && (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-400">Hourly rate (£)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={payHourlyRate}
                        onChange={(e) => setPayHourlyRate(e.target.value)}
                        className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-950 text-sm text-slate-50 mt-1"
                        placeholder="e.g. 12.50"
                      />
                    </div>
                  )}
                  {payType === 'percentage' && (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-400">Percentage of job price (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={payPercentage}
                        onChange={(e) => setPayPercentage(e.target.value)}
                        className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-950 text-sm text-slate-50 mt-1"
                        placeholder="e.g. 40"
                      />
                    </div>
                  )}
                  {payType === 'fixed' && (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-400">Fixed amount per job (£)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={payFixedAmount}
                        onChange={(e) => setPayFixedAmount(e.target.value)}
                        className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-950 text-sm text-slate-50 mt-1"
                        placeholder="e.g. 50"
                      />
                    </div>
                  )}
                </div>
              </div>
              {checklistTemplates.length > 0 && (
                <div className="mt-4">
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Checklist for this job
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">Staff will see this checklist on the job and tick tasks. Edit = only for this job (Settings stay default).</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedChecklistTemplateId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? e.target.value : null;
                        setSelectedChecklistTemplateId(v);
                        if (!v) setChecklistOverride(null);
                      }}
                      className="flex-1 border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    >
                      <option value="">No checklist</option>
                      {checklistTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const template = checklistTemplates.find((t) => t.id === selectedChecklistTemplateId);
                        const snapshot = checklistOverride ?? (template ? snapshotFromTemplate(template) : null);
                        if (snapshot) {
                          setChecklistEditDraft(snapshot.tasks.map((t) => ({ ...t, completed: false })));
                          setChecklistEditMeta({ template_name: snapshot.template_name, template_id: snapshot.template_id ?? template?.id ?? '' });
                          setChecklistSidebarOpen(true);
                        }
                      }}
                      disabled={!selectedChecklistTemplateId}
                      className="px-4 py-3 rounded-2xl bg-slate-800 border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                      title="Edit checklist for this job only"
                    >
                      <Pencil size={18} /> Edit
                    </button>
                  </div>
                  {checklistOverride && (
                    <p className="text-[10px] text-emerald-400 mt-1">Customised for this job ({checklistOverride.tasks.length} tasks)</p>
                  )}
                </div>
              )}
            </section>

            {/* Repeat / Frequency — next to start date so start & end are together */}
            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <Repeat size={18} className="text-emerald-400" /> Repeat / Frequency
              </h2>
              <div>
                <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'one-off' | 'weekly' | 'fortnightly' | 'monthly' | 'custom')}
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  <option value="one-off">One-off</option>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {frequency !== 'one-off' && (
                <>
                  {(frequency === 'weekly' || frequency === 'custom') && (
                    <div className="mt-4">
                      <label className="block text-[10px] font-black text-slate-300 mb-2 uppercase tracking-widest">
                        Repeat on
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { d: 0, label: 'Sun' },
                          { d: 1, label: 'Mon' },
                          { d: 2, label: 'Tue' },
                          { d: 3, label: 'Wed' },
                          { d: 4, label: 'Thu' },
                          { d: 5, label: 'Fri' },
                          { d: 6, label: 'Sat' },
                        ].map(({ d, label }) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              setRepeatDays((prev) =>
                                prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
                              )
                            }
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                              repeatDays.includes(d)
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Leave empty to use the start date&apos;s weekday only.</p>
                    </div>
                  )}
                  {(frequency === 'fortnightly' || frequency === 'monthly') && (
                    <div className="mt-4">
                      <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                        Repeat on
                      </label>
                      <p className="text-xs text-slate-400">
                        {frequency === 'fortnightly' ? 'Every 2 weeks from the start date.' : 'Same date each month from the start date.'}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                      End date (optional)
                    </label>
                    <input
                      type="date"
                      value={endDate ?? ''}
                      onChange={(e) => setEndDate(e.target.value ? e.target.value : null)}
                      className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">For fixed-term contracts. Leave blank for no end.</p>
                  </div>
                </>
              )}
            </section>

            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <Package size={18} className="text-emerald-400" /> Services & pricing
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                Add services here (name + price) — no need to go to Settings. Or pick from your catalog below.
              </p>
              <button
                type="button"
                onClick={addCustomLine}
                className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30"
              >
                <Plus size={18} /> Add service
              </button>
              {services.length > 0 && (
                <>
                  <p className="text-[10px] text-slate-500 mb-2">Or from catalog:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addService(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-700 hover:border-emerald-500/50"
                      >
                        <span>{s.name}</span>
                        {s.base_price != null && s.base_price > 0 && (
                          <span className="text-emerald-400 text-[11px]">
                            {s.price_type === 'hourly' ? `£${s.base_price}/hr` : `£${s.base_price}`}
                          </span>
                        )}
                        {s.base_price == null && (
                          <span className="text-amber-300 text-[11px]">Price on Request</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineItems((prev) => [...prev, newLineItemFromFallback('night_shift_surcharge', 'Night Shift Surcharge (22:00 – 06:00)')])}
                    className="mb-4 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  >
                    + Night Shift Surcharge (22:00–06:00)
                  </button>
                </>
              )}
              {lineItems.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-300 mb-1 uppercase tracking-widest">
                    Lines (edit name, quantity & price as needed)
                  </label>
                  <ul className="space-y-2">
                    {lineItems.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-700"
                      >
                        {row.slug === 'custom' ? (
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateLineName(row.id, e.target.value)}
                            placeholder="Service name"
                            className="flex-1 min-w-[120px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                          />
                        ) : (
                          <span className="font-medium text-slate-200 flex-1 min-w-0 truncate">
                            {row.name}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) => updateLineQuantity(row.id, Number(e.target.value))}
                            className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-50"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">£</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.unit_price ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLineUnitPrice(row.id, v === '' ? null : parseFloat(v) || 0);
                            }}
                            placeholder="TBC"
                            className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-50"
                          />
                          {row.price_type === 'hourly' && <span className="text-[10px] text-slate-500">/hr</span>}
                        </div>
                        <span className="text-sm text-emerald-400 min-w-[4rem] text-right">
                          {row.unit_price != null
                            ? `£${(computeLineTotal(row, totalHours) ?? 0).toFixed(2)}`
                            : 'TBC'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLineItem(row.id)}
                          className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5">
              <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
                <Users size={18} className="text-emerald-400" /> Internal notes
              </h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes for your team (customer will not see this)."
                rows={3}
                className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </section>

            <div className="sticky bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 p-4 z-20 -mx-4 md:-mx-6">
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-left space-y-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    Total
                  </p>
                  <p className="text-2xl font-black text-emerald-400">
                    {useCustomTotal
                      ? `£${effectiveTotal.toFixed(2)}`
                      : hasPriceOnRequest && estimatedTotal === 0
                        ? 'Price TBC'
                        : `£${effectiveTotal.toFixed(2)}`}
                    {!useCustomTotal && hasPriceOnRequest && estimatedTotal > 0 && ' + Price on Request'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {!priceIncludesVat && effectiveTotal > 0
                      ? `Subtotal £${effectiveTotal.toFixed(2)} + 20% VAT = Invoice total £${(effectiveTotal * 1.2).toFixed(2)}`
                      : useCustomTotal
                        ? 'Custom total'
                        : `${lineItems.length} service${lineItems.length !== 1 ? 's' : ''} · ${totalHours} hrs`}
                  </p>
                  {effectiveTotal > 0 && (
                    <div className="pt-2 mt-2 border-t border-slate-700/80 text-xs">
                      <div className="flex justify-between gap-4 text-slate-300">
                        <span>Job revenue</span>
                        <span>£{effectiveTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4 text-slate-400 mt-0.5">
                        <span>Staff pay</span>
                        <span>{staffPay != null ? `£${staffPay.toFixed(2)}` : '— (company default)'}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-bold text-slate-100 mt-1">
                        <span>Profit</span>
                        <span className={profit != null ? (profit >= 0 ? 'text-emerald-400' : 'text-amber-400') : ''}>
                          {profit != null ? `£${profit.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {frequency === 'one-off' && !fromJobId && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createInvoice}
                      onChange={(e) => setCreateInvoice(e.target.checked)}
                      disabled={!customerId && !clientPhone.trim()}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                    />
                    <span className="text-sm font-medium text-slate-200">
                      Also create draft invoice
                      {!customerId && !clientPhone.trim() && (
                        <span className="block text-xs text-slate-500 mt-0.5">Select a customer or enter client phone first</span>
                      )}
                    </span>
                  </label>
                )}
                {fromJobId ? (
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleUpdateExisting}
                      disabled={submitting}
                      className="flex-1 px-6 py-3 rounded-2xl font-black bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
                    >
                      {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                      Update this job
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-6 py-3 rounded-2xl font-black bg-slate-800 text-slate-50 hover:bg-slate-700 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Create new job
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto px-8 py-3 rounded-2xl font-black bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
                  >
                    {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                    Create job & go to schedule
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Checklist edit sidebar — for this job only, does not change Settings default */}
        {checklistSidebarOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setChecklistSidebarOpen(false)}>
            <div
              className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-black text-slate-50">Edit checklist for this job</h3>
                <button type="button" onClick={() => setChecklistSidebarOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-slate-500 px-4 py-2 border-b border-slate-800">
                Changes apply only to this job. Settings checklist stays the default for new jobs.
              </p>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {checklistEditDraft.map((task, index) => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-700">
                    <span className="text-slate-500 text-sm w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={task.label}
                      onChange={(e) =>
                        setChecklistEditDraft((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, label: e.target.value } : t))
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                      placeholder="Task"
                    />
                    <button
                      type="button"
                      onClick={() => setChecklistEditDraft((prev) => prev.filter((t) => t.id !== task.id))}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setChecklistEditDraft((prev) => [
                      ...prev,
                      {
                        id: `edit-${Date.now()}`,
                        label: '',
                        order: prev.length,
                        completed: false,
                      },
                    ])
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 text-sm font-bold"
                >
                  <Plus size={18} /> Add task
                </button>
              </div>
              <div className="p-4 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setChecklistSidebarOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tasks = checklistEditDraft
                      .filter((t) => t.label.trim())
                      .map((t, i) => ({ ...t, label: t.label.trim(), order: i, completed: false }));
                    setChecklistOverride({
                      template_name: checklistEditMeta.template_name,
                      template_id: checklistEditMeta.template_id,
                      tasks,
                    });
                    setChecklistSidebarOpen(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm hover:bg-emerald-400"
                >
                  Save & use for this job
                </button>
              </div>
            </div>
          </div>
        )}

        <AdminBottomNav />
      </main>
    </div>
  );
}




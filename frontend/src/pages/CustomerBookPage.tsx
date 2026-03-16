import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth, customerAuthHeaders } from '../context/CustomerAuthContext';
import { apiUrl } from '../lib/api';
import { formatDateUK } from '../lib/dateFormat';
import { CatalogService, LineItem, newLineItemFromCatalog, newLineItemFromFallback, computeLineTotal } from '../lib/pricing';
import { ArrowLeft, Loader2, Check, Home, Clock, Key, Package, PawPrint, Sparkles, Plus, Trash2 } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const BASE_RATE_PER_HOUR = 20;
const DEFAULT_SUPPLIES_EXTRA_PER_HOUR = 5;
const ULEZ_CENTRAL_LONDON_SURCHARGE = 15;
const DEFAULT_PET_HAIR_FEE_PERCENT = 10;

/** UK Central London (Zone 1) postcode areas: Congestion/ULEZ surcharge applies */
const CENTRAL_LONDON_POSTCODE_PREFIXES = /^(EC[1-4]|WC[12]|W1[ABDN]?|W2|SW1[ABEHMNPRVXY]?|SW3|SW5|SW7|SW10|NW1|N1|SE1)\s/i;

function isCentralLondonPostcode(postcode: string): boolean {
  const normalized = String(postcode).trim().toUpperCase().replace(/\s+/g, ' ');
  return CENTRAL_LONDON_POSTCODE_PREFIXES.test(normalized);
}


/** Fallback when company has no catalog */
const FALLBACK_SERVICE_OPTIONS = [
  { value: 'regular_domestic_clean', label: 'Regular Domestic Clean' },
  { value: 'end_of_tenancy', label: 'End of Tenancy' },
  { value: 'deep_clean', label: 'Deep Clean / Spring Clean' },
  { value: 'oven_degreasing', label: 'Professional Oven Degreasing' },
  { value: 'steam_carpet', label: 'Steam Carpet Cleaning' },
  { value: 'internal_windows', label: 'Internal Windows' },
  { value: 'limescale_treatment', label: 'Limescale Treatment' },
  { value: 'rubbish_removal', label: 'Rubbish Removal' },
  { value: 'other', label: 'Other' },
];

const PARKING_OPTIONS = [
  { value: 'visitor_permit', label: 'Visitor parking permit provided' },
  { value: 'paid_street', label: 'Paid street parking available' },
  { value: 'no_parking', label: 'No parking (surcharge may apply)' },
];

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

const RESIDENTIAL_PROPERTY_TYPES = new Set([
  'flat',
  'terraced',
  'semi_detached',
  'detached',
  'studio',
  'hmo',
]);

const COMMERCIAL_PROPERTY_TYPES = new Set([
  'office',
  'shop',
  'restaurant',
]);

const ARRIVAL_WINDOWS = [
  { value: 'morning', label: 'Morning 08:00–11:00', start: '08:00', end: '11:00' },
  { value: 'afternoon', label: 'Afternoon 12:00–15:00', start: '12:00', end: '15:00' },
  { value: 'late_afternoon', label: 'Late afternoon 15:00–18:00', start: '15:00', end: '18:00' },
  { value: 'evening', label: 'Evening 18:00–21:00', start: '18:00', end: '21:00' },
  { value: 'night_shift', label: 'Night shift 21:00–overnight', start: '21:00', end: '06:00' },
];

const KEY_ACCESS_OPTIONS = [
  { value: 'i_will_be_home', label: 'I will be home' },
  { value: 'key_safe', label: 'Key safe / Hidden key' },
  { value: 'neighbor', label: 'Pick up key from neighbor' },
];

const EXTRAS = [
  { id: 'oven_cleaning', label: 'Oven cleaning', extraHours: 1 },
  { id: 'inside_windows', label: 'Internal windows', extraHours: 0.5 },
  { id: 'fridge_cleaning', label: 'Fridge cleaning', extraHours: 0.5 },
  { id: 'ironing', label: 'Ironing', extraHours: 0 },
  { id: 'rubbish_removal', label: 'Rubbish removal', extraHours: 0.5 },
];

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const h = 2 + i * 0.5;
  return { value: h, label: `${h} hrs` };
});

function timeStringToToday(time: string): Date {
  const [h, m] = time.split(':').map((v) => Number(v) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function CustomerBookPage() {
  const navigate = useNavigate();
  const { token, customer, companyId } = useCustomerAuth();
  const [companyName, setCompanyName] = useState<string>('');
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  const [preferred_date, setPreferredDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [preferred_staff_ids, setPreferredStaffIds] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [property_type, setPropertyType] = useState('');
  const [property_size_sqft, setPropertySizeSqft] = useState('');
  const [minHours] = useState(2);
  const [estimated_hours, setEstimatedHours] = useState(2);
  const [arrival_window, setArrivalWindow] = useState('morning');
  const [arrival_time, setArrivalTime] = useState('');
  const [key_access, setKeyAccess] = useState('i_will_be_home');
  const [parking, setParking] = useState('visitor_permit');
  const [postcode, setPostcode] = useState('');
  const [provide_supplies, setProvideSupplies] = useState(false);
  const [has_pets, setHasPets] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [petSurchargeMessage, setPetSurchargeMessage] = useState(false);
  const [key_instructions, setKeyInstructions] = useState('');

  const totalHours = useMemo(() => {
    let h = estimated_hours;
    extras.forEach((id) => {
      const ex = EXTRAS.find((e) => e.id === id);
      if (ex) h += ex.extraHours;
    });
    return h;
  }, [estimated_hours, extras]);

  const ulezSurcharge = useMemo(
    () => (postcode && isCentralLondonPostcode(postcode) ? ULEZ_CENTRAL_LONDON_SURCHARGE : 0),
    [postcode],
  );

  // Supplies / Pet surcharge prices from service catalog (configurable)
  const suppliesConfigService = useMemo(
    () =>
      catalogServices.find(
        (s) => /provide/i.test(s.name) && /suppl/i.test(s.name),
      ),
    [catalogServices],
  );
  const suppliesExtraPerHour =
    suppliesConfigService?.base_price ?? DEFAULT_SUPPLIES_EXTRA_PER_HOUR;

  const petConfigService = useMemo(
    () =>
      catalogServices.find(
        (s) =>
          s.slug.startsWith('pet_hair_removal_surcharge') ||
          /pet hair removal surcharge/i.test(s.name),
      ),
    [catalogServices],
  );
  const petHairFeePercent =
    petConfigService?.base_price ?? DEFAULT_PET_HAIR_FEE_PERCENT;

  const { totalFromLines, hasPriceOnRequest } = useMemo(() => {
    let sum = 0;
    let hasPOR = false;
    lineItems.forEach((row) => {
      const t = computeLineTotal(row, totalHours);
      if (t != null) sum += t;
      else hasPOR = true;
    });
    return { totalFromLines: Math.round(sum * 100) / 100, hasPriceOnRequest: hasPOR };
  }, [lineItems, totalHours]);

  const estimatedTotal = useMemo(() => {
    const suppliesAmount = provide_supplies ? totalHours * suppliesExtraPerHour : 0;
    const subtotalBeforePets = totalFromLines + suppliesAmount + ulezSurcharge;
    const petFee = has_pets ? subtotalBeforePets * (petHairFeePercent / 100) : 0;
    return Math.round((subtotalBeforePets + petFee) * 100) / 100;
  }, [
    totalFromLines,
    provide_supplies,
    totalHours,
    has_pets,
    ulezSurcharge,
    suppliesExtraPerHour,
    petHairFeePercent,
  ]);

  useEffect(() => {
    if (!token) {
      navigate('/customer/login');
      return;
    }
    if (companyId) {
      fetch(apiUrl(`/api/booking/company/${companyId}/booking-info`))
        .then((r) => r.json())
        .then((data) => {
          if (data?.company?.name) setCompanyName(data.company.name);
          const services = Array.isArray(data?.services) ? data.services : [];
          setCatalogServices(services);
          if (services.length === 0 && lineItems.length === 0) {
            setLineItems([newLineItemFromFallback('regular_domestic_clean', 'Regular Domestic Clean')]);
          }
        })
        .catch(() => {});
      fetch(apiUrl(`/api/booking/company/${companyId}/staff`))
        .then((r) => r.json())
        .then((data) => setStaffList(Array.isArray(data) ? data : []))
        .catch(() => setStaffList([]));
    }
  }, [token, companyId, navigate]);

  useEffect(() => {
    if (!has_pets) {
      setPetSurchargeMessage(false);
      return;
    }
    if (catalogServices.length === 0) return;
    const petService = catalogServices.find(
      (s) =>
        /pet/i.test(s.name) &&
        !s.slug.startsWith('pet_hair_removal_surcharge'),
    );
    if (!petService) return;
    const alreadyAdded = lineItems.some((l) => l.service_id === petService.id);
    if (!alreadyAdded) {
      setLineItems((prev) => [...prev, newLineItemFromCatalog(petService, totalHours)]);
      setPetSurchargeMessage(true);
    }
  }, [has_pets, catalogServices, totalHours, lineItems]);

  const toggleExtra = (id: string) => {
    setExtras((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const hasAnyHourlyService = useMemo(
    () => lineItems.some((row) => row.price_type === 'hourly'),
    [lineItems]
  );

  const validate = (): string | null => {
    if (!preferred_date) return 'Please select a date';
    if (lineItems.length === 0) return 'Please add at least one service';
    if (hasAnyHourlyService && estimated_hours < minHours) return `Minimum ${minHours} hours required`;
    if (!address.trim()) return 'Please enter the address';
    if (bedrooms < 0 || bedrooms > 10) return 'Invalid number of bedrooms';
    if (bathrooms < 0 || bathrooms > 6) return 'Invalid number of bathrooms';
    return null;
  };

  const addServiceFromCatalog = (s: CatalogService) => {
    setLineItems((prev) => [...prev, newLineItemFromCatalog(s, totalHours)]);
  };

  const addServiceFromFallback = (value: string, label: string) => {
    setLineItems((prev) => [...prev, newLineItemFromFallback(value, label)]);
  };

  const updateLineQuantity = (lineId: string, quantity: number) => {
    const q = Math.max(1, Math.floor(quantity));
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== lineId) return row;
        const total = row.unit_price != null
          ? row.price_type === 'hourly'
            ? Math.round(q * row.unit_price * totalHours * 100) / 100
            : Math.round(q * row.unit_price * 100) / 100
          : null;
        return { ...row, quantity: q, total };
      })
    );
  };

  const removeLineItem = (lineId: string) => {
    setLineItems((prev) => prev.filter((r) => r.id !== lineId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/customer/bookings'), {
        method: 'POST',
        headers: customerAuthHeaders(token),
        body: JSON.stringify({
          preferred_date,
          service_type: lineItems.length === 1 ? lineItems[0].slug : 'Multiple',
          preferred_staff_id: preferred_staff_ids[0] || undefined,
          address: address || undefined,
          notes: notes || undefined,
          details: {
            bedrooms,
            bathrooms,
            property_type,
            property_size_sqft: property_size_sqft || undefined,
            estimated_hours,
            arrival_window,
            arrival_time: arrival_time || undefined,
            key_access,
            key_instructions: key_instructions || undefined,
            parking,
            postcode: postcode || undefined,
            ulez_surcharge: ulezSurcharge || undefined,
            provide_supplies,
            has_pets,
            extras,
            estimated_total: estimatedTotal,
            preferred_staff_ids: preferred_staff_ids.length ? preferred_staff_ids : undefined,
            line_items: lineItems.map((row) => ({
              id: row.id,
              service_id: row.service_id,
              name: row.name,
              slug: row.slug,
              quantity: row.quantity,
              unit_price: row.unit_price,
              price_type: row.price_type,
              total: computeLineTotal(row, totalHours),
            })),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Booking failed');
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!customer) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-50">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/40">
          <Check className="w-8 h-8 text-emerald-300" />
        </div>
        <h1 className="text-2xl font-black text-slate-50 mb-2">Booking requested</h1>
        <p className="text-slate-400 text-center mb-8 max-w-md">
          Your cleaning company has been notified. No payment is required for this demo.
        </p>
        <button
          onClick={() => navigate('/customer')}
          className="py-3 px-6 rounded-2xl font-black bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/40"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-32">
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 p-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/customer')}
          className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100 font-medium px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h1 className="text-xl font-black text-slate-50 mt-3">New booking</h1>
        {companyName && (
          <p className="text-sm text-emerald-300 mt-1">Booking with: <strong>{companyName}</strong></p>
        )}
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <form id="booking-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Property Details */}
          <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
              <Home size={18} className="text-emerald-400" /> Property details
            </h2>
            <div className="mt-1">
              <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Property type</label>
              <select
                value={property_type}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
              >
                <option value="">Select property type</option>
                {PROPERTY_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {property_type && RESIDENTIAL_PROPERTY_TYPES.has(property_type) && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Bedrooms</label>
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
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Bathrooms</label>
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
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Property size (approx sq ft)</label>
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
            {!property_type && (
              <p className="mt-3 text-xs text-slate-500">
                We&apos;ll ask for bedrooms, bathrooms or size after you choose the property type.
              </p>
            )}
          </section>

          {/* Time & Duration */}
          <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
              <Clock size={18} className="text-emerald-400" /> Time & duration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Preferred date *</label>
                <DatePicker
                  selected={preferred_date ? new Date(preferred_date) : null}
                  onChange={(date: Date | null) =>
                    setPreferredDate(date ? date.toISOString().slice(0, 10) : '')
                  }
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
                {preferred_date && (
                  <p className="mt-1 text-xs text-slate-400">Selected: {formatDateUK(preferred_date)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Arrival time window</label>
                <select
                  value={arrival_window}
                  onChange={(e) => setArrivalWindow(e.target.value)}
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  {ARRIVAL_WINDOWS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Preferred arrival time (optional)</label>
                <DatePicker
                  selected={arrival_time ? timeStringToToday(arrival_time) : null}
                  onChange={(date: Date | null) =>
                    setArrivalTime(date ? date.toTimeString().slice(0, 5) : '')
                  }
                  showTimeSelect
                  showTimeSelectOnly
                  timeFormat="HH:mm"
                  timeIntervals={30}
                  dateFormat="HH:mm"
                  placeholderText="HH:mm"
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">24-hour clock · 30-minute steps.</p>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">
                  Estimated hours (min {minHours})
                </label>
                {hasAnyHourlyService ? (
                  <select
                    value={estimated_hours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                  >
                    {HOUR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Fixed-price booking — hours are for reference only and set by your cleaning company.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* UK Logistics */}
          <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
              <Key size={18} className="text-emerald-400" /> Access & logistics
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-2 uppercase tracking-widest">Key access</label>
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
                    <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">
                      Where will the key be? (optional)
                    </label>
                    <textarea
                      value={key_instructions}
                      onChange={(e) => setKeyInstructions(e.target.value)}
                      placeholder="e.g. Key safe code, neighbour’s flat number, or other access notes"
                      rows={2}
                      className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Provide cleaning supplies?</span>
                  <span className="text-xs text-emerald-400">
                    (+£{suppliesExtraPerHour}/hr set by your cleaning company)
                  </span>
                </div>
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
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Parking</label>
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
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Postcode (for Congestion/ULEZ)</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  placeholder="e.g. SW1A 1AA"
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
                {ulezSurcharge > 0 && (
                  <p className="mt-1 text-xs text-amber-300">Central London (Zone 1): £{ULEZ_CENTRAL_LONDON_SURCHARGE} Congestion/ULEZ surcharge applied.</p>
                )}
              </div>
              <label className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                <PawPrint size={18} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-200">Do you have pets? (Cats/Dogs)</span>
                <input
                  type="checkbox"
                  checked={has_pets}
                  onChange={(e) => setHasPets(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                />
                {has_pets && (
                  <span className="text-xs text-emerald-400">
                    Default {petHairFeePercent}% pet hair removal fee may apply (set by your cleaning company).
                  </span>
                )}
                {petSurchargeMessage && (
                  <span className="w-full text-xs text-amber-300 mt-1">We&apos;ve added a Pet Surcharge based on your selection.</span>
                )}
              </label>
            </div>
          </section>

          {/* Extras removed: covered by Services section below */}

          {/* Services (multi-select from catalog) */}
          <section className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <h2 className="flex items-center gap-2 font-black text-slate-50 mb-4 text-sm uppercase tracking-widest">
              <Package size={18} className="text-emerald-400" /> Services
            </h2>
            <div className="space-y-4">
              {catalogServices.length > 0 ? (
                <>
                  <p className="text-xs text-slate-400 mb-2">Add one or more services from the list below.</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {catalogServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addServiceFromCatalog(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-700 hover:border-emerald-500/50"
                      >
                        <Plus size={14} /> {s.name}
                        {s.base_price != null && s.base_price > 0 && (
                          <span className="text-emerald-400 text-xs">
                            {s.price_type === 'hourly' ? `£${s.base_price}/hr` : `£${s.base_price}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Add service type</label>
                  <select
                    className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        const o = FALLBACK_SERVICE_OPTIONS.find((x) => x.value === v);
                        if (o) addServiceFromFallback(o.value, o.label);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Choose to add…</option>
                    {FALLBACK_SERVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {lineItems.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2 uppercase tracking-widest">Selected services</label>
                  <ul className="space-y-2">
                    {lineItems.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-700"
                      >
                        <span className="font-medium text-slate-200 flex-1 min-w-0 truncate">{row.name}</span>
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
                        <span className="text-sm text-emerald-400">
                          {row.unit_price != null
                            ? row.price_type === 'hourly'
                              ? `£${row.unit_price}/hr`
                              : `£${(computeLineTotal(row, totalHours) ?? 0).toFixed(2)}`
                            : 'Price TBC'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLineItem(row.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          aria-label="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {staffList.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Preferred staff (optional)</label>
                  <p className="text-[11px] text-slate-500 mb-2">You can choose more than one preferred cleaner.</p>
                  <div className="flex flex-wrap gap-2">
                    {staffList.map((s) => {
                      const selected = preferred_staff_ids.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setPreferredStaffIds((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            )
                          }
                          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                            selected
                              ? 'bg-slate-800 border-slate-800 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-400'
                          }`}
                        >
                          {s.full_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Service address"
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1 uppercase tracking-widest">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions"
                  rows={3}
                  className="w-full border border-slate-800 rounded-2xl px-4 py-3 bg-slate-950 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/40 text-sm">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            This is a demo booking. No real payment will be taken. Your company will be notified.
          </p>
          <p className="text-xs text-slate-500 mt-2 italic">
            Kindly note: Final price is subject to parking availability and property condition.
          </p>
        </form>
      </div>

      {/* Sticky bottom summary bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 p-4 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Estimated total</p>
            <p className="text-2xl font-black text-emerald-400">
              {hasPriceOnRequest && totalFromLines === 0 ? 'Price TBC' : `£${estimatedTotal.toFixed(2)}`}
              {hasPriceOnRequest && totalFromLines > 0 && ' + Price on Request for certain items'}
            </p>
            {hasPriceOnRequest && (
              <p className="text-xs text-amber-300 mt-0.5">The company will provide a full quote shortly.</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {lineItems.length} service{lineItems.length !== 1 ? 's' : ''} · {totalHours} hrs
              {provide_supplies && ` · supplies £${suppliesExtraPerHour}/hr`}
              {has_pets && ` · ${petHairFeePercent}% pet fee`}
              {ulezSurcharge > 0 && ` · £${ulezSurcharge} ULEZ`}
            </p>
          </div>
          <button
            type="submit"
            form="booking-form"
            disabled={loading}
            className="py-3 px-8 rounded-2xl font-black bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            Request quote
          </button>
        </div>
      </div>

    </div>
  );
}

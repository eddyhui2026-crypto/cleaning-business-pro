import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Loader2, X, Plus, Download } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { PageHeader } from '../components/PageHeader';
import { HelpLink } from '../components/HelpLink';
import { HelpAnchor } from '../config/helpAnchors';

const SUGGESTED_EXTRAS = [
  { name: 'Inside Fridge', base_price: 15, price_type: 'fixed' as const },
  { name: 'Internal Windows', base_price: 20, price_type: 'fixed' as const },
  { name: 'Ironing Service', base_price: 18, price_type: 'hourly' as const },
];

interface AdminServicesPageProps {
  companyId: string | null;
}

interface CompanyService {
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

export function AdminServicesPage({ companyId }: AdminServicesPageProps) {
  const toast = useToast();
  const [services, setServices] = useState<CompanyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', price_type: 'fixed' as 'hourly' | 'fixed', base_price: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [importingUk, setImportingUk] = useState(false);
  const [addingExtraId, setAddingExtraId] = useState<string | null>(null);
  const [ensuringBookingDefaults, setEnsuringBookingDefaults] = useState(false);

  const fetchServices = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services'), {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const list = await res.json().catch(() => []);
      setServices(Array.isArray(list) ? list : []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchServices();
  }, [companyId]);

  const handleBasePriceChange = async (serviceId: string, value: string) => {
    const num = value.trim() === '' ? null : parseFloat(value);
    const basePrice = num === null || Number.isNaN(num) || num === 0 ? null : num;
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, base_price: basePrice } : s)));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/services/${serviceId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ base_price: basePrice }),
      });
      if (!res.ok) toast.error('Failed to update price');
    } catch {
      toast.error('Failed to update price');
    }
  };

  const handleDelete = async (serviceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/services/${serviceId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      toast.success('Service successfully deleted.');
    } catch {
      toast.error('Could not delete service');
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast.error('Please enter a service name.');
      return;
    }
    setAddSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description.trim() || null,
          price_type: addForm.price_type,
          base_price: addForm.base_price === '' ? null : parseFloat(addForm.base_price) || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as any).error || 'Failed to add service');
        setAddSaving(false);
        return;
      }
      setServices((prev) => [...prev, data]);
      setAddOpen(false);
      setAddForm({ name: '', description: '', price_type: 'fixed', base_price: '' });
      toast.success('Service added.');
    } catch {
      toast.error('Failed to add service');
    }
    setAddSaving(false);
  };

  const handleImportUkStandard = async () => {
    setImportingUk(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services/import-uk-standard'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as any).error || 'Import failed');
        return;
      }
      toast.success('UK Standard services imported successfully!');
      await fetchServices();
    } catch {
      toast.error('Import failed');
    } finally {
      setImportingUk(false);
    }
  };

  const handleAddSuggestedExtra = async (extra: typeof SUGGESTED_EXTRAS[0]) => {
    const id = extra.name;
    setAddingExtraId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name: extra.name,
          description: null,
          price_type: extra.price_type,
          base_price: extra.base_price,
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((created as any).error || 'Failed to add');
        return;
      }
      setServices((prev) => [...prev, created]);
      toast.success(`Added ${extra.name}`);
    } catch {
      toast.error('Failed to add');
    } finally {
      setAddingExtraId(null);
    }
  };

  const hasBookingSupplies = services.some(
    (s) => s.slug === 'provide_cleaning_supplies_per_hour' || (/provide/i.test(s.name) && /suppl/i.test(s.name)),
  );
  const hasBookingPet = services.some(
    (s) =>
      s.slug.startsWith('pet_hair_removal_surcharge') ||
      /pet hair removal surcharge/i.test(s.name),
  );
  const missingBookingDefaults = !hasBookingSupplies || !hasBookingPet;

  const handleEnsureBookingDefaults = async () => {
    setEnsuringBookingDefaults(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl('/api/admin/services/ensure-booking-defaults'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as any).error || 'Failed to add');
        return;
      }
      toast.success('Default booking options added. Set prices below.');
      await fetchServices();
    } catch {
      toast.error('Failed to add booking options');
    } finally {
      setEnsuringBookingDefaults(false);
    }
  };

  const suppliesConfigService = services.find(
    (s) => s.slug === 'provide_cleaning_supplies_per_hour' || (/provide/i.test(s.name) && /suppl/i.test(s.name)),
  );
  const petConfigService = services.find(
    (s) =>
      s.slug.startsWith('pet_hair_removal_surcharge') ||
      /pet hair removal surcharge/i.test(s.name),
  );

  const sortedServices = [...services].sort((a, b) => {
    const rank = (s: CompanyService) => {
      if (suppliesConfigService && s.id === suppliesConfigService.id) return 0;
      if (petConfigService && s.id === petConfigService.id) return 1;
      return 2;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.display_order - b.display_order;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 lg:pb-8">
      <PageHeader
        title="Service catalog"
        subtitle="Manage services and base prices. Changes sync to the Quote Editor and customer booking."
        backTo="/dashboard"
        backLabel="Dashboard"
        variant="dark"
        action={<HelpLink anchor={HelpAnchor.Services} />}
      />
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-sm mb-4">
          Set a base price per service. Leave blank or 0 for &quot;Price on Request&quot; (shown as Price TBC in quotes).
        </p>
        {missingBookingDefaults && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30">
            <p className="text-sm font-medium text-emerald-200 mb-2">
              Add default booking options (shown at top). Customers see &quot;Provide cleaning supplies?&quot; and &quot;Do you have pets?&quot; — you set the prices here.
            </p>
            <button
              type="button"
              onClick={handleEnsureBookingDefaults}
              disabled={ensuringBookingDefaults}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50"
            >
              {ensuringBookingDefaults ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Add Provide cleaning supplies &amp; Pet surcharge
            </button>
          </div>
        )}
        {services.length === 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30">
            <p className="text-sm font-medium text-amber-200 mb-3">Import the UK standard price list in one click.</p>
            <button
              type="button"
              onClick={handleImportUkStandard}
              disabled={importingUk}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-50"
            >
              {importingUk ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Import UK Standard Price List
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-medium hover:bg-emerald-500/30"
        >
          <Plus size={18} /> Add service
        </button>
        {addOpen && (
          <form onSubmit={handleAddService} className="mb-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-3">
            <h3 className="font-bold text-slate-50">New cleaning item</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name *</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Oven degreasing"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price type</label>
              <select
                value={addForm.price_type}
                onChange={(e) => setAddForm((f) => ({ ...f, price_type: e.target.value as 'hourly' | 'fixed' }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 focus:ring-2 focus:ring-emerald-400 outline-none"
              >
                <option value="fixed">Fixed price</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base price (£) — leave blank for Price on Request</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={addForm.base_price}
                onChange={(e) => setAddForm((f) => ({ ...f, base_price: e.target.value }))}
                placeholder="e.g. 75"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addSaving} className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 disabled:opacity-50">
                {addSaving ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : services.length === 0 ? (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
            <p>No services in your catalog yet.</p>
            <p className="text-sm mt-2">Use &quot;Import UK Standard Price List&quot; above or add your own.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedServices.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-slate-50">{s.name}</span>
                  {s.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 sr-only">Base price (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={s.base_price ?? ''}
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((x) =>
                          x.id === s.id
                            ? { ...x, base_price: e.target.value === '' ? null : parseFloat(e.target.value) || null }
                            : x
                        )
                      )
                    }
                    onBlur={(e) => handleBasePriceChange(s.id, e.target.value)}
                    placeholder="Price on Request"
                    className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                  <span className="text-slate-500 text-xs">£</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                  title="Delete service"
                  aria-label="Delete service"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>

        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-700">
            <h3 className="text-sm font-bold text-slate-200 mb-2">Suggested Extras</h3>
            <p className="text-xs text-slate-500 mb-4">Add these to your catalog with one click.</p>
            <ul className="space-y-2">
              {SUGGESTED_EXTRAS.map((extra) => {
                const alreadyAdded = services.some((s) => s.name.toLowerCase() === extra.name.toLowerCase());
                return (
                  <li key={extra.name} className="flex items-center justify-between gap-2 py-2 border-b border-slate-700 last:border-0">
                    <span className="text-sm text-slate-300">
                      {extra.name} ({extra.price_type === 'hourly' ? `£${extra.base_price}/hr` : `£${extra.base_price}`})
                    </span>
                    <button
                      type="button"
                      onClick={() => !alreadyAdded && handleAddSuggestedExtra(extra)}
                      disabled={alreadyAdded || addingExtraId === extra.name}
                      className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title={alreadyAdded ? 'Already in catalog' : 'Add to catalog'}
                    >
                      {addingExtraId === extra.name ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
      <AdminBottomNav />
    </div>
  );
}

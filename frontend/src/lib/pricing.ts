// Shared pricing helpers for services/line items

export interface CatalogService {
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

export interface LineItem {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  quantity: number;
  unit_price: number | null;
  price_type: 'hourly' | 'fixed';
  total: number | null;
}

export function newLineItemFromCatalog(s: CatalogService, totalHours: number): LineItem {
  const qty = 1;
  const up = s.base_price ?? null;
  const pt = (s.price_type === 'hourly' ? 'hourly' : 'fixed') as 'hourly' | 'fixed';
  let total: number | null = null;
  if (up != null) {
    total = pt === 'hourly' ? Math.round(qty * up * totalHours * 100) / 100 : Math.round(qty * up * 100) / 100;
  }
  return {
    id: crypto.randomUUID(),
    service_id: s.id,
    name: s.name,
    slug: s.slug,
    quantity: qty,
    unit_price: up,
    price_type: pt,
    total,
  };
}

export function newLineItemFromFallback(value: string, label: string): LineItem {
  return {
    id: crypto.randomUUID(),
    service_id: '',
    name: label,
    slug: value,
    quantity: 1,
    unit_price: null,
    price_type: 'fixed',
    total: null,
  };
}

export function computeLineTotal(row: LineItem, totalHours: number): number | null {
  const u = row.unit_price;
  if (u == null || !Number.isFinite(u)) return null;
  const q = Math.max(0, row.quantity);
  if (row.price_type === 'hourly') return Math.round(q * u * totalHours * 100) / 100;
  return Math.round(q * u * 100) / 100;
}


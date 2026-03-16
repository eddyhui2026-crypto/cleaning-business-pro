/**
 * UK Standard Service Catalog — seed data for one-click import.
 * Used by POST /api/admin/services/import-uk-standard to populate company_services.
 */

export interface UKStandardServiceSeed {
  name: string;
  slug: string;
  description: string | null;
  price_type: 'hourly' | 'fixed';
  base_price: number | null;
  display_order: number;
}

/** Booking defaults: always shown at top of catalog for boss to set prices (customer booking toggles). */
export const BOOKING_DEFAULT_SERVICES: UKStandardServiceSeed[] = [
  { name: 'Provide cleaning supplies (per hour)', slug: 'provide_cleaning_supplies_per_hour', description: 'Extra per hour when customer asks for cleaning supplies. Shown as toggle on customer booking.', price_type: 'hourly', base_price: 5, display_order: 0 },
  { name: 'Pet Hair Removal Surcharge', slug: 'pet_hair_removal_surcharge', description: 'Percentage added to subtotal when customer has pets (cats/dogs). Shown as toggle on customer booking.', price_type: 'fixed', base_price: 10, display_order: 1 },
];

export const UK_STANDARD_SERVICES: UKStandardServiceSeed[] = [
  ...BOOKING_DEFAULT_SERVICES,
  { name: 'Regular Domestic Clean', slug: 'regular_domestic_clean', description: 'Standard weekly or fortnightly maintenance cleaning.', price_type: 'hourly', base_price: 18, display_order: 2 },
  { name: 'End of Tenancy Deep Clean', slug: 'end_of_tenancy_deep_clean', description: 'Full deep clean for deposit return; includes inside cupboards and oven.', price_type: 'fixed', base_price: 150, display_order: 3 },
  { name: 'Professional Oven Clean', slug: 'professional_oven_clean', description: 'Professional oven degreasing and cleaning.', price_type: 'fixed', base_price: 55, display_order: 4 },
  { name: 'Carpet Steam Cleaning', slug: 'carpet_steam_cleaning', description: 'Professional hot water extraction for carpeted areas.', price_type: 'fixed', base_price: 40, display_order: 5 },
  { name: 'Congestion Zone / ULEZ Surcharge', slug: 'congestion_ulez_surcharge', description: 'Surcharge for Central London Congestion Zone / ULEZ.', price_type: 'fixed', base_price: 15, display_order: 6 },
];

-- =============================================================================
-- UK Professional Service Catalog: company_services table + standard offerings
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  price_type TEXT NOT NULL DEFAULT 'hourly' CHECK (price_type IN ('hourly', 'fixed')),
  suggested_price_min DECIMAL(12,2),
  suggested_price_max DECIMAL(12,2),
  base_price DECIMAL(12,2) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_company_services_company_id ON company_services(company_id);

CREATE TRIGGER company_services_updated_at
  BEFORE UPDATE ON company_services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed UK professional service catalog for every existing company
INSERT INTO company_services (company_id, name, slug, description, price_type, suggested_price_min, suggested_price_max, display_order)
SELECT
  c.id,
  s.name,
  s.slug,
  s.description,
  s.price_type,
  s.suggested_price_min,
  s.suggested_price_max,
  s.display_order
FROM companies c
CROSS JOIN (
  VALUES
    ('Regular Domestic Clean', 'regular_domestic_clean', 'Standard weekly/fortnightly maintenance cleaning.', 'hourly'::TEXT, 18::DECIMAL, 25::DECIMAL, 1),
    ('End of Tenancy (EOT)', 'end_of_tenancy', 'Deep clean including inside cupboards and oven. Designed for deposit return.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 2),
    ('Deep Clean / Spring Clean', 'deep_clean', 'Detailed top-to-bottom cleaning of the property.', 'hourly'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 3),
    ('Professional Oven Degreasing', 'oven_degreasing', 'Full dip-tank style cleaning of racks and interior.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 4),
    ('Steam Carpet Cleaning', 'steam_carpet', 'Professional hot water extraction for all carpeted areas.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 5),
    ('Internal Windows', 'internal_windows', 'Sills and glass cleaning within the property.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 6),
    ('Hard Water Limescale Treatment', 'limescale_treatment', 'Intensive removal of limescale from taps, showers, and tiles.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 7)
) AS s(name, slug, description, price_type, suggested_price_min, suggested_price_max, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM company_services cs WHERE cs.company_id = c.id AND cs.slug = s.slug
);

-- Optional: when a new company is created, copy default UK services (run from app or trigger)
-- Here we only seed existing companies; for new companies the app can call an API that inserts these rows.

COMMENT ON TABLE company_services IS 'UK professional cleaning service catalog per company; seed provides standard offerings.';
COMMENT ON COLUMN company_services.base_price IS 'Company-set price; NULL or 0 = Price on Request';

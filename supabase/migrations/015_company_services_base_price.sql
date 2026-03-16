-- Admin-defined base price per service; NULL = Price on Request
-- Only runs if company_services already exists (e.g. 014 was run without base_price).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_services') THEN
    ALTER TABLE company_services ADD COLUMN IF NOT EXISTS base_price DECIMAL(12,2) NULL;
    COMMENT ON COLUMN company_services.base_price IS 'Company-set price; NULL or 0 = Price on Request';
  END IF;
END $$;

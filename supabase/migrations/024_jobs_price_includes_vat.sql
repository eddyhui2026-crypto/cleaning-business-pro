-- Add VAT flag for job price (display only: £X + VAT vs £X VAT included)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price_includes_vat BOOLEAN NOT NULL DEFAULT false;

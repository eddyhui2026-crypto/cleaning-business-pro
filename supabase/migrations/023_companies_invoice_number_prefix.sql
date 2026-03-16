-- Invoice number prefix per company (e.g. INV, ACME) — format: PREFIX-YYYY-0001
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT;

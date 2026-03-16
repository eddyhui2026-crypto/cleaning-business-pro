-- Whether this invoice adds VAT on top of subtotal (UK 20%). When true, total = subtotal + VAT.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS charge_vat BOOLEAN NOT NULL DEFAULT false;

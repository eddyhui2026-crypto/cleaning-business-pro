-- Multi-line quotes: line_items JSONB for Quick-add and manual override
-- Each element: { id, service_id, name, slug, quantity, unit_price, total }
-- When line_items is non-empty, total_price = sum of line totals; legacy service_type/quantity/unit_price kept for backwards compatibility.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]';
COMMENT ON COLUMN quotes.line_items IS 'Optional line items; when non-empty, total_price is derived from sum of line totals.';

-- Add Rubbish Removal to UK service catalog for existing companies
INSERT INTO company_services (company_id, name, slug, description, price_type, suggested_price_min, suggested_price_max, display_order)
SELECT c.id, 'Rubbish Removal', 'rubbish_removal', 'Removal of waste and unwanted items from the property.', 'fixed'::TEXT, NULL::DECIMAL, NULL::DECIMAL, 8
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM company_services cs WHERE cs.company_id = c.id AND cs.slug = 'rubbish_removal');

-- Checklist templates per company (admin-editable; staff see these on jobs).
-- Each template: { id, name, is_default?, tasks: [{ id, label, order }] }
ALTER TABLE companies ADD COLUMN IF NOT EXISTS checklist_templates JSONB DEFAULT '[]';

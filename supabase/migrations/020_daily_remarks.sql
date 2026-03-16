-- Daily remarks for Overview calendar: one note per company per day (e.g. "Key under mat", "Extra supplies")
CREATE TABLE IF NOT EXISTS daily_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_remarks_company_date ON daily_remarks(company_id, date);

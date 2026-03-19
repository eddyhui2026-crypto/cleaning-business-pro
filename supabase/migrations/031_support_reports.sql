-- Support / bug / feature reports submitted from Dashboard "Report a problem"
-- Used instead of mailto: so staff/boss does not need to open an email client.

CREATE TABLE IF NOT EXISTS support_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  reporter_email TEXT,
  context_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_reports_company_id ON support_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_support_reports_created_at ON support_reports(created_at);


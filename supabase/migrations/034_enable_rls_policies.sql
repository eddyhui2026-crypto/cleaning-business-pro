-- =============================================================================
-- RLS: Enable row level security on all public tables exposed to PostgREST.
-- Service role (backend) bypasses RLS. Authenticated users only get direct
-- access to companies + profiles as required by the frontend; everything
-- else is API-only via service role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select_member ON companies
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.company_id IS NOT NULL
    )
  );

CREATE POLICY companies_insert_owner ON companies
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY companies_update_member ON companies
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.company_id = companies.id
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.company_id = companies.id
        AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_select_same_company ON profiles
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id IN (
      SELECT p.company_id FROM profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.company_id IS NOT NULL
    )
  );

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- All other app tables: RLS on, no policies for authenticated/anon (API only)
-- ---------------------------------------------------------------------------
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;

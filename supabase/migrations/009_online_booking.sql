-- =============================================================================
-- Online Booking: customers, bookings, payment settings
-- =============================================================================

-- Customers: end-users who book (phone + password login; no auth.users)
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  welcome_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_company_phone
  ON customer_profiles(company_id, phone);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_company_id ON customer_profiles(company_id);

-- Link jobs to customer (optional)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);

-- Bookings: customer booking requests (converted to job when confirmed)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'standard_clean',
  preferred_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid_dummy', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings(preferred_date);

-- Payment method per customer (set by company)
CREATE TABLE IF NOT EXISTS customer_payment_settings (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'self_collect' CHECK (payment_method IN ('self_collect', 'payment_link', 'stripe_connect')),
  payment_link_url TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, customer_id)
);

-- Optional: booking slug for public URL e.g. /book/acme-cleaning
ALTER TABLE companies ADD COLUMN IF NOT EXISTS booking_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_companies_booking_slug ON companies(booking_slug) WHERE booking_slug IS NOT NULL;

-- In-app notifications (optional; company sees new bookings)
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_company ON booking_notifications(company_id);

-- Trigger for customer_profiles updated_at
CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customer_payment_settings_updated_at
  BEFORE UPDATE ON customer_payment_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

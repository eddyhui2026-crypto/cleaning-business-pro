-- =============================================================================
-- Booking-to-Quote flow: add 'quoted' status; link quotes to bookings; push subscriptions
-- =============================================================================

-- Allow 'quoted' in bookings.status (Postgres: drop old constraint, add new)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'quoted', 'confirmed', 'cancelled', 'completed'));

-- Link quote to booking (optional: quote can be created from a booking)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_booking_id ON quotes(booking_id) WHERE booking_id IS NOT NULL;

-- Push subscriptions for Web Push (company admins + customers)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company-only subscriptions (customer_id NULL): one per company for admin notifications
-- We allow multiple rows per company (different devices); use endpoint from subscription_json to dedupe if needed
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_company_id ON push_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer_id ON push_subscriptions(customer_id) WHERE customer_id IS NOT NULL;

COMMENT ON TABLE push_subscriptions IS 'Web Push subscription endpoints: customer_id set for client, NULL for company admin';

-- Stripe Customer id for Billing Portal & reusing customer on Checkout
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN companies.stripe_customer_id IS 'Stripe Customer cus_xxx; set on successful Checkout; used for Customer Portal.';

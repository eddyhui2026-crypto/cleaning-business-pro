-- Add staff_id to push_subscriptions so we can target staff app notifications
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE;


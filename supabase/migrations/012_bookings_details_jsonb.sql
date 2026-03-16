-- UK cleaning booking details: property, hours, access, extras
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

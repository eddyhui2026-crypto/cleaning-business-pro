-- Payroll: round clock in/out total_hours to nearest N minutes (5, 10, 15, or 60 = nearest hour).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payroll_round_minutes INTEGER NOT NULL DEFAULT 15;

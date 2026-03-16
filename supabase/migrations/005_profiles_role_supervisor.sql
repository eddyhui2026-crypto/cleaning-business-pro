-- Allow role 'supervisor' in profiles (boss-created staff can be Staff or Supervisor)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'staff', 'supervisor'));

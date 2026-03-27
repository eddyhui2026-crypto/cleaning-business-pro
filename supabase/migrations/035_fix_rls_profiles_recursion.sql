-- =============================================================================
-- Fix PostgREST 500 on profiles: RLS policies must NOT subquery `profiles`
-- from within `profiles` policies (infinite recursion). Use SECURITY DEFINER
-- helpers that read profiles without re-entering RLS.
-- =============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_member ON companies;
DROP POLICY IF EXISTS companies_insert_owner ON companies;
DROP POLICY IF EXISTS companies_update_member ON companies;
DROP POLICY IF EXISTS profiles_select_self ON profiles;
DROP POLICY IF EXISTS profiles_select_same_company ON profiles;
DROP POLICY IF EXISTS profiles_update_self ON profiles;

CREATE OR REPLACE FUNCTION public.auth_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND company_id IS NOT NULL
      AND company_id = p_company_id
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_company_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_is_company_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_is_company_admin(uuid) TO authenticated;

CREATE POLICY companies_select_member ON companies
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR id = public.auth_user_company_id()
  );

CREATE POLICY companies_insert_owner ON companies
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY companies_update_member ON companies
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.auth_user_is_company_admin(id)
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.auth_user_is_company_admin(id)
  );

CREATE POLICY profiles_select_self ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_select_same_company ON profiles
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND company_id = public.auth_user_company_id()
  );

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

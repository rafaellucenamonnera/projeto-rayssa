-- Grant EXECUTE back to authenticated (needed for RLS policy evaluation)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Recreate function with self-check guard to prevent probing other users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only allow checking own roles when called directly
  IF _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;
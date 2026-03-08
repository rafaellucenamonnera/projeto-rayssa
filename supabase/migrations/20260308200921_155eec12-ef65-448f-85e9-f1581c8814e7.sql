-- Fix links_parceiros: restrict INSERT to authenticated partners for their own records
DROP POLICY IF EXISTS "Anyone can insert links" ON public.links_parceiros;

CREATE POLICY "Partners insert own links" ON public.links_parceiros
  FOR INSERT TO authenticated
  WITH CHECK (
    parceiro_id IN (
      SELECT id FROM public.parceiros_comerciais WHERE user_id = auth.uid()
    )
  );

-- Also allow anon insert for the registration flow (CadastroParceiro creates link right after partner insert before auth)
-- Actually, the registration flow inserts a link immediately after creating the partner record as anon user.
-- We need to handle this in application code or keep a scoped policy.
-- Let's check: CadastroParceiro.tsx inserts link after partner creation as unauthenticated user.
-- Solution: Allow insert where parceiro_id matches an existing partner (prevents arbitrary IDs)
-- But better: restrict to authenticated only and fix the registration flow to not create links client-side.

-- For now, let's use a restrictive authenticated-only policy since the link URL 
-- is already constructed from the slug in the partner panel, not from links_parceiros table.

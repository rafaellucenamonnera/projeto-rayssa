
-- 1) Restrict SELECT on lead_comment_attachments
DROP POLICY IF EXISTS "Authenticated read lead_comment_attachments" ON public.lead_comment_attachments;

CREATE POLICY "Read lead_comment_attachments scoped"
ON public.lead_comment_attachments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_conta'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.lead_comments lc
    JOIN public.leads l ON l.id = lc.lead_id
    JOIN public.parceiros_comerciais pc ON pc.id = l.parceiro_id
    WHERE lc.id = lead_comment_attachments.comment_id
      AND pc.user_id = auth.uid()
  )
);

-- 2) Prevent non-admin/gestor from changing responsible_user_id on leads
CREATE OR REPLACE FUNCTION public.protect_lead_responsible_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- anon path already governed by protect_lead_anon_token_update; keep OLD value
    NEW.responsible_user_id := OLD.responsible_user_id;
    RETURN NEW;
  END IF;

  IF NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role)) THEN
      RAISE EXCEPTION 'Apenas administradores ou gestores podem alterar o responsável pelo lead';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_responsible_user ON public.leads;
CREATE TRIGGER trg_protect_lead_responsible_user
BEFORE UPDATE OF responsible_user_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.protect_lead_responsible_user();

-- For INSERT, prevent partners from self-assigning responsible_user_id
CREATE OR REPLACE FUNCTION public.protect_lead_responsible_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsible_user_id IS NOT NULL THEN
    IF auth.uid() IS NULL
       OR NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role)) THEN
      NEW.responsible_user_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_responsible_user_insert ON public.leads;
CREATE TRIGGER trg_protect_lead_responsible_user_insert
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.protect_lead_responsible_user_insert();

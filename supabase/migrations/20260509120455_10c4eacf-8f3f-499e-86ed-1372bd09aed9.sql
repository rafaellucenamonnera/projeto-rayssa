ALTER TABLE public.leads ALTER COLUMN status_lead DROP DEFAULT;
ALTER TABLE public.leads ALTER COLUMN status_lead TYPE text USING status_lead::text;
ALTER TABLE public.leads ALTER COLUMN status_lead SET DEFAULT 'novo_lead';
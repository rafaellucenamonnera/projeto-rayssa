CREATE TABLE IF NOT EXISTS public.sync_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  processed_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_details text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync logs"
ON public.sync_job_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can write sync logs"
ON public.sync_job_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_cnpj_sucesso_idx
ON public.leads ((regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')), status)
WHERE status = 'sucesso' AND coalesce(cnpj, '') <> '';
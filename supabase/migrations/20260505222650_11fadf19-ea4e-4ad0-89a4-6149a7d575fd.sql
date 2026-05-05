CREATE INDEX IF NOT EXISTS idx_leads_status_stage_revenue
ON public.leads (status, status_lead, revenue_total);
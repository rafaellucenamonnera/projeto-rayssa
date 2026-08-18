ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS thread_participants jsonb,
  ADD COLUMN IF NOT EXISTS thread_domains jsonb,
  ADD COLUMN IF NOT EXISTS origin_sender text,
  ADD COLUMN IF NOT EXISTS origin_domain text,
  ADD COLUMN IF NOT EXISTS origin_match_type text,
  ADD COLUMN IF NOT EXISTS origin_match_evidence text;

WITH src AS (
  SELECT
    m.id,
    lower(substring(coalesce(m.from_address, '') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+')) AS sender,
    (
      SELECT array_agg(DISTINCT lower(d[1]))
      FROM regexp_matches(
        lower(coalesce(m.from_address, '') || ' ' || coalesce(m.to_address, '')),
        '@([A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g'
      ) AS d
    ) AS domains
  FROM public.gmail_processed_messages m
  WHERE m.origin_sender IS NULL AND m.thread_domains IS NULL
)
UPDATE public.gmail_processed_messages m
SET origin_sender = nullif(src.sender, ''),
    origin_domain = nullif(split_part(coalesce(src.sender, ''), '@', 2), ''),
    origin_match_type = CASE WHEN nullif(src.sender, '') IS NOT NULL THEN 'sender' END,
    origin_match_evidence = nullif(src.sender, ''),
    thread_domains = to_jsonb(coalesce(src.domains, ARRAY[]::text[]))
FROM src
WHERE m.id = src.id;
UPDATE public.representative_cards
SET codigo_monnera = 'K3NYQTV3',
    codigo_recebido_at = COALESCE(codigo_recebido_at, now()),
    jira_issue_key = COALESCE(jira_issue_key, 'MB-4828')
WHERE id = '6df0052c-a383-45c2-9fc3-0098f017a91d'
  AND codigo_monnera IS NULL;

INSERT INTO public.card_field_provenance (card_id, field_name, field_value, source, evidence, status)
SELECT '6df0052c-a383-45c2-9fc3-0098f017a91d', 'codigo_monnera', 'K3NYQTV3', 'jira_email',
       '{"issue_key":"MB-4828","origem":"Triagem Gmail liberada","subject":"[JIRA] (MB-4828) BASTON + J R ATACADISTA - K3NYQTV3"}',
       'consolidado'
WHERE NOT EXISTS (
  SELECT 1 FROM public.card_field_provenance
  WHERE card_id = '6df0052c-a383-45c2-9fc3-0098f017a91d' AND field_name = 'codigo_monnera' AND field_value = 'K3NYQTV3'
);
DROP INDEX IF EXISTS public.representative_cards_panel_phone_uniq;
DROP INDEX IF EXISTS public.representative_cards_panel_email_uniq;

CREATE UNIQUE INDEX representative_cards_panel_phone_uniq
  ON public.representative_cards (panel_id, phone)
  WHERE panel_id <> 'painel_msj9fyji';

CREATE UNIQUE INDEX representative_cards_panel_email_uniq
  ON public.representative_cards (panel_id, email)
  WHERE panel_id <> 'painel_msj9fyji';

CREATE UNIQUE INDEX representative_cards_panel_cnpj_uniq
  ON public.representative_cards (panel_id, cnpj)
  WHERE cnpj IS NOT NULL;
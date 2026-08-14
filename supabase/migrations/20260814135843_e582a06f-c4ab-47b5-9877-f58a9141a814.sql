ALTER TABLE public.representative_cards
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN responsible_user_id DROP NOT NULL;
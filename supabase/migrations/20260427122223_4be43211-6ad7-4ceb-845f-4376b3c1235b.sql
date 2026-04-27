ALTER TABLE public.parceiros_comerciais DISABLE TRIGGER USER;
UPDATE public.parceiros_comerciais SET aprovado = true WHERE id = 'c938471d-c65c-467b-931c-22636e21aea4';
ALTER TABLE public.parceiros_comerciais ENABLE TRIGGER USER;
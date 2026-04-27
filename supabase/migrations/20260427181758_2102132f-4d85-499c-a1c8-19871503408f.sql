-- Whitelist trigger: when an anonymous (token-based) update happens,
-- only allow modifying the fields the public conversion form needs.
CREATE OR REPLACE FUNCTION public.protect_lead_anon_token_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when there is no authenticated user (anon via completion_token).
  -- Authenticated admin/gestor updates are governed by their own RLS policies.
  IF auth.uid() IS NULL THEN
    -- Sensitive fields: force them back to OLD values, no matter what client sent.
    NEW.parceiro_id              := OLD.parceiro_id;
    NEW.completion_token         := OLD.completion_token;
    NEW.origem                   := OLD.origem;
    NEW.data_cadastro            := OLD.data_cadastro;

    -- Financial / commercial fields
    NEW.valor_mensalidade        := OLD.valor_mensalidade;
    NEW.percentual_consultor     := OLD.percentual_consultor;
    NEW.qtd_parcelas             := OLD.qtd_parcelas;
    NEW.parcelas_pagas           := OLD.parcelas_pagas;
    NEW.valor_campanhas          := OLD.valor_campanhas;

    -- Pipeline / status fields
    NEW.status                   := OLD.status;
    NEW.status_lead              := OLD.status_lead;
    NEW.motivo_perda             := OLD.motivo_perda;
    NEW.data_contrato_assinado   := OLD.data_contrato_assinado;

    -- Document URLs (managed only by backend / staff)
    NEW.proposta_url             := OLD.proposta_url;
    NEW.numero_proposta          := OLD.numero_proposta;
    NEW.contrato_url             := OLD.contrato_url;

    -- dados_completos: only allow flipping false -> true (never back to false,
    -- and never set to true by anon if it was already true).
    IF OLD.dados_completos = true THEN
      NEW.dados_completos := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_lead_anon_token_update ON public.leads;
CREATE TRIGGER protect_lead_anon_token_update
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.protect_lead_anon_token_update();
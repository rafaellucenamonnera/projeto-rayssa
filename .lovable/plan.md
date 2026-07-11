## Escopo
- 1 migration nova.
- `src/pages/admin/AdminLeads.tsx` — carregar `followup_message`, expor RPC de update ao Kanban.
- `src/components/admin/PipelineKanban.tsx` — bloco de mensagem abaixo do "Total" com Copiar/Editar.

## 1. Migration `supabase/migrations/<ts>_commercial_proposal_followups.sql`

```sql
-- 1.1 Colunas em pipeline_stages_config
ALTER TABLE public.pipeline_stages_config
  ADD COLUMN IF NOT EXISTS followup_message text,
  ADD COLUMN IF NOT EXISTS followup_message_updated_at timestamptz;

-- 1.2 Normalizador de label
CREATE OR REPLACE FUNCTION public.normalize_pipeline_stage_label(p_label text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(coalesce(p_label,''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

-- 1.3 Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_pipeline_stage_followup_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.followup_message IS DISTINCT FROM OLD.followup_message THEN
    NEW.followup_message_updated_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pipeline_stage_followup_touch ON public.pipeline_stages_config;
CREATE TRIGGER pipeline_stage_followup_touch
BEFORE UPDATE ON public.pipeline_stages_config
FOR EACH ROW EXECUTE FUNCTION public.tg_pipeline_stage_followup_touch();

-- 1.4 Seed (preenche NULL ou vazio, preserva edições manuais)
WITH msgs(norm, msg) AS (VALUES
  ('followup1', 'Vi que você conseguiu acessar a proposta. Faz sentido marcarmos uma conversa rápida para eu te ajudar a avaliar os pontos principais e próximos passos?'),
  ('followup2', 'Pelo diagnóstico, o ponto mais sensível parece ser a forma como comissão/premiação é calculada, comunicada e documentada. A proposta foi pensada justamente para dar mais clareza, rastreabilidade e governança nesse processo.'),
  ('followup3', 'Para avançarmos com segurança, faz sentido envolver também financeiro, RH, contador ou jurídico? Posso conduzir uma conversa objetiva com todos para explicar o modelo.'),
  ('followup4', 'Conseguimos seguir com o aceite da proposta ou existe algum ponto específico impedindo a decisão hoje?'),
  ('followup5', 'Vou deixar esse contato em acompanhamento por enquanto. Pelo cenário que vocês trouxeram, acredito que existe uma oportunidade clara de organizar melhor a operação de incentivo. Quando fizer sentido retomar, seguimos daqui.')
)
UPDATE public.pipeline_stages_config c
SET followup_message = m.msg
FROM msgs m
WHERE c.panel_key = 'comercial'
  AND public.normalize_pipeline_stage_label(c.label) = m.norm
  AND coalesce(btrim(c.followup_message), '') = '';

-- 1.5 RPC update
CREATE OR REPLACE FUNCTION public.update_pipeline_stage_followup_message(
  p_panel_key text, p_stage_value text, p_followup_message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  v_ok := public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_module_permission(auth.uid(), 'configuracao_painel', 'editar')
       OR public.has_module_permission(auth.uid(), 'leads', 'editar');
  IF NOT v_ok THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  UPDATE public.pipeline_stages_config
     SET followup_message = NULLIF(btrim(coalesce(p_followup_message,'')), '')
   WHERE panel_key = p_panel_key AND value = p_stage_value;

  IF NOT FOUND THEN RAISE EXCEPTION 'Coluna não encontrada'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.update_pipeline_stage_followup_message(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pipeline_stage_followup_message(text,text,text) TO authenticated;

-- 2. Trigger: proposta aceita → lead_convertido (painel comercial)
CREATE OR REPLACE FUNCTION public.move_accepted_commercial_proposal_to_converted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.accepted_at IS NULL
     OR NEW.acceptance_canceled_at IS NOT NULL
     OR NEW.superseded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.accepted_at IS NOT DISTINCT FROM NEW.accepted_at
     AND OLD.acceptance_canceled_at IS NOT DISTINCT FROM NEW.acceptance_canceled_at THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.system_lead_update', 'on', true);
  UPDATE public.leads
     SET status_lead = 'lead_convertido'
   WHERE id = NEW.lead_id
     AND panel_id = 'comercial'
     AND status_lead IS DISTINCT FROM 'lead_convertido';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_move_accepted_commercial_proposal ON public.commercial_proposals;
CREATE TRIGGER trg_move_accepted_commercial_proposal
AFTER INSERT OR UPDATE OF accepted_at, acceptance_canceled_at ON public.commercial_proposals
FOR EACH ROW EXECUTE FUNCTION public.move_accepted_commercial_proposal_to_converted();

-- 3. Job de follow-up
CREATE OR REPLACE FUNCTION public.sync_commercial_proposal_followups()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage_map jsonb := '{}'::jsonb;
  v_target text;
  v_count int := 0;
  r record;
  v_hours numeric;
BEGIN
  PERFORM set_config('app.system_lead_update', 'on', true);

  -- 3.1 defesa: propostas aceitas, ativas e não substituídas → lead_convertido
  UPDATE public.leads l
     SET status_lead = 'lead_convertido'
    FROM public.commercial_proposals p
   WHERE p.lead_id = l.id
     AND p.accepted_at IS NOT NULL
     AND p.acceptance_canceled_at IS NULL
     AND p.superseded_at IS NULL
     AND l.panel_id = 'comercial'
     AND l.status_lead IS DISTINCT FROM 'lead_convertido';

  -- 3.2 mapear stage values de follow-up 1..5
  SELECT jsonb_object_agg(norm, value) INTO v_stage_map
  FROM (
    SELECT public.normalize_pipeline_stage_label(label) AS norm, value
    FROM public.pipeline_stages_config
    WHERE panel_key = 'comercial'
      AND public.normalize_pipeline_stage_label(label)
          IN ('followup1','followup2','followup3','followup4','followup5')
  ) x;

  IF v_stage_map IS NULL OR v_stage_map = '{}'::jsonb THEN RETURN 0; END IF;

  -- 3.3 proposta aberta mais recente por lead
  FOR r IN
    SELECT DISTINCT ON (p.lead_id) p.lead_id, p.opened_at, l.status_lead AS st
      FROM public.commercial_proposals p
      JOIN public.leads l ON l.id = p.lead_id
     WHERE p.opened_at IS NOT NULL
       AND p.accepted_at IS NULL
       AND p.acceptance_canceled_at IS NULL
       AND p.superseded_at IS NULL
       AND l.panel_id = 'comercial'
       AND l.status_lead NOT IN ('lead_convertido','contrato_enviado','contrato_assinado','lead_perdido')
     ORDER BY p.lead_id, p.opened_at DESC
  LOOP
    v_hours := EXTRACT(EPOCH FROM (now() - r.opened_at)) / 3600.0;
    v_target := CASE
      WHEN v_hours >= 240 THEN v_stage_map->>'followup5'
      WHEN v_hours >= 192 THEN v_stage_map->>'followup4'
      WHEN v_hours >= 120 THEN v_stage_map->>'followup3'
      WHEN v_hours >=  72 THEN v_stage_map->>'followup2'
      WHEN v_hours >=  24 THEN v_stage_map->>'followup1'
      ELSE NULL END;

    IF v_target IS NOT NULL AND r.st IS DISTINCT FROM v_target THEN
      UPDATE public.leads SET status_lead = v_target WHERE id = r.lead_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.sync_commercial_proposal_followups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_commercial_proposal_followups() TO service_role;

-- 3.4 pg_cron: habilita, remove job anterior se existir, e reagenda
DO $do$
BEGIN
  BEGIN
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). Agende manualmente: SELECT public.sync_commercial_proposal_followups();', SQLERRM;
    RETURN;
  END;

  BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'commercial-proposal-followups-hourly') THEN
      PERFORM cron.unschedule('commercial-proposal-followups-hourly');
    END IF;
    PERFORM cron.schedule(
      'commercial-proposal-followups-hourly',
      '0 * * * *',
      $$SELECT public.sync_commercial_proposal_followups();$$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'cron.schedule falhou (%). Agende manualmente.', SQLERRM;
  END;
END $do$;
```

## 4. `src/pages/admin/AdminLeads.tsx`
- `type PipelineStage = { value: string; label: string; sort_order: number; followup_message?: string | null };`
- Em `loadPipelineStages`, select: `"value,label,sort_order,followup_message"`.
- Nova função:
  ```ts
  const updateStageFollowupMessage = async (stageValue: string, message: string) => {
    if (!(canEditLead || isAdmin)) return;
    const trimmed = message.trim();
    const { error } = await (supabase as any).rpc("update_pipeline_stage_followup_message", {
      p_panel_key: currentPanelId,
      p_stage_value: stageValue,
      p_followup_message: trimmed || null,
    });
    if (error) { toast.error("Erro ao salvar mensagem da coluna"); throw error; }
    setPipelineStages((prev) => prev.map((s) => s.value === stageValue ? { ...s, followup_message: trimmed || null } : s));
    toast.success("Mensagem da coluna atualizada");
  };
  ```
- Em toda ocorrência de `<PipelineKanban ... />` existente, passar `canEditStageMessages={canEditLead || isAdmin}` e `onUpdateStageFollowupMessage={updateStageFollowupMessage}`.

## 5. `src/components/admin/PipelineKanban.tsx`
- Estender `interface PipelineStage { value: string; label: string; followup_message?: string | null; }`.
- Adicionar props opcionais `canEditStageMessages?: boolean` e `onUpdateStageFollowupMessage?: (stageValue: string, message: string) => Promise<void>`.
- Imports: `import { Textarea } from "@/components/ui/textarea"; import { toast } from "sonner";` (`Copy`/`Pencil` já existem).
- Estados: `editingStageMessage: { stageValue: string; message: string } | null` e `savingStageMessage: boolean`.
- Após `<p>Total…</p>` (linha ~252), quando `s.followup_message || editingStageMessage?.stageValue === s.value`:
  - **Leitura**: `border rounded p-1.5 bg-secondary/40 text-[11px]` com texto + botão icon `Copy` (`navigator.clipboard.writeText` → toasts "Mensagem copiada"/"Erro ao copiar mensagem") + botão icon `Pencil` (só se `canEditStageMessages && onUpdateStageFollowupMessage`).
  - **Edição**: `<Textarea>` compacto + botões `Cancelar` e `Salvar`; salvar chama `onUpdateStageFollowupMessage(s.value, message)` em try/finally com `savingStageMessage`; fecha no sucesso.

Sem alterar drag/drop, agrupamento, cards ou resto do layout.

## 6. Validação
- `npm run build`.
- Reportar arquivos alterados, resultado do build, warnings e lembrete: aprovar a migration; sem `pg_cron`, agendar externamente `SELECT public.sync_commercial_proposal_followups();`.

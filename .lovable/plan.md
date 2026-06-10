# Plano — Fluxo Criação de Campanhas

A maior parte do trabalho já foi entregue em iterações anteriores. Este plano fecha o que ainda falta: revisão final + publicação.

## Já em produção no projeto (verificado)

**Backend**
- Painéis `sucesso` (Painel Sucesso do Cliente) e `campanhas` (Painel Criação Campanhas) em `pipeline_panels`.
- Etapa `Criação Campanha` no painel Sucesso e etapas `Construção campanha`, `Primeira Campanha`, `Aguardando cliente`, `Em execução`, `Concluida` no painel Campanhas.
- Tabelas `lead_comment_attachments` e `lead_campaign_links` com colunas exatamente nos nomes pedidos (`success_lead_id`, `campaign_lead_id`, `opening_task_id`, `requested_by_user_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `created_by`).
- Bucket privado `lead-comment-attachments` com RLS restrita a admin / gestor_conta / owner.
- RLS de `lead_campaign_links` restrita a admin / gestor_conta / `requested_by_user_id`.

**Frontend**
- Rotas `/admin/painel-sucesso`, `/admin/painel-campanhas` e `/admin/painel/:panelId`.
- `src/lib/businessHours.ts` — cálculo de horas úteis BR (seg-sex, 09:00–18:00, UTC-3).
- `src/lib/campaignFlow.ts` — IDs de etapa, SLAs (48h / 24h) e limites de anexo (10 MB, 5/comentário).
- `CommentAttachments.tsx` + integração em `LeadComments.tsx` (imagens, PDF, CSV/XLS/XLSX, signed URLs).
- `CampaignFlowDialogs.tsx` — modal de briefing obrigatório e modal URL+comentário para Concluída.
- `AdminLeads.tsx` — intercepta moves, cria card-cópia em Campanhas, link em `lead_campaign_links`, tarefas SLA, filtros Impacto/Saúde no painel Campanhas.

**Edge function**
- `sync-drive-clients` já reimplantada na rodada anterior.

## O que falta nesta rodada

1. **QA do fluxo no preview** — rodar checklist:
   - Anexar imagem/PDF/planilha em comentário (limites 10 MB e 5/comentário).
   - Mover card do Painel Sucesso etapa "Criação Campanha" → confirmar modal de briefing obrigatório, criação do card-espelho no Painel Campanhas, registro em `lead_campaign_links` e tarefa SLA 48h úteis.
   - Mover em Campanhas para "Aguardando cliente" → validar tarefa automática 24h úteis.
   - Mover para "Concluida" → validar exigência de URL válida + comentário ≥ 5 chars.
   - Filtros Impacto e Saúde no painel Campanhas.

2. **Pequenos ajustes que podem aparecer no QA** (somente se algum item acima falhar):
   - Conferir que `CAMPANHAS_STAGE_CONCLUIDA` em `src/lib/campaignFlow.ts` casa com o valor real `etapa_campanhas_1781057426192` (já confere) e que renomeações futuras de etapa não quebrem o gate — se necessário, adicionar fallback por `label` ("Concluida"/"Aguardando cliente").
   - Garantir que o comentário-espelho criado no card de Campanhas reproduz o briefing e referencia o `success_lead_id`.

3. **Publicação** — após QA verde, publicar a app (`monneraparceiros.lovable.app`). Secrets não são alterados.

## Fora de escopo

- Feriados nacionais (já confirmado nesta versão).
- Notificações por e-mail adicionais para SLA (usar fluxo existente de tarefas).
- Renomear painéis/etapas existentes.

Posso seguir para o build, rodar o QA do checklist no preview e publicar?

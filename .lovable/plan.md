## Objetivo

Aplicar o ajuste validado do Teste Monnera: criar lead parcial já na etapa 1 via nova RPC, remover blocos redundantes, transformar `dor_principal` em múltipla escolha, e garantir que ao finalizar o mesmo `lead_id` seja movido para `etapa_comercial_1783879107510` com diagnóstico persistido em `teste_monnera_diagnosticos`.

## Arquivos alterados

- `src/lib/testeMonnera.ts`
- `src/pages/TesteMonnera.tsx`
- Nova migration em `supabase/migrations/` (RPC upsert + submit)
- `src/pages/admin/AdminLeads.tsx` — só ajustar leitura se não estiver em `teste_monnera_diagnosticos`

## Alterações

### 1. `src/lib/testeMonnera.ts`

- Remover do `QUESTIONNAIRE` os blocos `pagamentos` e `segmento` (governanca permanece).
- Pergunta `dor_principal` (bloco `prioridade`): `type: "multi"`.
- `computeScores` já soma pesos por opção marcada — sem mudança.
- `buildDiagnostico`:
  - Tratar `dor_principal` como array; concatenar labels selecionadas com " · ".
  - `leitura_sdr.dor_principal` recebe a string concatenada.
  - Remover regras de `pontos_atencao` que dependiam de `meio_pagamento`/`conciliacao`.
- Manter `Dimension.pagamentos` no tipo por compatibilidade de payload.

### 2. `src/pages/TesteMonnera.tsx`

- Placeholder do input Segmento: `Ex: farmácia, matcon, vestuário, veículos...`.
- No botão que avança da etapa 1 para o questionário (independentemente do texto atual do botão), antes de avançar chamar `supabase.rpc("upsert_teste_monnera_started_lead", { p_payload })` com dados do lead + `partner_slug`.
  - Só avança se retornar `lead_id`; salvar em estado e em `localStorage` (`monnera_teste_monnera_lead_id`).
  - Em erro: `toast.error` com mensagem do Postgres e não avança.
- Em `submitDiagnostico`, incluir `lead_id` (do estado) no payload de `submit_teste_monnera`.
- Restaurar `lead_id` do localStorage no `useEffect` de restauração.
- `resetTeste` limpa também `lead_id`.
- Remover o card "Pagamentos" do grid de classificação do resultado.

### 3. Nova migration Supabase

**Tabela `teste_monnera_diagnosticos`** — `CREATE TABLE IF NOT EXISTS` (já existe; manter idempotência e GRANTs).

**RPC `upsert_teste_monnera_started_lead(p_payload jsonb) RETURNS jsonb`**
- SECURITY DEFINER, `SET search_path = public`.
- Valida nome, email, telefone, empresa.
- Resolve `parceiro_id` por `partner_slug` (mesma lógica do submit) com fallback `MNRTESTE` → primeiro parceiro ativo/aprovado → qualquer parceiro.
- Match (email → telefone → nome_fantasia) restrito a `panel_id='comercial'`.
- Se existir: atualiza apenas campos básicos vazios; **não regride status_lead** (se já ≠ `novo_lead`, mantém).
- Se não existir: cria com `panel_id='comercial'`, `status_lead='novo_lead'` (sem cast enum), `origem='landing_teste_monnera_partial'`, `dados_completos=false`.
- `set_config('app.system_lead_update','on',true)` para bypass do trigger.
- Retorna `{ "lead_id": <uuid> }`.
- `GRANT EXECUTE ... TO anon, authenticated`.

**RPC `submit_teste_monnera(p_payload jsonb) RETURNS jsonb`** — recriada:
- Aceita `p_payload->>'lead_id'` opcional; se presente e existir, alvo direto (sem re-busca).
- Caso contrário, busca por email → telefone → nome_fantasia.
- Atualiza `status_lead = 'etapa_comercial_1783879107510'` como texto, **sem `::public.lead_status`**.
- Insere em `teste_monnera_diagnosticos` e vincula em `leads.teste_monnera_last_diagnostic_id`.
- Mantém criação de `lead_tasks` (24h) + `create_notification` quando `solicitou_reuniao=true`.
- `GRANT EXECUTE ... TO anon, authenticated`.

### 4. `src/pages/admin/AdminLeads.tsx`

- Verificar que o card de Questionário de Qualificação lê de `teste_monnera_diagnosticos` por `lead_id` ordenando por `created_at desc`. Ajustar apenas se estiver lendo de outra fonte.

## Roteiro de teste (após publicar preview)

1. Aba anônima → `https://parceiros.monnera.com.br/testemonnera/rafael-lucena`.
2. DevTools → Network, filtro `rpc`.
3. Preencher etapa 1 com e-mail único e avançar.
   - Esperado: `upsert_teste_monnera_started_lead` HTTP 200 com `lead_id`; card aparece em **Lead** do painel comercial.
4. Concluir demais etapas → ver diagnóstico.
   - Esperado: `submit_teste_monnera` HTTP 200; **mesmo card** migra para **Lead Qualificado** (`etapa_comercial_1783879107510`), sem duplicar.
5. Abrir card → seção **Questionário de Qualificação** com as respostas.
6. Clicar em agendar conversa → tarefa 24h + notificação para responsável.

## Não fazer

- Não alterar visual, textos da landing, rotas existentes, scoring dos blocos mantidos.
- Não recriar a tabela `teste_monnera_diagnosticos`.
- Não editar `src/integrations/supabase/{client,types}.ts`.
- RPC parcial não pode regredir `status_lead` de card que já esteja adiante de `novo_lead`.

# Painel Sucesso no backend Cloud atual

Backend mantido: `bapxuzodzgahscatvofs`. Sem trocar env vars, sem cliente dual. Sem mexer em `leads`, parceiros, financeiro, login ou demais painéis.

## 1. Migration — schema success_*

Aplicar exatamente o DDL fornecido pelo usuário em uma única migration:

- enum `public.success_panel_rule_priority` (`baixa | media | alta | critica`)
- tabela `public.success_customers` (PK `contratante_cnpj`, validação 14 dígitos, campos de receita/venda/aderência/sincronização, `prioridade`, `classificacao`, etc.)
- índice `idx_success_customers_prioridade`
- tabela `public.success_customer_assignments` (PK `contratante_cnpj`, `cs_user_id → auth.users`)
- tabela `public.success_customer_feedback_history` (CSAT exp/dono 0–5, NPS 0–10, unique por `(contratante_cnpj, survey_month)`)
- índice `idx_success_feedback_customer_month`
- view `public.success_customer_cards_view` com `security_invoker = true` (join + `latest_feedback` por DISTINCT ON)
- RLS habilitado nas 3 tabelas
- Policies de SELECT para `authenticated` em todas, e policies `FOR ALL` para admin/gestor em assignments e feedback (usando `public.has_role`)
- GRANTs para `authenticated` (SELECT em customers e view; SELECT/INSERT/UPDATE em assignments e feedback)

Observações:
- A função `public.has_role` e o enum `public.app_role` já existem no Cloud — reuso direto.
- Nenhuma alteração em `leads`, `parceiros_comerciais`, `lead_comments`, `pipeline_*`, etc.

## 2. Seed inicial (12 clientes mockados)

Após a migration ser aprovada, em uma operação de dados (insert tool):

1. Zerar apenas a camada do Painel Sucesso:
   - `DELETE FROM public.success_customer_feedback_history;`
   - `DELETE FROM public.success_customer_assignments;`
   - `DELETE FROM public.success_customers;`
2. Inserir **12 linhas** em `success_customers` cobrindo prioridades variadas (`critica`, `alta`, `media`, `baixa`), diferentes UFs, segmentos, faixas de mensalidade, aderência e dias de atraso — para a UI ter dados representativos.
3. Inserir **1–2 registros de feedback** por cliente em `success_customer_feedback_history` (CSAT exp, CSAT dono, NPS, `survey_month` nos últimos 2 meses), para a view `latest_feedback` retornar valores.
4. Nenhum `success_customer_assignments` inicial (campos de CS ficam null na view — UI mostra "Sem responsável").

## 3. Frontend — AdminSuccessPanel + rota

Arquivos novos:

- `src/pages/admin/AdminSuccessPanel.tsx` — página que consome `success_customer_cards_view` via `supabase.from("success_customer_cards_view").select("*")` (cast `as any` enquanto types não regerados).
  - Cabeçalho: título "Painel Sucesso", subtítulo, contadores por `prioridade`.
  - Filtros no topo: busca por razão social/CNPJ, select de `prioridade`, select de `classificacao`.
  - Tabela densa (shadcn `Table`) com colunas:
    - Cliente (`razao_social` + `nome_fantasia` + CNPJ formatado)
    - UF / Município
    - Prioridade (badge colorido)
    - Classificação
    - Mensalidade (BRL)
    - Venda total / Venda premiada (BRL)
    - Aderência (%)
    - Dias sem sync / Dias atraso venda
    - CSAT exp / CSAT dono / NPS (do `latest_feedback`)
    - CS responsável (`cs_name_snapshot` ou "—")
    - Ação recomendada (truncada com tooltip)
  - Ordenação default: `prioridade` (critica→baixa), depois `razao_social`.
  - Estados: loading skeleton, empty state, erro com toast.

Arquivos editados:

- `src/App.tsx` — adicionar rota `/admin/painel-sucesso` renderizando `AdminSuccessPanel` dentro de `AdminLayout`, protegida por `isInternalUser`. **Não** remover rotas existentes; apenas adicionar. Não tocar em rotas de leads/pipeline antigo.
- `src/components/AdminSidebar.tsx` — adicionar item de menu "Painel Sucesso" apontando para `/admin/painel-sucesso` (ícone `HeartPulse` ou similar), sem remover itens existentes.

Explicitamente **não** usado:
- `PipelineKanban` antigo
- `AdminLeads`
- tabela `leads`, `lead_comments`, `lead_campaign_links`
- nenhum dual-client; tudo no `supabase` padrão (`@/integrations/supabase/client`)

## 4. Tipagem

Após a migration, `src/integrations/supabase/types.ts` é regenerado automaticamente e passa a expor `success_customers`, `success_customer_assignments`, `success_customer_feedback_history` e a view. Enquanto isso, o componente usa `as any` apenas no ponto do `.from(...)` para destravar — sem redefinir tipos manualmente.

## 5. Detalhes técnicos

- Formatação BRL via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- CNPJ formatado `00.000.000/0000-00` para exibição (helper inline).
- Cores de prioridade reusam `bg-red-500/15 text-red-300` etc. seguindo dark theme estático já em uso (sem novo theme provider).
- Sem realtime nem mutations no MVP — apenas leitura da view.
- Nenhuma edge function nova; sync com Drive permanece como está (não é escopo desta tarefa).

## Fluxo de execução

```text
1. supabase--migration  →  cria enum, 3 tabelas, índices, view, RLS, policies, grants
2. (após aprovação)     →  insert tool zera as 3 tabelas e popula 12 clientes + feedback
3. Cria AdminSuccessPanel.tsx
4. Edita App.tsx (nova rota) e AdminSidebar.tsx (novo item)
5. Verifica build e abre /admin/painel-sucesso no preview
```

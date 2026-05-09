## Resumo

Reformular `sync-drive-clients` para usar a aba **Clientes** (`gid=1252292837`) como fonte da verdade, e tornar as demais abas (Receita, Status Campanha, CSAT, Painel Saúde) apenas **enriquecedoras** por similaridade da razão social. Também resolver o bloqueio do enum `status_lead` que impede leads aparecerem no Painel Sucesso.

## Mudanças

### 1. Nova fonte primária: aba Clientes
- Adicionar env `GOOGLE_SHEETS_CLIENTS_GID` com default `1252292837`.
- Criar função `fetchClientsSheet()` que lê essa aba e devolve uma lista com:
  - `razao_social` (chave canônica, normalizada via `normalizeCompanyName`)
  - `nome_fantasia` (limpando o sufixo `- <CNPJ>` quando presente)
  - `cnpj` (extraído do `nome_fantasia` via regex `\b\d{14}\b`, opcional)
  - `consultor` (= coluna `Carteira`)
- Esta lista vira o **único** disparador de inserção/atualização de leads.

### 2. Demais abas viram enriquecedoras (sem regras próprias de cliente)
- `Receita / Contratante` (gid 0): já é lida; passa a alimentar apenas um `Map` `revenueByCompany` (mensalidade, campanhas, ordem de pagamento, juros, multas, taxa boleto, mês atual/anterior, variação) indexado por razão social normalizada.
- Status Campanha, CSAT, Painel Saúde: já funcionam por similaridade — mantêm a lógica atual.
- O parser financeiro inline (que tentava decidir "linha cliente vs linha categoria") **é removido**.

### 3. Matching com leads existentes
Ordem de busca:
1. CNPJ (quando informado e com 14 dígitos)
2. Razão social normalizada exata
3. Similaridade ≥ 0.85 com lead já existente (evita duplicatas tipo "LTDA" vs "LTDA.")

Se nada bate, cria novo lead.

### 4. Resolver enum `status_lead` (bloqueio do Painel Sucesso)
Migração: converter `leads.status_lead` de enum `lead_status` para `text`, mantendo default `'novo_lead'`. Justificativa:
- Painéis Sucesso/Onboarding/Campanhas usam stages dinâmicas (`etapa_sucesso_*`, etc.) vindas de `pipeline_stages_config`, que **não** cabem no enum fechado.
- Frontend já trata como string (`AdminLeads.tsx`).
- Triggers e funções já fazem `::text` no campo.
- Sem isso, mesmo inserindo, os clientes ficariam invisíveis no Painel Sucesso.

### 5. Inserção
Para cada cliente da aba:
- Buscar 1ª etapa do painel `sucesso` por `sort_order` (não hardcode "Onboarding Sucesso").
- Se nenhuma etapa existir no painel → erro explícito (sem fallback para `novo_lead`).
- `INSERT` com `status='sucesso'`, `status_lead=<value da 1ª etapa>`, `origem='google_drive'`, `parceiro_id=<primeiro parceiro ativo>`, mais campos enriquecidos (receita, CSAT, status campanha, saúde) quando houver match.

### 6. Resposta da função
Adicionar ao JSON: `clients_in_sheet`, `matched_revenue`, `matched_status`, `matched_csat`, `matched_health` para visibilidade no toast do `AdminLeads`.

## Detalhes técnicos

**Arquivos**
- `supabase/functions/sync-drive-clients/index.ts` — refatorado.
- Nova migração SQL:
  ```sql
  ALTER TABLE public.leads
    ALTER COLUMN status_lead TYPE text USING status_lead::text;
  ALTER TABLE public.leads
    ALTER COLUMN status_lead SET DEFAULT 'novo_lead';
  -- O tipo lead_status fica órfão mas é mantido (sem dropar) para não quebrar refs históricas.
  ```

**Comportamento esperado pós-deploy**
- Função retorna `clients_in_sheet ≈ 130+`, `created > 0` na 1ª execução, `updated > 0` nas próximas.
- Painel Sucesso (`/admin/painel-sucesso`) passa a listar os cards na coluna "Onboarding Sucesso", já populados com:
  - Razão Social, Nome Fantasia, CS Responsável (Carteira)
  - Receita atual / anterior / variação (quando a Receita / Contratante tiver match)
  - Status campanha mês atual/anterior, CSAT, status de saúde, impacto (quando as abas auxiliares tiverem match)

**Risco**
Baixo. A aba de clientes é estável. A migração do enum é compatível com o frontend atual.

**Pergunta única antes de implementar**
Confirma que o nome da coluna `Carteira` deve ser tratado como **CS Responsável** (campo `consultor` em `leads`)? E quer que o nome fantasia seja sempre limpado removendo o sufixo `- <CNPJ>`, ou prefere manter o texto original como veio da planilha?

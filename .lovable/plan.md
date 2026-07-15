## Objetivo
Corrigir a associação dos 55 leads importados do CSV de farmácias sem receita, hoje vinculados ao Embaixador **FERNANDO FERREIRA PEREIRA**, para o Embaixador **Rafael Lucena**.

## Diagnóstico
- Tabela dos leads comerciais importados: `public.leads`.
- O campo `consultor` está `NULL` nos 55 leads — o vínculo com o Embaixador não é feito por esse campo, e sim por `leads.parceiro_id → parceiros_comerciais.id`.
- Confirmado no banco:
  - `parceiros_comerciais`: `FERNANDO FERREIRA PEREIRA` = `ec958fea-49ee-49d2-b948-30fe2cedbe66` (64 leads vinculados no total, **55** correspondem exatamente aos CNPJs do CSV).
  - `parceiros_comerciais`: `Rafael Lucena` = `f8e40640-e399-4b47-82af-c10babe01543`.
- Portanto o UPDATE correto é em `parceiro_id`, não em `consultor`.

## Passos

1. **SELECT de conferência** (esperado: 55 linhas), filtrando pelos 55 CNPJs + `parceiro_id = Fernando`:
   ```sql
   SELECT id, cnpj, nome_fantasia, parceiro_id
   FROM public.leads
   WHERE parceiro_id = 'ec958fea-49ee-49d2-b948-30fe2cedbe66'
     AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') IN (<lista dos 58 CNPJs>);
   ```

2. **UPDATE** somente `parceiro_id`, sem alterar nenhum outro campo:
   ```sql
   UPDATE public.leads
   SET parceiro_id = 'f8e40640-e399-4b47-82af-c10babe01543'
   WHERE parceiro_id = 'ec958fea-49ee-49d2-b948-30fe2cedbe66'
     AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') IN (<lista dos 58 CNPJs>)
   RETURNING id, cnpj, nome_fantasia, parceiro_id;
   ```
   Executado via ferramenta de escrita de dados (não é migration, é update de dados).

3. **SELECT de verificação pós-update**: contar quantos dos 58 CNPJs agora estão em `parceiro_id = Rafael` e confirmar que nenhum ficou com Fernando.

4. Retornar a **quantidade de linhas afetadas** (esperado: 55) e a lista `cnpj + nome_fantasia`.

## Fora de escopo
- Não alterar `consultor`, `percentual_consultor`, `status`, `status_lead`, valores financeiros, histórico, ou qualquer outro campo dos leads.
- Não mexer nos 3 CNPJs do CSV que não pertencem ao Fernando (não serão tocados).
- Não alterar cadastros em `parceiros_comerciais`.
- Sem mudança de schema, sem migration, sem código de frontend.

## Aceite
- SELECT pós-update mostra 55 leads com `parceiro_id = Rafael Lucena` e 0 com Fernando (dentro da lista de CNPJs).
- Nenhum outro campo desses leads foi alterado.
- Devolvo a contagem exata de linhas afetadas.

## Objetivo
Fechar a entrega do painel Embaixadores: validar build, aplicar migration e validar comportamento no preview.

## Passos

1. **Rodar `npm run build`**
   - Se falhar, colar o log completo e corrigir antes de seguir.

2. **Aplicar migration no Supabase conectado**
   - Executar `npx supabase db push` (NUNCA `db reset` no remoto).
   - Migration cria as tabelas `ambassador_cards` e `ambassador_card_tasks`, com grants, RLS, policies e **trigger de criação de card no auto-cadastro de parceiro/embaixador** (`AFTER INSERT ON public.parceiros_comerciais`).
   - Se o push falhar, colar o erro completo antes de ajustar.

3. **Validação manual no preview**
   - Sidebar mostra **Painel Embaixadores**.
   - Painel lê de `ambassador_cards` (não `representative_cards`).
   - Botão **+ Card** cria card na etapa **Prospecção**.
   - Rota pública `/cadastro` cria card na etapa **Embaixador em ativação**.
   - Tarefas dentro do card usam `ambassador_card_tasks` (componente `AmbassadorCardTasks`).
   - Botão **Importar CSV** não aparece nesse painel.

## Critério de pronto
Build verde, migration aplicada sem erros e os 6 pontos de validação confirmados no preview.

## Fora de escopo
Qualquer ajuste corretivo — se algum item falhar, abrir bloco separado com o log completo.

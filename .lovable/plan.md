# Concluir o reprocessamento das 72 mensagens restantes (modo triagem)

Hoje o parâmetro `reprocess: true` percorre novamente a lista do Gmail desde o início a cada execução, então lotes sucessivos repetem sempre as mesmas mensagens e as 72 restantes nunca chegam ao fim. A correção é trocar a origem do lote: em vez de varrer o Gmail, o worker passa a ler do banco quais registros ainda não foram reprocessados.

## Como vai funcionar

1. Nova coluna `reprocessed_at` (timestamptz) em `gmail_processed_messages`, preenchida sempre que o registro é reanalisado pela nova regra de CNPJ.
2. Em `reprocess: true`, o worker seleciona no banco até `batch_size` registros (padrão 20, teto 20) com `reprocessed_at` nulo, ordenados por `received_at`, e reanalisa apenas esses `message_id`.
3. Cada registro é atualizado no lugar (mesma linha, mesmo `message_id`) e recebe `reprocessed_at = now()`. Nenhuma linha nova é inserida.
4. Falha isolada em uma mensagem marca erro no registro, incrementa o contador e segue para a próxima; a mensagem fica sem `reprocessed_at` e volta no lote seguinte.
5. Guarda de tempo: o loop interrompe com segurança ao atingir ~50s de execução, gravando o run como concluído parcialmente. Como o progresso é por linha, a execução seguinte retoma exatamente onde parou.
6. A resposta de cada execução informa lote processado, restantes e contadores.

Restrições mantidas integralmente: `GMAIL_SYNC_MODE` permanece `triage`; nenhum card criado ou movido, nenhuma tarefa, nenhum comentário, nenhum anexo baixado ou salvo, nenhum e-mail enviado. Classificação e evidências já registradas são preservadas — os campos são recalculados pela mesma regra multi-fonte já aprovada, sem apagar dados de revisão manual (`reviewed`, `review_decision`).

## Alterações

**Migration**
- `ALTER TABLE public.gmail_processed_messages ADD COLUMN reprocessed_at timestamptz;`
- Índice parcial em `(received_at) WHERE reprocessed_at IS NULL` para o lote.
- Marcar como já reprocessados os registros que a rodada anterior atualizou (os que possuem `cnpj_source` não nulo ou já foram reclassificados), para que o contador de restantes reflita as 72 pendentes.

**`supabase/functions/gmail-baston-sync/index.ts`**
- Novo parâmetro `batch_size` (padrão 20, máximo 20), usado apenas em `reprocess: true`.
- Em modo reprocessamento, a lista de mensagens vem de uma query no banco (`reprocessed_at is null`), não da API de listagem do Gmail.
- Gravação de `reprocessed_at` em cada linha atualizada.
- Guarda de tempo por execução e campo `remaining` na resposta e no run.
- Contadores por fonte de CNPJ (`assunto`, `corpo`, `metadados`, `thread`, `anexo`), sem CNPJ, ambíguos, divergências e erros, acumulados no `gmail_sync_runs`.

**`src/pages/admin/AdminTriagemGmail.tsx`**
- Coluna/indicador de "reprocessado" no detalhe do registro, para conferência visual do progresso.

## Execução

Chamadas manuais sucessivas com `{"reprocess": true, "batch_size": 20}` até `remaining` chegar a zero (4 execuções previstas para as 72 mensagens). Ao final, apresento: total reprocessado, CNPJ por fonte, sem CNPJ, ambíguos, divergências, erros e a confirmação de que nenhum efeito operacional ocorreu (verificada por consulta às tabelas de cards, tarefas, comentários e anexos).

# Fase B — Modo Triagem (sem efeitos operacionais)

Objetivo: o worker do Gmail passa a ler e analisar mensagens e gravar apenas registros de triagem, sem criar cards, mover cards, criar tarefas ou enviar e-mails. O conector da conta `rafael.lucena@monnera.com.br` só será vinculado depois que o modo triagem estiver confirmado.

## Como vai funcionar

1. O worker roda no modo `triage` por padrão. Nesse modo ele lê as mensagens, extrai os dados e grava o resultado da análise — e para por aí.
2. Nada é criado no painel: nenhum card novo, nenhuma movimentação de etapa, nenhuma tarefa, nenhum comentário, nenhum anexo salvo no storage.
3. Anexos são apenas listados (nome, tipo, tamanho e se seriam aceitos) — não são baixados nem armazenados.
4. Cada mensagem é registrada uma única vez (idempotência atual por `message_id` preservada).
5. A primeira varredura usa 90 dias e até 100 mensagens; depois volta ao padrão de 7 dias e 50 mensagens a cada 2 horas.
6. O cron continua ativo exatamente como está, mas sem efeito operacional enquanto o modo for triagem.

## Migrations

**1. Novas colunas em `gmail_processed_messages`**
- `to_address` (text) — destinatário da mensagem.
- `codigo_encontrado` (text) — código alfanumérico detectado no assunto/corpo, quando houver.
- `attachments` (jsonb, default `[]`) — nome, mime, tamanho e se a extensão é aceita.
- `analysis_result` (text) — resultado da triagem.
- `pending_reason` (text) — motivo do bloqueio ou pendência, em linguagem clara.
- `mode` (text, default `triage`) — registra em que modo a mensagem foi processada.
- `matched_card_id` (uuid, FK opcional) — card que **seria** usado, apenas como indicação.

**2. Ampliação do `status` permitido**
Novos valores, sem remover os atuais: `triage_ok`, `triage_sem_cnpj`, `triage_sem_nome`, `triage_sem_codigo`, `triage_duplicado`, `triage_ambiguo`, `triage_fora_do_escopo`.

**3. Coluna `mode` em `gmail_sync_runs`**
Para diferenciar execuções de triagem das operacionais.

Grants e RLS seguem o padrão atual: leitura somente para admin, escrita apenas pelo `service_role`.

## Arquivos alterados

**`supabase/functions/gmail-baston-sync/index.ts`**
- Constante `SYNC_MODE` lida de `Deno.env.get("GMAIL_SYNC_MODE")`, com padrão `triage`.
- Parâmetros de varredura por corpo da requisição: `days` e `max_messages`, com limites (padrão 7/50, teto 90/100).
- Query passa a incluir o destinatário: `(from:baston.com.br OR to:rafael.lucena@monnera.com.br) newer_than:Nd`.
- Nova função `runTriage(msg)` que extrai remetente, destinatário, assunto, thread, CNPJ, nome, código e lista de anexos, classifica o resultado e grava tudo em `gmail_processed_messages`.
- Todo o bloco operacional (criar card, `storeAttachments`, `addComment`, tarefas) fica atrás de `if (SYNC_MODE === 'active')` — no modo triagem esse caminho não executa.
- Nenhum código de envio de e-mail é adicionado.
- Cabeçalho do arquivo documentando a conta autorizada, os filtros ativos e a regra de não envio.

**Nenhum outro arquivo é alterado.** Jira, Canva, cron, regras de tarefas e notificações permanecem intactos.

## Como ativar/desativar o modo triagem

- Padrão: triagem. Sem nenhuma configuração, o worker nunca cria nada.
- Para passar ao modo operacional: definir o secret `GMAIL_SYNC_MODE = active`. Para voltar: apagar o secret ou definir `triage`.
- Varredura inicial de 90 dias / 100 mensagens: execução manual única com `{"days": 90, "max_messages": 100}`. O cron continua chamando com o padrão 7 dias / 50 mensagens.

## Onde os resultados aparecem

- Tabela `gmail_processed_messages` — uma linha por mensagem, com todos os campos pedidos (message_id, thread_id, remetente, destinatário, assunto, CNPJ, nome, código, anexos, resultado e motivo da pendência). Visível apenas a administradores.
- Tabela `gmail_sync_runs` — uma linha por execução, com contadores e erros.
- Se preferir ver isso dentro do painel em vez de consulta ao banco, posso incluir depois uma aba de triagem em Onb Clientes Cross — não está neste escopo.

## Ordem de execução

1. Aplicar as migrations.
2. Atualizar e publicar a função no modo triagem.
3. Vincular a conexão Gmail de `rafael.lucena@monnera.com.br`.
4. Rodar manualmente a varredura de 90 dias / 100 mensagens.
5. Revisar juntos os registros de triagem antes de qualquer ativação operacional.

## Garantias desta etapa

Nenhum card, tarefa, comentário, anexo, movimentação de etapa ou e-mail será criado. Até aqui nada foi alterado no projeto — este é o plano para aprovação.

# Auditoria da Fase B — Onb Clientes Cross (Gmail)

Nada foi alterado: nenhuma função, cron, conector, tabela, card ou tarefa foi modificado. Apenas leitura de código, banco e configuração do conector.

## 1. Arquivos e funções analisados

- `supabase/functions/gmail-baston-sync/index.ts` (585 linhas): `gmailFetch`, `extractDeterministic`, `extractWithAI`, `mergeExtracted`, `collectBody`, `collectAttachments`, `storeAttachments`, `addComment`, `resolveSystemUser`, `resolveInitialStage`, handler `Deno.serve`.
- Tabelas: `gmail_sync_runs`, `gmail_processed_messages`, `representative_cards`, `representative_card_attachments`, `representative_card_comments`, `representative_card_history`, `notifications`.
- Conector `google_mail` ("Rafael's Gmail") e secrets do projeto.

## 2. Fluxo atual (Fase B parcialmente construída, inativa)

1. Cron dispara a função a cada 2 horas (execuções registradas às 12h, 14h, 16h, 18h, 20h UTC de hoje).
2. A função valida `x-cron-secret`, abre um registro em `gmail_sync_runs`.
3. Busca no Gmail via gateway com a query `from:baston.com.br newer_than:7d`, até 50 mensagens.
4. Para cada mensagem: reserva o `message_id` em `gmail_processed_messages` (UNIQUE) antes de qualquer escrita — se já existir, ignora.
5. Extrai texto (plain/HTML), aplica extração determinística por rótulos e, se faltar nome ou CNPJ, complementa com Gemini 2.5 Flash (conteúdo tratado como dado não confiável).
6. Se houver CNPJ já existente no painel, reaproveita o card (`duplicate_cnpj`); senão cria card novo na primeira etapa.
7. Anexos: baixa, calcula SHA-256, ignora se já existir hash igual no card, envia ao bucket `representative-card-attachments`, grava metadados.
8. Registra comentário no card com remetente, assunto, contagem de anexos e trecho do e-mail; atualiza `gmail_processed_messages` e fecha o run.

**Estado real: o worker nunca processou nada.** Todas as execuções falham com "Conexão Gmail não vinculada ao projeto (LOVABLE_API_KEY/GOOGLE_MAIL_API_KEY ausentes)". `gmail_processed_messages` está vazia.

## 3. Situação de cada ponto auditado

| # | Item | Situação |
|---|---|---|
| 1 | Edge Function | Existe e está deployada; falha na primeira validação por falta do secret do Gmail |
| 2 | Cron 2h | Ativo (execuções de 2 em 2 horas comprovadas em `gmail_sync_runs`); o schema `cron` não é legível pelo papel de leitura, mas a evidência de execução é consistente |
| 3 | Conector | "Rafael's Gmail" (`google_mail`, OAuth2, via gateway) existe no workspace, **não está vinculado a este projeto** |
| 4 | Permissões | Escopos já concedidos: `gmail.readonly`, `gmail.send`, `gmail.compose`, `gmail.modify` — suficientes para ler e responder |
| 5 | Filtro de remetentes | Somente `from:baston.com.br` + `newer_than:7d`, com revalidação do domínio após o fetch. Não há filtro por destinatário |
| 6 | Tabelas | `gmail_sync_runs` (contadores + erros) e `gmail_processed_messages` (message_id único, thread_id, from, subject, status, extracted jsonb, card vinculado). RLS: leitura só para admin |
| 7 | Duplicidade | `message_id` UNIQUE (idempotência), CNPJ único por painel (reaproveita card), SHA-256 por anexo dentro do card |
| 8 | Identificação | Cliente/CNPJ/focal/vendedor por rótulos no corpo + fallback de IA; thread guardada em `gmail_processed_messages.thread_id` (hoje só como referência, não usada para agrupar) |
| 9 | Ler e-mails enviados a `rafael.lucena@monnera.com.br` | Tecnicamente possível **se a caixa autorizada for a do próprio Rafael** — bastaria acrescentar `to:` na query. Hoje não há esse filtro e a caixa autenticada precisa ser confirmada |
| 10 | Código alfanumérico | **Não existe nada implementado.** Nenhuma referência a código de card no código ou no banco |
| 11 | Código ausente/divergente/duplicado/ambíguo | Não tratado. Hoje só existem os estados `created`, `duplicate_cnpj`, `skipped_no_name`, `error` |
| 12 | Bloqueio + notificação Rafael/Maycon | Não implementado no worker. A infraestrutura existe: `is_blocked`/`blocked_reason` em `representative_cards`, histórico imutável e tipos `cross_block_created`/`cross_block_resolved` já aceitos em `notifications` |

## 4. Permissões necessárias para ativar

- Vincular a conexão "Rafael's Gmail" a este projeto (gera `GOOGLE_MAIL_API_KEY`). `LOVABLE_API_KEY` e `GMAIL_SYNC_CRON_SECRET` já existem.
- Escopos atuais bastam para leitura; `gmail.send` já disponível caso a Fase B passe a responder e-mails.
- A caixa autorizada precisa efetivamente receber os e-mails de `@baston.com.br` (cópia ou encaminhamento para `rafael.lucena@monnera.com.br`).

## 5. Riscos

- **Criação silenciosa de cards**: ao ligar o conector, o worker cria cards imediatamente com dados extraídos por IA, sem revisão humana. Recomendo um modo "somente triagem" antes da criação automática.
- **Extração incorreta**: rótulos livres e IA podem trazer nome/CNPJ errados; card errado gera retrabalho no painel.
- **Colisão de CNPJ**: e-mails de parceiros diferentes com mesmo CNPJ acabam no mesmo card.
- **Fallback sem CNPJ**: hoje um e-mail com nome mas sem CNPJ cria card novo — risco de duplicatas por variação de nome.
- **Escopos amplos**: `gmail.modify`/`compose` dão mais poder do que a Fase B exige.
- **Conteúdo malicioso**: o prompt já trata o e-mail como dado, mas anexos entram no bucket sem varredura.
- **Volume**: teto de 50 mensagens por execução; picos podem atrasar o processamento.

## 6. Plano técnico proposto para a Fase B

**B1 — Ativação controlada**
- Vincular a conexão Gmail ao projeto.
- Acrescentar flag de operação (`dry_run`) para a primeira semana: processa, grava em `gmail_processed_messages`, mas não cria card.
- Ampliar a query para `from:baston.com.br OR to:rafael.lucena@monnera.com.br`, mantendo a validação de domínio.

**B2 — Código alfanumérico**
- Nova coluna `card_code` em `representative_cards` (única por painel), gerada no cadastro e exibida no card.
- Extração do código no assunto e no corpo por padrão fixo (ex.: `MNR-XXXXXX`), com prioridade sobre CNPJ e nome.
- Ordem de vinculação: código > CNPJ > thread já conhecida > nome.

**B3 — Tratamento de exceções de código**
- `codigo_ausente`: não cria card; entra em fila de triagem.
- `codigo_divergente` (código aponta para card com CNPJ diferente): não grava no card; bloqueia o card apontado e notifica.
- `codigo_duplicado` / `codigo_ambiguo` (mais de um card compatível): fila de triagem com os candidatos listados.
- Novos status em `gmail_processed_messages` para cada caso, mantendo o histórico auditável.

**B4 — Bloqueio e notificação**
- Em divergência ou ambiguidade: marcar `is_blocked = true` com motivo padronizado, registrar em `representative_card_history` como processo do sistema e notificar Rafael Lucena e maycon.santos com `cross_block_created`.
- Notificação inclui link do card, `message_id` e motivo.

**B5 — Visibilidade**
- Painel administrativo simples de triagem: mensagens pendentes, motivo, ação de vincular manualmente a um card e reprocessar.

## 7. Pendências que exigem decisão humana

1. Qual conta Gmail está autorizada em "Rafael's Gmail" e se ela recebe de fato os e-mails de `@baston.com.br`.
2. Formato exato do código alfanumérico (prefixo, tamanho, se é gerado pela Monnera ou vem do parceiro).
3. Se o código será enviado ao parceiro por e-mail automático (exige uso de `gmail.send`).
4. Se a Fase B deve criar cards automaticamente ou apenas alimentar cards existentes.
5. Comportamento quando há código válido mas CNPJ divergente: bloquear o card ou apenas alertar.
6. Se a fila de triagem deve ser visível a todos os admins ou só a Rafael e Maycon.
7. Janela de busca (7 dias hoje) e teto de 50 mensagens por execução.

## 8. Confirmação

Nenhuma alteração foi feita: Jira, Canva, tarefas, cards, cron, conectores e regras existentes permanecem exatamente como estavam. A auditoria foi somente de leitura.

# Monitoramento automático do Gmail (@baston.com.br) a cada 2 horas

Um robô no backend lê, de 2 em 2 horas, os e-mails recentes enviados por endereços `@baston.com.br`, extrai os dados do parceiro e cria o card no painel Onb Clientes Cross — sem duplicar e sem reprocessar mensagens já vistas.

## Como vai funcionar

1. A cada 2 horas o robô consulta a caixa conectada buscando `from:baston.com.br` (janela dos últimos 7 dias, com paginação).
2. Para cada mensagem, verifica se `message_id` já foi processado. Se sim, ignora.
3. Lê remetente, assunto, corpo em texto e a lista de anexos (PDF, Excel/CSV, JPG/PNG até 10 MB).
4. Extrai os campos: nome do parceiro, CNPJ, focal (nome, telefone, e-mail) e vendedor. O conteúdo do e-mail é tratado sempre como dado — nunca como comando para o sistema.
5. Regras de gravação:
   - Sem nome do parceiro → não cria card; a mensagem é registrada como "pendente de revisão".
   - CNPJ já existente no painel `painel_msj9fyji` → não cria card novo; anexa os arquivos e adiciona um comentário no card existente.
   - Caso contrário → cria o card na etapa inicial (Cadastro) com os dados extraídos, anexa arquivos e registra um comentário com o resumo do e-mail.
6. Toda execução, erro e mensagem processada fica registrada e visível para auditoria.

WhatsApp não é lido nem processado em nenhuma etapa.

## Detalhes técnicos

**Conector**: vincular a conexão Gmail existente ("Rafael's Gmail") ao projeto. É preciso o escopo `gmail.readonly`. As chamadas vão pelo gateway (`https://connector-gateway.lovable.dev/google_mail/gmail/v1/...`), somente do backend.

**Banco (migração)**
- `gmail_processed_messages`: `message_id` (único), `thread_id`, `from_address`, `subject`, `received_at`, `status` (`created` | `duplicate_cnpj` | `skipped_no_name` | `error`), `representative_card_id`, `error`, `created_at`. Índice em `thread_id`. GRANT para `service_role`; leitura para `authenticated` (admin via RLS).
- `gmail_sync_runs`: `started_at`, `finished_at`, `fetched_count`, `processed_count`, `created_count`, `skipped_count`, `error_count`, `error_details`. Mesmos GRANTs.
- Reaproveita `representative_cards`, `representative_card_attachments` (com `content_sha256`) e `representative_card_comments`.

**Edge function `gmail-baston-sync`** (`verify_jwt = false`, protegida por header secreto do cron)
- Lista mensagens (`users/me/messages?q=from:baston.com.br newer_than:7d`), busca cada uma com `format=full`, decodifica corpo e anexos base64url.
- Extração determinística por regex (CNPJ, telefones, e-mails) + parser de rótulos ("Nome do parceiro:", "Focal:", "Vendedor:"). Onde o texto for livre, usa o Lovable AI Gateway (`google/gemini-3-flash-preview`) com saída estruturada e instrução fixa de que o e-mail é dado não confiável (defesa contra prompt injection); nenhuma instrução vinda do e-mail altera o comportamento.
- Deduplicação de CNPJ por dígitos em `representative_cards` filtrando `panel_id = 'painel_msj9fyji'`.
- Anexos: SHA-256 antes do upload, mesmo padrão já usado no MCP; ignora duplicados.
- Idempotência: insere em `gmail_processed_messages` com `on conflict do nothing` antes de gravar; marca o resultado ao final.

**Agendamento**: `pg_cron` + `pg_net` chamando a função a cada 2 horas (`0 */2 * * *`).

**Verificação**: typecheck, execução manual da função e conferência dos registros nas duas tabelas de log.

# Onb Clientes Cross — Jira, Código Monnera, consolidação, Canva e onboarding

Painel `painel_msj9fyji`. Auditoria feita apenas com leitura: nenhum card alterado, nenhuma tarefa Jira criada, nenhum e-mail enviado, nenhum Canva gerado.

## Auditoria — o que já existe e o que falta

Já existe:
- `representative_cards` com `jira_issue_key`, `codigo_monnera`, `codigo_source`, `codigo_evidencia`, `codigo_teste`, `origin_thread_id`, `test_mode` e o bloco Canva completo (`canva_design_id`, `canva_public_url`, `canva_internal_url`, `canva_material_codigo`, `canva_material_url`, `canva_material_version`, `canva_material_generated_at`, `canva_material_source`).
- `representative_card_history`, `canva_material_generations`, `onboarding_email_sends`, `gmail_processed_messages` (com `matched_card_id`, `linked_*`, `thread_id`, `thread_participants`), `whatsapp_extractions` (com `linked_card_id`, `matched_card_id`, `codigo_monnera`).
- Edge Functions `gmail-baston-sync`, `send-onboarding-email`, `triage-request-info`; RPC `register_canva_material`, `apply_monnera_code_to_card`, `register_jira_panel_task`.

Falta (dependências reais):
- Nenhuma Edge Function fala com a Atlassian. `register_jira_panel_task` apenas grava uma chave `MB-###` digitada por administrador — por isso a tarefa nunca é criada sozinha.
- Não há credencial Atlassian nem token Canva no backend.
- Não existem tabelas de proveniência, de vínculo de origem nem `automation_runs`.
- Status da tarefa Jira e data de sincronização ainda não têm campos no card.

AccountId da Lívia Fernandes: usar diretamente o accountId confirmado, fixado como configuração da integração Jira. Nunca resolver por nome, nunca usar e-mail como substituto e nunca utilizar `@secret:TELEGRAM_BOT_TOKEN` ou qualquer outro secret como accountId. Observação operacional: no chat o valor chega mascarado como a referência de secret, então o accountId precisa ser colado uma vez em texto puro (formato `5b10a2844c20165700ede21g` ou `712020:...`) para ser fixado; até lá nenhuma tarefa Jira real é criada.

Cards em `Criação Painel` hoje, sem tarefa Jira: UNIDASUL, DIST. MERCHANT, J R ATACADISTA, ZARB DISTRIBUIDORA, ATACADO MACHADO. ORCA LOGÍSTICA está em `Material Onboarding Cliente` e não é lida nem alterada em nenhuma etapa.

## Fase 0 — Criação do card e avanço de etapa

O card é criado em `Cadastro` com **nome confirmado ou CNPJ confirmado** (basta um). Os dados faltantes são solicitados por ação manual autorizada — sem régua nem cobrança automática. O card só é movido para `Criação Painel` quando nome **e** CNPJ estiverem confirmados, e a tarefa Jira só é criada depois disso.

## Fase 1 — Jira e tarefas

Edge Function `jira-create-panel-task`: projeto MB (`10038`), tipo Tarefa (`10042`), responsável Lívia Fernandes. Cria a tarefa quando o card está em `Criação Painel`, com nome e CNPJ confirmados, sem conflito ativo, vinculado a uma origem válida e sem tarefa equivalente (dedupe obrigatório por card_id, CNPJ e thread_id). Descrição com nome, CNPJ, card_id, link do card, origem da informação, thread_id, instrução de criação do painel Monnera e pedido de resposta com o código válido.

Ativação em degraus, sem automação geral desde o início:
1. Modo geral **desligado**.
2. Teste apenas no card `TESTE FASE A QA`.
3. Após validação, ativação progressiva por lote, com sua autorização a cada lote.
4. Botão manual sempre disponível para falhas ou casos individuais.
5. Deduplicação obrigatória em todos os modos.

No card: `jira_issue_key` (já existe) mais `jira_issue_status`, `jira_created_at`, `jira_synced_at`, além dos campos de código já presentes.

Botão `Criar ou reenviar tarefa Jira` no detalhe do card: prévia completa antes de criar, checagem de duplicidade, restrito a administradores, justificativa obrigatória, resultado com a chave ou o erro detalhado, bloqueio de clique duplo. Se já existir tarefa, mostra a chave e não cria outra.

## Fase 2 — Código Monnera

Edge Function `jira-code-webhook`, nunca pública sem autenticação e **nunca com segredo em URL ou query string** (aparece em logs). Ordem de preferência: (1) header secreto comparado em tempo constante; (2) se o Jira não permitir header customizado, assinatura HMAC-SHA256 do corpo enviada em header/campo do payload, validada contra o corpo bruto com proteção de replay por timestamp. Chamadas sem segredo válido são rejeitadas com 401 e registradas. Localiza o card por `jira_issue_key` → card_id → thread_id → CNPJ → nome; aplica somente com correspondência inequívoca; ambiguidade gera pendência e notificação, sem tocar no card.

Validação: exatamente 8 caracteres `A-Z0-9`; rejeita `3SAXJF92`, `UB5PXGDB`, `XXXXXXX`, `XXXXXXXX`, qualquer `MNR-...` e código já usado por outro CNPJ.

Ao aceitar o código: grava o código no card; registra origem, evidência e data; registra histórico; notifica Rafael e Maycon; inicia **apenas** a geração idempotente do Canva. O card **não é movido nesta etapa** — a movimentação para `Material Onboarding Cliente` só ocorre após o link público do Canva ser criado, validado e confirmado.

Fallback Gmail: `gmail-baston-sync` passa a reconhecer mensagens de `jira@monnera.atlassian.net`, limitado à conta `rafael.lucena@monnera.com.br`. Identifica chave Jira, card, CNPJ, nome e código; só aplica com associação inequívoca; ignora e-mails não relacionados; não dispara follow-up nem cobrança. A extração é por conteúdo, sem depender do layout do e-mail.

## Fase 3 — Consolidação Gmail e WhatsApp

Abas seguem separadas visualmente e alimentam o mesmo card principal. Nova tabela de proveniência por campo: valor, origem (`email`, `whatsapp`, `jira_webhook`, `card_vinculado`, `manual`), trecho de evidência, data, confiança, usuário/processo, registro de origem e status.

Ao vincular: consolida no card principal, sem criar card duplicado, preservando origem, thread de e-mail e conversa exportada do WhatsApp, com cada informação exibida com sua origem e histórico completo. O card principal nunca é sobrescrito em silêncio: valores iguais são consolidados; valores diferentes viram divergência com as duas evidências lado a lado; cada valor mantém sua origem; o histórico Gmail/WhatsApp continua acessível; a liberação automática fica bloqueada até decisão manual; e desfazer vínculo não exclui dados nem tarefas.

## Fase 4 — Vínculo automático e manual

Automático apenas com card candidato único, CNPJ idêntico, nome compatível, sem conflito e origem preservada. Manual: só administradores, permitido mesmo com triagem bloqueada, exige confirmação e justificativa, registra usuário/data/evidência/motivo e consolida sem apagar origem.

`Desfazer vínculo` no mesmo ponto de seleção: confirmação e justificativa, remove só a associação, preserva mensagens, arquivos, evidências e tarefas Jira, recalcula pendências e registra o evento.

`Abrir card principal` leva direto ao card correto (rota do painel com o card aberto), não apenas fecha o modal. Depois de selecionar um card: mensagem de sucesso, card vinculado exibido, interface atualizada na hora e lista dos campos consolidados.

## Fase 5 — Canva

O código Monnera válido **apenas inicia a geração do Canva** — não move o card. Fluxo: copia o modelo oficial `https://canva.link/qp4jojog4s01mjl`, substitui o código na página 12 e publica como apresentação pública. O link final é obrigatoriamente `https://canva.link/...`; `https://www.canva.com/d/...` nunca é salvo como final nem enviado ao parceiro. O link público é validado antes de gravar (abre sem autenticação, sem permissão de edição); se a validação falhar, nada é gravado e o card não sai da etapa. Grava design_id, link público, link interno, código, CNPJ, card_id, versão e data. **Somente após a confirmação do link público** o card é movido para `Material Onboarding Cliente`, com histórico e notificação a Rafael e Maycon — e só então o onboarding fica liberado.

Falha: card fica na etapa atual, sem onboarding, erro registrado, notificação para Rafael e Maycon, reprocessamento manual disponível.

## Fase 6 — Onboarding

HTML v2 enviado apenas com código válido, material Canva criado, link público confirmado, card em `Material Onboarding Cliente`, destinatários relacionados ao card e nenhum bloqueio ativo. Placeholders `{{NOME_PARCEIRO}}`, `{{CODIGO_CADASTRO_PARCEIRO}}`, `{{LINK_MATERIAL_CLIENTE}}`; remetente `rafael.lucena@monnera.com.br`. Registra destinatários, thread_id, message_id, template, versão, código, link Canva, status, data e usuário/processo. Sem cobrança, follow-up, régua, destinatário não relacionado ou WhatsApp.

## Fase 7 — Observabilidade

Tabela `automation_runs` (etapa, card_id, status, erro, início, fim, cursor, tentativa, origem) registrando falhas de Jira, webhook, Gmail, Canva, onboarding, timeout e duplicidade. Cron mantido a cada 2 horas; lotes menores, cursor persistido, retomada, idempotência e separação entre triagem, Jira, Canva e onboarding. Alertas por notificação no painel e e-mail interno quando aplicável — nunca WhatsApp.

## Entregáveis técnicos

Migrations aditivas (com GRANTs e RLS):
- `card_field_provenance`, `card_source_links`, `automation_runs`.
- Colunas `jira_issue_status`, `jira_created_at`, `jira_synced_at` em `representative_cards`.
- RPCs `security definer` restritas a admin: `link_source_to_card`, `unlink_source_from_card`, `consolidate_source_into_card`, `apply_monnera_code_from_jira`, `record_automation_run`.

Edge Functions: `jira-create-panel-task` (nova), `jira-code-webhook` (nova, `verify_jwt = false`), ajustes em `gmail-baston-sync`, `send-onboarding-email` e na geração de material Canva.

Frontend: `src/pages/admin/AdminLeads.tsx`, `AdminTriagemGmail.tsx`, `AdminImportWhatsapp.tsx`; novos componentes em `src/components/admin/`: `JiraTaskDialog`, `CodigoMonneraField`, `CardOriginTimeline`, `ManualLinkDialog`, `AutomationHealthPanel`.

Secrets necessários: `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_WEBHOOK_SECRET`, `CANVA_ACCESS_TOKEN`. Nenhum token é pedido, colado ou exibido no chat: abro o formulário seguro do gerenciador de secrets do projeto e os valores ficam apenas lá, acessíveis às Edge Functions em tempo de execução.

Webhook Jira: entrego a URL `https://<projeto>.functions.supabase.co/jira-code-webhook`; no Jira, criar webhook no projeto MB para o evento "issue updated", filtrando o tipo Tarefa, com o header do segredo compartilhado.

## Testes

Unitários das validações (código, dedupe, proveniência) e testes funcionais: duplicidade de tarefa, vínculo Gmail, vínculo WhatsApp, desfazer vínculo, webhook com código válido e inválido, associação por chave/thread/CNPJ, link Canva público, falha e retomada. Execução real somente no card `TESTE FASE A QA`, e apenas com sua autorização explícita.

## Segurança e rollback

Migrations aditivas e reversíveis, dados existentes preservados, RLS respeitada, modo geral desligado até validação, nenhuma execução retroativa automática, nenhum dado fictício em card real, todos os eventos no histórico. ORCA LOGÍSTICA não é tocada. Follow-up automático, régua e cobrança de informações não fazem parte desta entrega.

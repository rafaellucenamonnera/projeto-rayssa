# Onb Clientes Cross — Jira, Código Monnera e consolidação de origens

Auditoria concluída (somente leitura, nenhum dado alterado, nenhuma tarefa criada, nenhum card movido).

## Diagnóstico — por que a tarefa Jira não é criada

Causa raiz: **a automação de criação de tarefa no Jira nunca existiu no projeto.**

Evidências:
- Não há Edge Function que chame a API da Atlassian. As funções existentes são: `admin-create-user`, `delete-orphan-user`, `generate-contract`, `generate-dossie`, `gmail-baston-sync`, `mcp`, `register-partner`, `render-commercial-proposal-pdf`, `send-notification-email`, `send-onboarding-email`, `send-task-deadline-reminders`, `sync-drive-clients`, `triage-request-info`. Nenhuma menciona Jira.
- A única rotina de banco relacionada, `register_jira_panel_task`, apenas **grava** uma chave `MB-###` já existente, informada manualmente por um administrador. Ela valida etapa (`Criação Painel`) e deduplica por thread/CNPJ, mas não cria nada.
- Não existe credencial Atlassian no backend. Os segredos cadastrados são de Gmail, Google Sheets, PDFShift, Telegram e app — nenhum token/e-mail/site Atlassian.
- A única tarefa existente, **MB-4838** (card `TESTE FASE A QA`), foi criada manualmente fora da aplicação e depois registrada pela RPC.
- O worker `gmail-baston-sync` opera em modo triagem: registra mensagens e pendências, não dispara ações no Jira.

Ou seja: não é erro de permissão, payload, deduplicação ou de duas mensagens da mesma thread. É ausência de integração.

Observação importante: no pedido, o Account ID da Lívia veio como `@secret:TELEGRAM_BOT_TOKEN`, que é o token do bot do Telegram — não é um Account ID e não será usado. O Account ID correto será obtido pela conexão Atlassian antes de qualquer criação.

## Cards em `Criação Painel` sem tarefa Jira (5)

| Card | CNPJ |
|---|---|
| UNIDASUL DISTRIBUIDORA ALIMENTICIA S/A | 07718633006896 |
| DIST. MERCHANT | 07216054000642 |
| J R ATACADISTA | 22417427000122 |
| ZARB DISTRIBUIDORA | 07790729000158 |
| ATACADO MACHADO - COLIDER MT | 13338712000167 |

ORCA LOGÍSTICA está em `Material Onboarding Cliente` e **não será tocada**. Nenhum código Monnera está preenchido em cards reais hoje.

## Pré-requisito para executar

Para a integração funcionar preciso cadastrar as credenciais Atlassian como segredos do backend (e-mail da conta, API token e URL do site). Vou solicitá-los na execução. Sem eles, entrego a interface e a automação prontas, porém desligadas.

## O que será implementado

### A. Edge Function `jira-create-panel-task`
Cria uma única tarefa no projeto MB, tipo Tarefa (`10042`), atribuída à Lívia Fernandes (Account ID resolvido pela API, não por valor colado). Fluxo: valida admin pelo token → carrega o card → checa etapa `Criação Painel` → deduplica por `card_id`, `thread_id` e CNPJ → cria a issue → grava `jira_issue_key` no card → registra histórico → notifica Rafael e Maycon. Idempotente: se já houver chave, devolve a existente sem criar outra. Não envia e-mail de onboarding.

Descrição da issue: nome do parceiro, CNPJ, card_id, thread_id, message_id (quando houver), origem dos dados, etapa atual, instrução de criação do painel Monnera e pedido de resposta com o código alfanumérico de 8 caracteres.

### B. Botão manual no card
`Enviar tarefa ao Jira`, visível apenas para administradores, com o card em `Criação Painel` e sem chave. Abre prévia completa (nome, CNPJ, card_id, etapa, thread de origem, descrição, responsável, projeto, tipo), exige confirmação, bloqueia clique duplo e mostra mensagem clara de sucesso ou erro. Se a tarefa já existir, exibe a chave e não cria outra.

### C. Automação na entrada da etapa
Ao mover o card para `Criação Painel`, a mesma função é acionada uma vez. Reexecução segura pela deduplicação.

### D. Campo Código Monnera no card
Edição manual por administrador com justificativa, ou preenchimento automático a partir do e-mail do Jira. Aceita apenas 8 caracteres `[A-Z0-9]`; rejeita `3SAXJF92`, `UB5PXGDB`, `XXXXXXX`, `XXXXXXXX` e formatos `MNR-...`; bloqueia código duplicado ou já associado a outro CNPJ. Registra origem (manual, Gmail/Jira, WhatsApp, sistema), usuário, data, evidência e valor anterior. Exibido no card, na triagem e no histórico.

### E. Consolidação das três origens
O card do painel é sempre o card principal. Registros Gmail e WhatsApp são fontes vinculáveis; ao vincular, os dados são consolidados no card principal (nome, CNPJ, e-mails, telefones, responsáveis, código, dados de campanha, arquivos, pendências, decisões, evidências e origem de cada campo). Nenhum card novo é criado quando já existe principal correspondente.

Não sobreposição: valor existente nunca é substituído em silêncio. Cada campo consolidado gera registro com valor anterior, novo valor, origem, data, usuário/processo, evidência e situação (confirmado, divergente ou pendente). Divergências ficam visíveis e são resolvidas manualmente.

### F. Timeline por origem
Linha do tempo no card com filtros Todas / E-mail / WhatsApp / Manual / Jira / Sistema. Eventos de e-mail preservam remetente, destinatários, assunto, thread_id, message_id e trecho; eventos de WhatsApp preservam arquivo de origem, hash, remetente, data, hora e trecho.

### G. Vínculo manual e desfazer
No seletor de card vinculado, opção `Vincular manualmente`: confirmação explícita, justificativa obrigatória, permitida mesmo com triagem bloqueada, registra decisão manual com usuário e data, preserva pendências e origem.
Botão `Desfazer vínculo`: confirmação e justificativa, remove só a relação, mantém card, registro de origem e histórico, marca dados herdados como "vínculo desfeito", recalcula pendências, não move card nem apaga tarefas Jira.

### H. Abrir card principal
`Abrir card` em qualquer registro Gmail ou WhatsApp abre o card principal correto pelo `card_id`, destacando a origem da abertura e com retorno para a triagem.

### I. Segurança
RLS mantida. Vincular, desvincular, editar código, enviar tarefa manual e alterar dados consolidados: apenas administradores, validado no banco. Toda ação gera histórico; evidências originais nunca são apagadas.

## Detalhes técnicos

Migrations:
- `representative_card_field_provenance` — histórico por campo (valor anterior, novo, origem, evidência, situação, autor, data) + GRANTs e RLS.
- `representative_card_source_links` — vínculo card ↔ registro Gmail/WhatsApp, com justificativa, autor, data e estado (ativo/desfeito) + GRANTs e RLS.
- Colunas em `representative_cards`: `codigo_monnera_origem`, `codigo_monnera_evidencia`, `codigo_monnera_registrado_em`, `codigo_monnera_registrado_por`.
- RPCs `set_card_codigo_monnera`, `link_source_to_card`, `unlink_source_from_card`, `consolidate_source_into_card` — todas `security definer`, restritas a admin, idempotentes e com registro em `representative_card_history`.

Edge Function: `supabase/functions/jira-create-panel-task/index.ts` (CORS, validação Zod, JWT validado em código, segredos Atlassian).

Frontend: `src/pages/admin/AdminLeads.tsx` (detalhe do card: botão Jira, campo Código Monnera, timeline), novos componentes `JiraTaskDialog.tsx`, `CodigoMonneraField.tsx`, `CardOriginTimeline.tsx`, `ManualLinkDialog.tsx` em `src/components/admin/`; `AdminTriagemGmail.tsx` e `AdminImportWhatsapp.tsx` (vincular manualmente, desfazer vínculo, abrir card principal, exibir código).

## Testes

Executados no card `TESTE FASE A QA` (test_mode) e em consultas de leitura: card sem Jira, criação manual pelo botão, tentativa de duplicata, código manual válido/inválido/duplicado, código vindo de e-mail Jira, vínculo Gmail e WhatsApp, consolidação sem sobreposição, divergência, desfazer vínculo, abertura do card principal pela triagem, histórico por origem e bloqueio de usuário sem permissão.

## Rollback

Nenhuma tarefa Jira é criada nos 5 cards reais sem sua confirmação explícita, um a um, pelo botão. Migrations são aditivas: desligar a automação é remover a chamada e a função; os campos novos podem ficar sem uso sem afetar o fluxo atual. ORCA LOGÍSTICA não é lida nem alterada por nenhuma etapa desta entrega.

# Onb Clientes Cross — Jira como fonte do código, Canva, onboarding e triagem unificada

Escopo: painel `painel_msj9fyji`. Nada é executado sobre cards reais nesta entrega — o pipeline só roda sob ação manual autorizada ou webhook do Jira. **Nenhum follow-up automático, régua ou cobrança de informações será implementado.**

## Estado atual confirmado

- Não existe Edge Function que fale com a Atlassian; a rotina `register_jira_panel_task` apenas grava uma chave `MB-###` informada por administrador.
- Não há credencial Atlassian no backend hoje.
- Cards em `Criação Painel` sem tarefa Jira: UNIDASUL, DIST. MERCHANT, J R ATACADISTA, ZARB DISTRIBUIDORA, ATACADO MACHADO.
- Único card com código e chave Jira: `TESTE FASE A QA` (`QATEST01`, MB-4838), em modo teste.
- ORCA LOGÍSTICA está em `Material Onboarding Cliente` e fica intocada.

## 1. Jira como fonte principal do código

Nova Edge Function `jira-code-webhook` (pública, protegida por segredo compartilhado no header e verificação do payload):

1. Recebe a atualização da tarefa MB.
2. Localiza o card por `jira_issue_key` → card_id → thread_id → CNPJ → nome, nessa ordem.
3. Só aplica quando o vínculo é inequívoco (um único candidato). Ambiguidade vira pendência com notificação no painel, sem aplicar nada.
4. Valida o código: exatamente 8 caracteres `[A-Z0-9]`; rejeita `3SAXJF92`, `UB5PXGDB`, `XXXXXXX`, `XXXXXXXX` e qualquer `MNR-...`; rejeita código já usado por outro CNPJ.
5. Registra código, chave Jira, id da tarefa, data, payload resumido, origem `jira_webhook`, evidência e processo responsável.
6. Só depois da validação enfileira a etapa seguinte.

Fallback por e-mail: o worker `gmail-baston-sync` passa a extrair o código de mensagens do Jira por remetente, chave `MB-###`, thread_id, CNPJ e nome — casando por conteúdo, não por layout visual do e-mail.

## 2. Fluxo pós-código (Canva)

Função `cross-generate-canva-material`, disparada só após código válido e sempre idempotente por card + código:

1. Copia o modelo oficial `https://canva.link/qp4jojog4s01mjl`.
2. Substitui o código na página 12.
3. Publica como apresentação pública e obtém link `https://canva.link/...`.
4. Rejeita link de edição `https://www.canva.com/d/...` como link final e confirma que o link abre sem autenticação e sem edição.
5. Grava no card e em `canva_material_generations`: design_id, link público, link interno, código, CNPJ, card_id, versão e data.
6. Move para `Material Onboarding Cliente` apenas após a confirmação do material.

Falha do Canva: card fica na etapa atual, nenhum onboarding é enviado, o erro é registrado, Rafael e Maycon são notificados no painel e há botão de reprocessamento manual.

## 3. Envio do onboarding

O envio do HTML v2 (template versionado, com `{{NOME_PARCEIRO}}`, `{{CODIGO_CADASTRO_PARCEIRO}}`, `{{LINK_MATERIAL_CLIENTE}}`) exige, cumulativamente: código válido, material Canva criado, link público confirmado, card em `Material Onboarding Cliente`, destinatários validados como relacionados ao card e nenhum bloqueio aberto. Conta remetente: `rafael.lucena@monnera.com.br`.

Cada envio registra destinatários, thread_id, message_id, template, versão, código, link Canva, status, data e usuário/processo. Nada de cobrança, régua, follow-up, WhatsApp ou destinatário não relacionado.

## 4. Triagem unificada Gmail + WhatsApp

As abas continuam separadas visualmente, mas gravam na mesma estrutura de campos com proveniência: valor, origem (`email`, `whatsapp`, `jira_webhook`, `card_vinculado`, `manual`), trecho de evidência, data, confiança, usuário/processo, status e card relacionado.

## 5. Consolidação no card principal

O card do painel é sempre o principal. Ao vincular um registro Gmail ou WhatsApp, os dados são consolidados nele — sem criar card duplicado, sem apagar a origem, preservando a thread de e-mail e a conversa de WhatsApp, com cada evento identificado por origem.

Conflito: mantém o valor anterior, grava o novo como divergente, mostra as duas evidências, bloqueia liberação automática e espera decisão manual.

## 6. Vínculo automático e manual

Automático somente com card candidato único, CNPJ exatamente igual, nome compatível, sem conflito e origem preservada. Manual exige confirmação e justificativa, funciona mesmo com a triagem bloqueada e registra usuário, data e evidência.

`Desfazer vínculo`: confirmação e justificativa, remove só a associação, não exclui registros, evidências nem tarefas Jira, recalcula pendências e registra no histórico.

## 7. Observabilidade

Tabela de execuções + painel de saúde cobrindo falha de Edge Function, timeout, ausência de execução, falha do webhook Jira, falha na leitura Gmail, falha do Canva e falha no envio do onboarding. Alertas por notificação no painel e e-mail interno para Rafael e Maycon quando aplicável — nunca por WhatsApp.

Cron mantido em 2 horas. Contra timeout: lotes menores, cursor de progresso persistido, retomada segura, sem duplicar mensagens, com triagem, Jira, Canva e onboarding separados em etapas idempotentes.

## Detalhes técnicos

Migrations (aditivas, com GRANTs e RLS):
- `card_field_provenance` — valor, origem, evidência, confiança, status, autor, data, card e registro de origem.
- `card_source_links` — vínculo card ↔ registro Gmail/WhatsApp com justificativa, autor, data e estado ativo/desfeito.
- `automation_runs` — etapa, card, status, erro, início/fim, cursor, para observabilidade e retomada.
- Colunas em `representative_cards`: origem, evidência, data e autor do código Monnera.
- RPCs `security definer` restritas a admin: `apply_monnera_code_from_jira`, `link_source_to_card`, `unlink_source_from_card`, `consolidate_source_into_card`, `record_automation_run`.

Edge Functions:
- `jira-code-webhook` (nova, `verify_jwt = false`, autenticada por segredo compartilhado).
- `cross-generate-canva-material` (nova).
- `gmail-baston-sync` (ajuste: extração de código do Jira por chave/thread/CNPJ/nome).
- `send-onboarding-email` (ajuste: pré-condições completas + registro ampliado).

Frontend: `src/pages/admin/AdminLeads.tsx` (código Monnera, timeline por origem, reprocessar Canva), `AdminTriagemGmail.tsx` e `AdminImportWhatsapp.tsx` (vincular manualmente, desfazer vínculo, abrir card principal), novos componentes em `src/components/admin/` (`CodigoMonneraField`, `CardOriginTimeline`, `ManualLinkDialog`, `AutomationHealthPanel`).

Segredos necessários (solicito na execução): `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_WEBHOOK_SECRET`, `CANVA_ACCESS_TOKEN`.

Configuração do webhook no Jira (feita por você, com a URL que eu entrego): projeto MB, evento "issue updated", filtro pelo tipo Tarefa (`10042`), header com o segredo compartilhado.

## Testes

Card de teste: `TESTE FASE A QA` (test_mode), mais um registro de triagem sintético. Cobertura: webhook com código válido e inválido, fallback por e-mail, associação por chave/thread_id/CNPJ, código duplicado e divergente, Canva com link público, falha do Canva, envio do HTML v2 apenas após o Canva, vínculo Gmail e WhatsApp, desfazer vínculo, timeout com retomada e prevenção de duplicidade.

## Rollback

Migrations aditivas: nenhuma coluna ou tabela existente é alterada de forma destrutiva. O webhook pode ser desligado no Jira a qualquer momento; Canva e onboarding permanecem manuais até validação. Nenhum card real avança sem confirmação explícita. ORCA LOGÍSTICA não é lida nem alterada em nenhuma etapa.

**Confirmação: follow-up automático, régua e cobrança automática de informações não fazem parte desta entrega.**

# Onb Clientes Cross — o que falta para fechar a entrega

Status conferido agora no projeto: build OK, Fases 1, 2 e 5 no ar (Edge Functions `jira-create-panel-task` e `jira-code-webhook`, tabelas `card_field_provenance`, `card_source_links`, `automation_runs`, botão Jira e bloco de link público Canva no card, filtro Jira já ativo no `gmail-baston-sync`).

## Bloqueio imediato (sem isso o Jira não funciona)

Os secrets `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_ASSIGNEE_ACCOUNT_ID` e `JIRA_WEBHOOK_SECRET` ainda não estão cadastrados. Hoje a função de criação de tarefa falha explicitamente e o webhook rejeita tudo. Abro o formulário seguro para preencher — nenhum valor passa pelo chat.

Depois disso: cadastrar o webhook no projeto MB (evento "issue updated", tipo Tarefa) apontando para a URL da função, com o header do segredo compartilhado.

## Fase 3/4 — Consolidação e vínculo (falta)

- Componente `CardOriginTimeline` no detalhe do card: cada campo com valor, origem (`email`, `whatsapp`, `jira_webhook`, `manual`), evidência, data e usuário, lendo `card_field_provenance`.
- `ManualLinkDialog` nas abas Triagem Gmail e Importar WhatsApp: vincular ao card principal com confirmação e justificativa, desfazer vínculo preservando mensagens/arquivos/tarefas, e "Abrir card principal" navegando direto para o card aberto no painel.
- Divergência de valor não sobrescreve o card: registra as duas evidências lado a lado e bloqueia liberação automática até decisão manual.
- RPCs `security definer` restritas a admin: `link_source_to_card`, `unlink_source_from_card`, `consolidate_source_into_card`.

## Fase 6 — Gate do onboarding (falta)

`send-onboarding-email` ainda não checa todas as pré-condições no servidor. Passa a exigir: código Monnera válido, `canva_public_url` confirmada, card em `Material Onboarding Cliente`, destinatários relacionados ao card e nenhum bloqueio ativo. Sem isso, recusa com motivo e registra a pendência.

## Fase 7 — Observabilidade (falta)

`AutomationHealthPanel` na área admin lendo `automation_runs`: última execução por etapa, falhas recentes, duplicidades e timeouts, com filtro por card e por etapa. As funções já gravam; falta a leitura.

## Testes ao final

Execução real apenas no card `TESTE FASE A QA`: criação de tarefa Jira, webhook com código válido e inválido, vínculo e desvínculo Gmail/WhatsApp, link Canva público recusando link de edição, e envio de onboarding bloqueado sem pré-requisito. ORCA LOGÍSTICA e cards reais não são tocados. Sem follow-up, régua ou cobrança automática.

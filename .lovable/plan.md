# Clonar o painel Onb Clientes Cross por contratante

## Objetivo
Ter um botão "Clonar painel" no Onb Clientes Cross que crie um painel de onboarding idêntico para um contratante (ex.: "Onb Cross – Baston", "Onb Cross – Maxinutri"), com tudo funcionando: colunas, regras, checklist, código Monnera, e-mails, leitura do Gmail e agente (MCP).

## Resultado da auditoria
Hoje o painel é tratado como **único**: o identificador `painel_msj9fyji` está fixo em cerca de 90 pontos. Um clone simples (só nome e colunas) abriria, mas ficaria "mudo": sem checklist, sem trava do código Monnera, sem e-mails e sem receber nada do Gmail.

| Área | O que está preso ao painel original | Efeito num clone |
|---|---|---|
| Tela do painel e Kanban | identificador e colunas "Criação Painel"/"Material Onboarding" fixos | sem exigência de código Monnera, sem botões do Cross |
| Checklist manual / mover para Recebimento Dados | lê colunas só do painel original | checklist vazio |
| E-mail de boas-vindas e destinatários | regra por contratante já existe, mas só no painel original | sem e-mail |
| Leitura do Gmail (triagem) | todo e-mail novo cria/atualiza card só no painel original | clone nunca recebe cards |
| Tela Triagem Gmail e alertas | links e busca fixos no original | links abrem o painel errado |
| Agente MCP (17 ferramentas) | restrito ao original | agente não enxerga o clone |
| Jira (criar tarefa / webhook) | fixo no original | sem tarefa |
| Regras no banco (código Monnera, duplicidade, conclusão de cadastro) | algumas funções citam o original | regras não valem no clone |

Painéis existentes hoje: Comercial, 3 de Onboarding, Integração, Embaixadores, Sucesso e Onb Clientes Cross (45 cards, 8 colunas).

## O que será construído

1. **Configuração por painel** (nova): cada painel ganha
   - tipo: "Onboarding Cross" ou comum;
   - contratante (nome);
   - domínios de e-mail do contratante (ex.: `@baston.com.br`);
   - destinatários padrão do e-mail de boas-vindas;
   - filtro do Gmail (remetentes/assunto/rótulo) que direciona a thread para este painel.
   O painel original vira "Onboarding Cross – (todos os contratantes atuais)", sem mudar nada no que já funciona.

2. **Botão "Clonar painel"** no cabeçalho do painel (só administradores). Abre um formulário: nome do novo painel, contratante, domínios de e-mail, destinatários, filtro do Gmail. Copia:
   - colunas na mesma ordem e com os mesmos nomes;
   - mensagens de acompanhamento de cada coluna;
   - permissões de quem acessa o painel original (com opção de desmarcar);
   - configuração Cross.
   **Não copia cards, tarefas, anexos nem histórico** (painel nasce vazio). Opção de **mover** cards de um contratante do original para o clone, com confirmação e registro no histórico de cada card.

3. **Trocar o "painel fixo" por "painel do tipo Cross"** em todos os pontos da tabela acima. As colunas passam a ser reconhecidas pelo nome ("Cadastro", "Criação Painel", "Material Onboarding Cliente", "Recebimento Dados"), não pelo código interno — por isso o clone mantém as regras.

4. **Thread de e-mail relacionada**: a leitura do Gmail decide o painel assim:
   - remetente/destinatário com domínio de um contratante configurado -> painel daquele contratante;
   - mais de um painel possível ou nenhum -> fica em **pendência de revisão** na Triagem Gmail (nunca escolhe por suposição);
   - card já vinculado à thread continua no painel onde está.
   O e-mail de boas-vindas continua respondendo na mesma thread de origem e usa os destinatários do painel do card; a trava "@baston só em Baston, @maxinutri só em Maxinutri" passa a ler a configuração do painel.

5. **Agente MCP**: as ferramentas passam a aceitar o painel (opcional; padrão = original) e só funcionam em painéis do tipo Cross. `list_cards` e `find_cards_by_cnpj` mostram em qual painel o card está. Uma nova ferramenta lista os painéis Cross e seus contratantes.

6. **Duplicidade de CNPJ e código Monnera**: hoje a trava vale "no mesmo painel". Com vários painéis, passa a valer **entre todos os painéis Cross** (o mesmo cliente não pode estar em dois painéis de contratante ao mesmo tempo sem aviso).

## Fora do escopo
- Nenhuma automação nova (continua manual: sem mover cards nem enviar e-mails sozinho).
- Não mexer em Painel Comercial, Embaixadores, Sucesso nem nos onboardings comuns.
- Não alterar cards existentes, a não ser que você escolha movê-los.

## Ordem de entrega
1. Configuração por painel + marcar o original como Cross (sem mudança visível).
2. Remover as dependências do painel fixo (tela, Kanban, checklist, e-mail, triagem, regras do banco).
3. Botão Clonar + mover cards opcional.
4. Roteamento do Gmail por contratante + pendência de revisão.
5. MCP com escolha de painel.
6. Testes: clonar "Teste Contratante", criar card, inserir código Monnera, checklist, mover para Recebimento Dados, simular e-mail de domínio do contratante, conferir que o original segue igual.

## Decisões que preciso de você
- Quais contratantes viram painel agora (Baston, Maxinutri, outros?) e se os cards atuais devem ser **movidos** para eles.
- O painel original continua existindo como "geral" ou será esvaziado depois?
- Quem pode clonar: só administradores (proposto) ou também gestores?

## Detalhes técnicos
- Nova tabela `panel_settings` (panel_id PK -> pipeline_panels, kind 'cross_onboarding'|'default', contratante_nome, email_domains text[], default_recipients text[], gmail_filter jsonb, created_by, timestamps) com GRANT + RLS (leitura: quem acessa o painel; escrita: admin). Backfill do original.
- RPC `clone_pipeline_panel(p_source, p_name, p_settings, p_copy_permissions)` SECURITY DEFINER, transacional: novo id `painel_xxxx`, stages com ids `etapa_<novo>_<n>`, copia follow-ups e user_panel_permissions, grava auditoria. RPC `move_cards_to_panel` mapeando stage por label + representative_card_history.
- Helper `isCrossPanel(panelId)` (front, via settings carregadas) e `resolveStages(admin, panelId)` em `_shared/crossOnboarding.ts` (já resolve por label; recebe panelId). Substituir constantes em AdminLeads, PipelineKanban, CrossOnboardingSteps, AdminTriagemGmail, triageBlockHandling, AdminImportWhatsapp, gmail-baston-sync, send-onboarding-email, jira-create-panel-task, jira-code-webhook, _shared/jira.ts, mcp/painel/shared.ts (PANEL_ID -> parâmetro validado) e funções SQL que citam `painel_msj9fyji` (apply_monnera_code_to_card, cross_*, complement_cross_card_from_triage, triggers) para `kind='cross_onboarding'`.
- gmail-baston-sync: função pura `routePanelForThread(participants, settings[])` -> `{panelId} | {ambiguous}`; testes vitest para domínio único, múltiplo e nenhum.
- `DESTINATARIOS_POR_CONTRATANTE` passa a vir de `panel_settings`, mantendo o mapa atual como fallback do painel original.

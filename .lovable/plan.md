# Fluxo Onb Clientes Cross — novas regras de movimentação, tarjetas de falha e retomada

## Respostas às 7 perguntas (verificadas antes de qualquer alteração)

**1. O MCP do Canva pode ser usado pelo backend?**
Não. O conector Canva está ligado ao agente Lovable nesta conversa, não ao runtime das Edge Functions. Nenhuma Edge Function consegue chamar `create-design-from-brand-template`, `perform-editing-operations` ou publicar link. Além disso, o link curto `https://canva.link/...` é gerado pela ação "publicar/compartilhar" na interface do Canva; a API pública (Connect API) não expõe endpoint que devolva esse formato de link. Portanto o caminho automático 100% backend não é possível hoje — segue o caminho de fallback que você definiu, sem simular sucesso.

**2. Credenciais existentes.** Secrets do projeto: ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL, ATLASSIAN_SITE_URL, JIRA_ASSIGNEE_ACCOUNT_ID, JIRA_WEBHOOK_SECRET, GMAIL_SYNC_CRON_SECRET, GOOGLE_MAIL_API_KEY, GOOGLE_SHEETS_*, PDFSHIFT_API_KEY, PUBLIC_APP_URL, TELEGRAM_BOT_TOKEN, LOVABLE_API_KEY. Não existe nenhuma credencial Canva — e nenhuma será criada.

**3. Permissões que faltariam** para automatizar de verdade: app Canva Connect com `design:content:read`, `design:content:write`, `folder:read/write` e `asset:read`, mais token OAuth de usuário renovável. Mesmo com isso, a publicação como link `canva.link` continua sendo passo manual.

**4. Estado atual da proteção da ORCA (confirmado no banco):**
- Campo: `representative_cards.is_protected = true` no card `f76d5bfa-680b-47e2-9f11-ca443ee2c40b` (ORCA LOGÍSTICA, CNPJ 04690956000113, etapa Material Onboarding Cliente).
- Registro: `protected_entities` id `d7b11c98-c835-4703-af3f-bcbd5c6c5f9b` (card_id + cnpj_normalizado, motivo "card intocável por decisão operacional"). É a única linha da tabela.
- Triggers que impedem: `trg_representative_card_guard_protected` (usa `is_card_protected`, barra mudança de `codigo_monnera`, `stage_id`, `jira_issue_key`, `canva_public_url`) e `representative_cards_guard_stage` (barra mudança de etapa se `is_blocked`, hoje false). No backend, `entryGate` em `_shared/crossOnboarding.ts` também consulta `is_protected` + `protected_entities`.
- Também bloqueia hoje o "modo controlado" do orquestrador, cuja allowlist só tem o card QA.

**5. Como a remoção será registrada:** `is_protected = false`, exclusão da linha de `protected_entities`, e inserção em `representative_card_history` (`action = 'protection_removed'`, actor, motivo "revogação autorizada em 20/08/2026", payload com o id do registro removido). Nada mais do card é tocado.

**6. Somente a ORCA muda.** A migração filtra pelo id do card e pelo id do registro em `protected_entities`. Nenhum outro card do painel tem proteção.

**7. Liberação ≠ autorização de execução.** São duas coisas separadas e implementadas separadamente: (a) remoção auditada da proteção — feita nesta entrega, com histórico; (b) autorização para execução real do fluxo na ORCA — não incluída. Enquanto você não autorizar por escrito, a ORCA roda apenas em simulação: nenhum Canva, e-mail, tarefa ou movimentação real. A execução real exigirá `dry_run: false` mais a inclusão explícita da ORCA na allowlist de execução, que é uma lista distinta da allowlist de elegibilidade.

**Stage IDs confirmados no banco** (`pipeline_stages_config`, `panel_key = painel_msj9fyji`): Criação Painel = `etapa_painel_msj9fyji_2` (ordem 2); Material Onboarding Cliente = `etapa_painel_msj9fyji_3` (ordem 3); Recebimento Dados = `etapa_painel_msj9fyji_4` (ordem 4). Ainda assim, o código lerá os IDs por rótulo em `pipeline_stages_config` em vez de constantes fixas, para não quebrar se a configuração mudar.

---

## Novas regras de movimentação

```text
Cadastro → Criação Painel → [código Monnera] → Material Onboarding Cliente
                                                   ↓ (Canva + HTML + e-mail confirmado)
                                             Recebimento Dados
```

### Criação Painel → Material Onboarding Cliente
Move automaticamente apenas com código Monnera válido e aplicado ao card (automático ou manual). Sem código: card fica parado, ganha tarjeta vermelha no Kanban e, ao abrir, a mensagem em destaque:
"Ainda falta o código Monnera para avançarmos. Insira o código Monnera e seguiremos com as próximas etapas."

### Material Onboarding Cliente → Recebimento Dados
Executa, em ordem e de forma idempotente: material Canva (código na página 12) → HTML v2 personalizado → validação de logo, links e placeholders → envio do e-mail aos destinatários válidos → `message_id` confirmado → histórico → movimentação. Sem os quatro primeiros concluídos, não move.

### Falhas
Nunca simula sucesso. Em falha de Canva, HTML ou Gmail: card fica na etapa, tarefa de pendência criada/atualizada no próprio card, notificação para Rafael e Maycon, erro no histórico, tarjeta vermelha no Kanban e, no card aberto, bloco vermelho com etapa que falhou, motivo, data/hora, tentativa e próximo passo.

### Retomada manual
Botão "Retomar automação" aparece só quando há falha ou pendência corrigível. Pede confirmação e justificativa, reavalia os gates, identifica a última etapa concluída e reinicia exatamente na etapa pendente — sem repetir Canva, tarefa Jira, e-mail ou movimentação já feitos.

### Movimentação manual pelo usuário
Validada pelos mesmos gates. Sem código Monnera, o arraste de Criação Painel para Material Onboarding é recusado com a mensagem amigável. Movimentação permitida dispara a automação da etapa destino, reaproveitando etapas concluídas e registrando origem `manual`.

### Canva enquanto não houver credencial
A etapa de Canva usa o link público manual como fonte de verdade: se o card não tem `https://canva.link/...` válido, a etapa registra falha real ("integração Canva não disponível no servidor"), abre pendência, notifica e mostra a tarjeta vermelha. Assim que o operador cola um link válido, o botão "Retomar automação" segue da validação do Canva em diante.

---

## Detalhes técnicos

**Migração (uma só, aditiva)**
- Libera a ORCA: `is_protected = false` no card, `delete` da linha em `protected_entities`, registro em `representative_card_history`.
- `cross_onboarding_steps`: acrescenta as etapas `codigo_aplicado` e `card_movido_material` ao check existente, mantendo as 7 atuais e as linhas gravadas.
- Nova RPC `cross_onboarding_resume(p_card_id, p_justificativa)`: valida admin, exige uma etapa em `bloqueado`/`pendencia_manual`/`erro`, grava histórico de retomada e devolve a etapa de reinício. Não altera assinaturas existentes.
- Nova RPC `cross_onboarding_card_status(p_card_id)`: devolve etapa pendente, status, motivo, `failed_at`, tentativa e próximo passo — fonte única da tarjeta vermelha na UI.

**Edge Function `cross-onboarding-advance`** (ajuste, sem refactor)
- Máquina de estados passa a cobrir os dois saltos: `codigo_aplicado` → move `etapa_painel_msj9fyji_2` → `_3`; e, a partir de `_3`, Canva → HTML → e-mail → `message_id` → move `_3` → `etapa_painel_msj9fyji_4`.
- `entryGate` aceita cards em `_2` e em `_3` (hoje só `_2`), mantém bloqueio de card protegido e de `is_blocked`.
- Allowlist do modo controlado passa a conter o card QA e a ORCA; qualquer outro card continua barrado.
- Falha de qualquer etapa: grava `erro` com motivo e timestamp, cria/atualiza a tarefa de pendência via `representative_card_tasks`, notifica Rafael e Maycon, não move o card.
- Aceita `origin: "manual_move" | "resume" | "cron"` e `resume_from`, sempre reexecutando só a etapa pendente.
- `dry_run` continua padrão `true`; execução real exige `dry_run: false` explícito e card na allowlist.

**Frontend**
- `src/pages/admin/AdminLeads.tsx`: no drag entre etapas do painel Cross, checar gate antes de gravar; recusar com toast amigável quando faltar código; ao permitir, invocar o orquestrador com `origin: "manual_move"`.
- `src/components/admin/PipelineKanban` (linha do card): tarjeta vermelha quando houver etapa em falha/pendência ou falta de código.
- Novo `src/components/admin/CrossFlowAlert.tsx`: bloco vermelho no topo do card aberto com etapa que falhou, motivo, data/hora, tentativa e próximo passo — ou a mensagem amigável do código Monnera.
- `src/components/admin/CrossOnboardingSteps.tsx`: passa a listar as 9 etapas e ganha o botão "Retomar automação" (só com falha corrigível), com diálogo de confirmação e justificativa obrigatória.

**Idempotência e não-duplicidade**
- `cross_onboarding_steps` tem chave única por (card, etapa): etapa em `sucesso` nunca reexecuta.
- Material Canva continua registrado por `register_canva_material`, que versiona por card em vez de criar duplicata.
- E-mail só conta como enviado com `message_id` persistido em `onboarding_email_sends`; reenvio é barrado por esse registro.
- Movimentação usa `update ... where stage_id = <etapa de origem>`, então repetir a chamada não move duas vezes.
- Tarefa de pendência é atualizada, não recriada.

**Teste**
Somente TESTE FASE A QA (`32d1e94e…`, `QATEST01`, MB-4838) em execução real; ORCA fica liberada porém em simulação até sua autorização; nenhum outro cliente entra na allowlist. Antes do teste eu confirmo código válido, Jira vinculado, link Canva presente, HTML v2 e destinatário `rafael.lucena@monnera.com.br`.

## Fora deste escopo
Nenhum refactor estrutural, nenhuma alteração comercial nos cards, nenhuma criação de credencial Canva e nenhum envio a clientes reais.

# Destravar o fluxo Cross para todos os cards (hoje só o card de QA anda)

## Por que nada avança

O card J R ATACADISTA está bloqueado logo no gate de entrada, antes de qualquer etapa ser avaliada. Por isso as 8 etapas aparecem "Aguardando" mesmo com código, CNPJ, e-mail e coluna corretos. São três travas de QA ainda ativas no código:

1. **Allowlist de elegibilidade** (`supabase/functions/_shared/crossOnboarding.ts`, `ALLOWLIST_CARD_IDS`): só dois cards (TESTE FASE A QA e ORCA) passam. É exatamente a mensagem do print: "Modo controlado: card não está na allowlist de elegibilidade".
2. **Allowlist de execução real** (`EXECUTION_ALLOWLIST_CARD_IDS`): mesmo passando a primeira, só o card de QA pode rodar fora de simulação.
3. **Allowlist do envio de e-mail** (`supabase/functions/send-onboarding-email/index.ts`): `ALLOWED_CARD_IDS` (só QA), `ALLOWED_RECIPIENTS` (só @monnera.com.br interno) e `ALLOWED_CODES` (só `QATEST01`). Ou seja, mesmo destravando o orquestrador, a etapa 7 falharia para cliente real.

Sobre a etapa 4: **o link do Canva não é gerado automaticamente hoje**. No card de QA ele foi salvo manualmente pela seção "Material Canva" (RPC `register_canva_material`) e o gate apenas valida o formato `https://canva.link/...`. Não existe função que crie o material no Canva — isso precisa ser decidido à parte (ver "Pergunta em aberto").

## Correção proposta

### 1. Sair do modo controlado por card
- Remover a trava por `ALLOWLIST_CARD_IDS` e trocá-la por regras objetivas que já existem: painel Onb Clientes Cross, card não protegido, não bloqueado, etapa Criação Painel ou Material Onboarding, código Monnera válido.
- Manter `test_mode`/`QATEST01` restrito ao card de QA (código de teste continua proibido em card real).
- Execução real passa a ser permitida para qualquer card elegível, ainda exigindo confirmação explícita no botão "Executar avanço".

### 2. Envio de e-mail para cliente real
- Substituir `ALLOWED_CARD_IDS`/`ALLOWED_CODES` por validação de conteúdo: card do painel Cross, código Monnera do próprio card, link público Canva válido, HTML sem placeholders.
- Destinatários: passam a vir do card (e-mail do focal) + participantes da thread, com exclusão de endereços técnicos, como já faz `buildRecipients`. A lista interna @monnera.com.br fica apenas como cópia opcional, não como única permitida.
- Mantidos: registro em `onboarding_email_sends`, detecção de reenvio com confirmação e auditoria.

### 3. Etapas 4 e 5 para todos
- Etapa 4 continua exigindo link público válido salvo no card; se ausente, vira pendência com ação direta ("Salvar link do material") em vez de ficar só "Aguardando".
- Etapa 5 (HTML) já é automática e passa a rodar para qualquer card assim que a 4 estiver ok — nada muda além de deixar de ser bloqueada pelo gate de entrada.

### 4. Retomada dos cards já movidos manualmente
Para cards que já estão em Material Onboarding (como o J R ATACADISTA), o avanço em cadeia registra as etapas 1 a 3 como concluídas com origem `manual_move`, sem mover nada de novo.

## Pergunta em aberto

Geração automática do material Canva: existe conector Canva disponível. Posso criar uma etapa que gere o design a partir de um brand template e publique o link, mas isso é um bloco de trabalho separado (template, campos, aprovação). Se preferir, na primeira entrega o link continua sendo colado manualmente e o resto do fluxo já roda sozinho.

## Detalhes técnicos

- `supabase/functions/_shared/crossOnboarding.ts`: `entryGate` deixa de usar `ALLOWLIST_CARD_IDS`/`EXECUTION_ALLOWLIST_CARD_IDS`; mantém painel, proteção, bloqueio, etapa e `validateCodeForCard`.
- `supabase/functions/cross-onboarding-advance/index.ts`: sem mudança estrutural; `controlled_mode` deixa de bloquear por id.
- `supabase/functions/send-onboarding-email/index.ts`: troca das allowlists por validação de conteúdo + destinatários derivados do card; `qaMode` só quando `card.test_mode = true`.
- `src/pages/admin/AdminEmailOnboarding.tsx`: `isQaSend` deixa de travar o botão; passa a validar campos preenchidos e card selecionado.
- Redeploy de `cross-onboarding-advance` e `send-onboarding-email`. Sem migrations.
- Validação: rodar simulação no J R ATACADISTA e conferir a cadeia até a etapa 6; execução real só após sua autorização.

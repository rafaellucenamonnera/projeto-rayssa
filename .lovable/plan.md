# Destravar o fluxo Cross depois do Canva (card TESTE FASE A QA)

## Por que parou

O painel mostra "Aguardando" das etapas 3 a 9 por três causas concretas, confirmadas no banco e no código do orquestrador:

1. **O orquestrador só avalia uma etapa por execução** e o botão do card é "Simular avanço" (`dry_run: true`). Simulação nunca grava etapa. Não existe hoje botão de execução real no painel de acompanhamento.
2. **A etapa 3 (Card movido para Material Onboarding Cliente) nunca foi registrada.** A movimentação foi manual; o card já está em `etapa_painel_msj9fyji_3`, mas não há linha `card_movido_material` em `cross_onboarding_steps`. Como a fila é sequencial, tudo depois dela fica parado — inclusive a etapa 5, que já está "Concluído" fora de ordem.
3. **A etapa 4 (Material Canva pendente) é redundante.** Ela e a etapa 5 usam exatamente o mesmo gate (link público válido). O link salvo gravou só `canva_pronto`, deixando `canva_pendente` órfã. Respondendo à dúvida: é o mesmo material — o link público de apresentação que entra no HTML de onboarding. Não são dois materiais.

Além disso, a etapa 7 vai bloquear quando chegar a vez dela: o card tem `origin_thread_id` nulo, e hoje a ausência de thread bloqueia antes de olhar os e-mails já rastreados no card.

## O que será feito

### 1. Avanço em cadeia, não uma etapa por clique
O orquestrador passa a percorrer as etapas em sequência dentro da mesma execução, parando no primeiro bloqueio ou pendência. Cada etapa concluída continua sendo gravada individualmente (idempotência preservada).

### 2. Reconhecer a movimentação manual
Na etapa 3, se o card já está em Material Onboarding Cliente, a etapa é registrada como concluída com origem `manual_move` — sem mover nada de novo. Movimentação manual deixa de travar o fluxo.

### 3. Unificar as etapas 4 e 5 do Canva
`canva_pendente` deixa de ser etapa separada: passa a ser satisfeita pelo mesmo gate do link válido. Na lista, as duas linhas viram uma só: "4. Material Canva (link público validado)". A numeração da UI passa a 8 etapas.

### 4. Destinatários sem thread
A ausência de `origin_thread_id` deixa de bloquear. A ordem de origem passa a ser: participantes da thread (quando existir) → e-mails do card/triagem → em modo QA, a lista fixa autorizada. Só vira pendência se não sobrar nenhum destinatário comprovado.

### 5. HTML personalizado de verdade
A etapa 6 passa a renderizar o HTML v2 com nome, código Monnera e link público do Canva, aplicar o checklist obrigatório e guardar o snapshot no registro da etapa — em vez de apenas conferir os campos de entrada.

### 6. Envio e movimentação final
As etapas 8 e 9 continuam com as travas atuais: o envio só é considerado feito com `message_id` confirmado pela API Gmail, e o card só vai para Recebimento Dados depois disso. O envio real continua restrito à allowlist do card de QA e aos destinatários autorizados.

### 7. Botão de execução no card
Ao lado de "Simular avanço", entra "Executar avanço" (visível para admin), com confirmação explícita antes de rodar em modo real. O texto do cabeçalho deixa de dizer que tudo é somente leitura.

## Validação

Rodar primeiro em simulação no card TESTE FASE A QA e conferir que a cadeia chega até a etapa de envio. Depois, execução real apenas nesse card. Nenhum outro card é tocado: modo controlado e allowlist permanecem, e a ORCA LOGÍSTICA segue sem execução real.

## Detalhes técnicos

- `supabase/functions/cross-onboarding-advance/index.ts`: laço sobre `STEPS` com `break` no primeiro gate falho; `card_movido_material` aceita `already_in_stage`; `html_pronto` renderiza o template e roda `htmlChecklist`; `email_pendente` usa fallback de destinatários.
- `supabase/functions/_shared/crossOnboarding.ts`: remover `canva_pendente` de `STEPS`; `threadGate` deixa de ser gate de bloqueio de destinatários; `buildRecipients` ganha fallback pelo e-mail do card.
- Template do e-mail: mover a renderização do HTML v2 para `supabase/functions/_shared/` para que a função possa usá-la (hoje vive em `src/lib/onboardingEmailTemplate.ts`).
- `src/components/admin/CrossOnboardingSteps.tsx`: lista de 8 etapas, botão "Executar avanço" com diálogo de confirmação.
- Sem migrations novas; linhas antigas de `canva_pendente` ficam inertes.

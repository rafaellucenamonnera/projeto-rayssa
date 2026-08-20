# Por que a mensagem aparece em todo card

A simulação passa pelo "gate de entrada" do orquestrador. Esse gate roda em **modo controlado ligado por padrão**, e o modo controlado só aceita **dois cards fixos** (TESTE FASE A QA e ORCA). Qualquer outro card é bloqueado com a mensagem "Modo controlado: card não está na allowlist de elegibilidade" — antes mesmo de olhar dados, etapa ou código.

Onde está:
- `supabase/functions/_shared/crossOnboarding.ts` — `ALLOWLIST_CARD_IDS` (2 ids) e o bloqueio na função `entryGate` (linhas ~176-178).
- `supabase/functions/cross-onboarding-advance/index.ts:130` — `controlledMode` = `true` a menos que a chamada envie `controlled_mode: false`. A tela de simulação não envia esse campo, então sempre cai no modo controlado.

# Correção (escolher uma, sem refatorar)

1. **Liberar simulação para qualquer card (recomendado):** aplicar a allowlist apenas quando `dryRun === false`. Ou seja, dry-run passa para qualquer card; execução real continua restrita pela `EXECUTION_ALLOWLIST_CARD_IDS`. Uma linha alterada em `crossOnboarding.ts`.

2. **Liberar caso a caso:** adicionar o `card_id` desejado em `ALLOWLIST_CARD_IDS`. Serve para 1 ou 2 cards, não escala.

3. **Desligar por chamada:** a UI enviar `controlled_mode: false` no corpo da invocação. Desliga também a trava de execução real — não recomendado.

# Detalhe técnico da opção 1

Em `entryGate`, trocar a condição de elegibilidade para considerar o dry-run:

```text
if (opts.controlledMode && opts.dryRun === false && !ALLOWLIST_CARD_IDS.has(card.id)) -> bloqueia
```

mantendo intacta a checagem seguinte de `EXECUTION_ALLOWLIST_CARD_IDS`. Depois, redeploy da função `cross-onboarding-advance`. Nada mais muda: proteções de card protegido/bloqueado, painel, etapa e código continuam valendo.

# Corrigir o Código Monnera da DISTRIBUIDORA MASCOTE

## Diagnóstico confirmado

O fluxo automático funcionou até a última etapa e parou na validação do código.

| Etapa | Resultado |
|---|---|
| Triagem Gmail (mensagem `7fdfa52e…`, MB-4815) | OK — recebida, revisada, aprovada, liberada |
| Identificação do cliente | OK — nome `BASTON + DISTRIBUIDORA MASCOTE` |
| Vínculo com o card | OK — `matched_card_id` = `88a911f5-5e2e-4d1e-810b-bf02b014003f`, vínculo ativo em `card_source_links` |
| Extração do código | **PAROU AQUI** — `3SAXJF92` foi descartado por constar na lista de códigos de exemplo |
| Gravação no card | Não ocorreu — `codigo_encontrado` vazio, `codigo_monnera` nulo, nada em `card_field_provenance` |
| Exibição | Correta para o estado atual: "Código Monnera: aguardando" |

Não houve falha de nome, acentuação, CNPJ, thread, formato, divergência, cache ou campo de leitura errado. A única causa é a blocklist.

O código `3SAXJF92` está declarado como exemplo em cinco lugares do código e dentro de várias RPCs do banco.

## Correção proposta (mínima e aditiva)

1. **Remover `3SAXJF92` da lista de códigos de exemplo**, mantendo `UB5PXGDB`, `XXXXXXX` e `XXXXXXXX` bloqueados:
   - `src/lib/monneraCode.ts`
   - `src/lib/onboardingEmailTemplate.ts`
   - `src/lib/whatsappTriage.ts` (constante e regex de detecção)
   - `supabase/functions/_shared/monneraCode.ts`
   - `supabase/functions/gmail-baston-sync/index.ts` (constante e regex)
2. **Migração**: redefinir as funções vigentes que validam código (`apply_monnera_code_to_card`, `set_monnera_code_manual`, `gmail_triage_recompute`, `execute_triage_activation` e demais que citem a lista) removendo apenas `3SAXJF92` da verificação. Nenhuma mudança de assinatura, tabela ou coluna.
3. **Reprocessar somente o registro da Mascote** pelo caminho já existente: recomputar a triagem `7fdfa52e…` para preencher `codigo_encontrado` e aplicar o código ao card via `apply_monnera_code_to_card` com `p_source = 'jira_email'` e evidência do assunto do MB-4815. Isso grava no campo canônico `representative_cards.codigo_monnera`, registra `codigo_recebido_at`, `card_field_provenance` e histórico — exatamente como nos demais cards.
4. **Exibição**: nenhuma alteração de componente. O Kanban e o detalhe já leem `codigo_monnera` e passarão a mostrar `Código Monnera: 3SAXJF92` logo abaixo do nome após o recarregamento dos dados.

## Escopo excluído

Sem refatoração, sem novo fluxo, sem campo ou tabela paralela, sem criação de cards, sem envio de e-mail, sem geração de Canva, sem movimentação de etapa.

## Verificação

- Conferir no banco que o card `88a911f5…` passou a ter `codigo_monnera = '3SAXJF92'`, `codigo_recebido_at` preenchido e uma linha em `card_field_provenance`.
- Conferir que a triagem `7fdfa52e…` mostra o código e que nenhum outro card foi afetado.
- Conferir no painel Onb Clientes Cross que o código aparece no card fechado e no detalhe aberto.
- Typecheck e build.

# Limpar o resíduo "Jira 404" no card TESTE FASE A QA e liberar os demais cards

## O que foi confirmado agora (somente leitura)

- O código já não consulta o Jira no avanço: `jiraLinkGate` e `getIssue` foram retirados de `cross-onboarding-advance`. A simulação no card QA retorna `gate_jira: ignorado` e `codigo_validado: ok` com `QATEST01`.
- A mensagem que ainda aparece no diálogo "Retomar automação" **não é uma consulta nova ao Jira**. É um registro antigo gravado na tabela de etapas:

```text
cross_onboarding_steps
  card_id  = 32d1e94e… (TESTE FASE A QA)
  step     = codigo_validado
  status   = bloqueado
  attempt  = 1
  error    = "Jira não resolvível para MB-4838: Jira 404 ..."
  updated_at = 20/08/2026 15:06 UTC  (anterior à correção)
```

O componente `CrossOnboardingSteps` só exibe o texto guardado nessa linha. Enquanto a linha continuar com `status = bloqueado`, o card mostra a tarjeta vermelha, mesmo sem nenhuma chamada ao Jira.

## Como resolver

Executar a retomada real da etapa `codigo_validado` **apenas** no card TESTE FASE A QA:

1. Chamar `cross-onboarding-advance` com `dry_run: false`, `resume_from: "codigo_validado"`, origem `resume`, justificativa registrada.
2. A função regrava a linha como `status = sucesso`, `error = null`, e a tarjeta vermelha desaparece.
3. Nada de e-mail, Canva, tarefa Jira ou movimentação nessa execução — a etapa `codigo_validado` só valida e grava o código; as movimentações são etapas posteriores e ficam paradas até o operador continuar.

Se preferir sem executar nada, a alternativa é apenas limpar o `error`/`status` dessa linha por atualização direta — mas a retomada é o caminho previsto pelo fluxo e mantém auditoria em `automation_runs`.

## Depois disso: seguir com os demais cards

Sim, é possível — com a mesma sequência de segurança:

1. Concluir a retomada do QA e confirmar `codigo_validado: sucesso` sem menção a Jira.
2. Listar (somente leitura) os demais cards do painel Onb Clientes Cross que tenham linhas em `cross_onboarding_steps` com `status = bloqueado` e `error` contendo "Jira" — esses são resíduos do mesmo problema e recebem a mesma retomada.
3. Cards bloqueados por outro motivo (sem código Monnera válido, dados cadastrais incompletos, link Canva ausente) **não** entram nessa retomada: continuam na régua de cobrança e no fluxo normal.
4. ORCA LOGÍSTICA fica de fora: nenhuma execução, nenhuma alteração de campo, nenhuma inclusão em allowlist.
5. A allowlist de execução real continua restrita ao card QA. Para rodar a retomada nos demais cards preciso da sua autorização explícita, card a card ou por lote nomeado.

## Detalhes técnicos

- Alteração de código: nenhuma. O ajuste que remove o Jira do caminho de avanço já está aplicado e implantado.
- Operação: chamadas à Edge Function `cross-onboarding-advance` com `resume_from`, mais consulta de leitura em `cross_onboarding_steps` para levantar os resíduos.
- Não haverá envio de e-mail, criação de tarefa Jira, geração Canva nem movimentação de etapa durante essa limpeza.

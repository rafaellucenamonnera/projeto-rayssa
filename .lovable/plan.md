## Objetivo
Ajustar o questionário e a UX do Teste Monnera conforme validado localmente. Sem alterar hero, rotas, cores, RPCs ou fluxo de persistência.

## Arquivos alterados
- `src/lib/testeMonnera.ts` — estrutura do questionário, tipos e scoring.
- `src/pages/TesteMonnera.tsx` — renderização, escala 0-5 e validação obrigatória.

Nenhuma migration, nenhuma alteração em RPC, painel comercial ou `AdminLeads.tsx`.

## Mudanças em `src/lib/testeMonnera.ts`

### 1. Remover o bloco `confirmacao`
Excluir do `QUESTIONNAIRE` apenas o bloco `id: "confirmacao"`. Demais blocos preservados (`empresa`, `formatos`, `governanca`, `campanhas_capacidade`, `prioridade`).

### 2. Recolocar bloco `pagamentos`
Adicionar bloco `pagamentos` — “Pagamentos aos participantes” — com:

- `meio_pagamento` (multi, obrigatória): dinheiro em folha, PIX manual, cartão de benefício, cartão pré-pago Monnera, ainda não paga incentivo. Pesos em `pagamentos`/`governanca`.
- `conciliacao` (scale05, obrigatória): “Quão fácil é conciliar o que foi apurado com o que foi pago?” — peso negativo em `pagamentos` (nota alta reduz risco).
- `complexidade_encerramento` (scale05, obrigatória): “Hoje, quão complexo é encerrar uma campanha, conferir resultados e deixar tudo pronto para pagamento?” — **pontuação invertida**: quanto menor a nota, maior o incremento em `pagamentos` (nota baixa = mais dor). Implementado via `scaleWeight` negativo somado a um offset constante em `computeScores`, OU de forma direta: usar `scaleWeight: { pagamentos: -1.2 }` combinado a um baseline de `+6` adicionado ao score `pagamentos` no início — mesma técnica já usada para `governanca` (baseline 30 no `computeScores`). Equivalente: `contrib = (5 - nota) * 1.2` em `pagamentos`.
- `ciclos_campanha` (multi, obrigatória): campanhas semanais/ciclos curtos, fechamento de mês, sazonais/datas comerciais, ações pontuais com parceiros. Pesos leves em `campanhas`.

### 3. Enriquecer `campanhas_capacidade`
Manter as duas perguntas atuais e acrescentar 3 novas `single`, obrigatórias, opções `Sim` / `Parcialmente` / `Não`:

- `campanhas_parceiros`: estruturar campanhas com fornecedores/indústrias/parceiros. Sim → `campanhas +`, Parcialmente → neutro, Não → `governanca +`.
- `acesso_colaboradores`: liberar acesso ao time para campanhas de parceiros. Mesma lógica de pesos.
- `retorno_parceiros`: retornar resultados aos parceiros com clareza/rastreabilidade. Mesma lógica.

### 4. `prioridade` — múltipla escolha em tudo
Converter `prioridade_90d` para `type: "multi"`, enunciado `Qual é a prioridade para os próximos 90 dias? (marque todas que se aplicam)`. Opções:

- Aumentar vendas com campanhas mais bem estruturadas.
- Organizar regras, metas e governança antes de ampliar incentivos.
- Engajar o time com metas claras, acompanhamento e reconhecimento.
- Reduzir retrabalho, erro operacional e tempo de conferência.

`dor_principal` permanece `multi`. `computeScores` já trata `multi` somando cada opção.

### 5. Todas as perguntas ficam `required: true`
Todas as questões de todos os blocos recebem `required: true`, **incluindo `formatos_uso`** (que deixa de ser opcional e passa a exigir pelo menos uma opção marcada antes de avançar).

### 6. `computeScores` — ajuste do baseline `pagamentos`
Adicionar baseline `+6` a `pagamentos` no start (paralelo ao baseline 30 de `governanca`) para permitir que `complexidade_encerramento` use `scaleWeight` negativo produzindo contribuição efetiva positiva quando a nota é baixa. Sem alterar demais scorings existentes.

### 7. `buildDiagnostico`
Reinserir regras de `pontos_atencao` para `meio_pagamento` (misto/manual) e `conciliacao` baixa. Sem outras mudanças.

## Mudanças em `src/pages/TesteMonnera.tsx`

### 1. Remover bloco de confirmação da UI
- Retirar ramo `isConfirmation` e o botão intermediário “Ver diagnóstico”.
- `TOTAL_STEPS = QUESTIONNAIRE.length`.
- Última etapa: botão passa a “Ver diagnóstico” chamando `handleShowResult`.

### 2. Escala 0-5 sem valor pré-selecionado
- Tratar `undefined`/`null` como sem resposta (0 deixa de ser default).
- Nenhum botão selecionado até o clique.
- Extremos: `quase impossível` sob 0 e `simples, rápido e bem controlado` sob 5, usando `minLabel`/`maxLabel` da pergunta como override quando definidos.

### 3. Validação obrigatória com mensagem em vermelho
- `errors: Record<string, string>` em state.
- Ao clicar em “Próximo” / “Ver diagnóstico”, validar todas as `required` do bloco atual (agora inclui `formatos_uso`):
  - `single`: string não vazia.
  - `multi`: array com pelo menos 1 item.
  - `scale05`: `typeof value === "number"`.
- Falha: não avança, marca perguntas e exibe `<p className="text-xs text-destructive mt-1">Escolha ao menos uma opção para seguir.</p>` abaixo do input.
- Erro da pergunta é limpo assim que o usuário responde.

### 4. `handleShowResult`
Mantém `submitDiagnostico(false)` — sem mudanças no fluxo de RPC nem no `leadId`.

## Detalhes técnicos
- `Dimension.pagamentos` preservado; agora recebe sinal real das novas perguntas.
- Sem novas dependências.
- Typecheck via `tsgo` após as edições.

## Critérios de aceite
- Confirmação não aparece; última etapa leva direto ao resultado.
- `campanhas_capacidade` com 5 perguntas; bloco `pagamentos` com as 4 novas perguntas.
- `prioridade_90d` e `dor_principal` são múltipla escolha e somam pesos.
- `formatos_uso` obrigatório: bloqueia avanço sem seleção.
- `complexidade_encerramento`: nota baixa aumenta mais o score `pagamentos`.
- Escala 0-5 sem valor pré-selecionado; labels “quase impossível” / “simples, rápido e bem controlado”.
- Perguntas obrigatórias sem resposta bloqueiam avanço com mensagem vermelha.
- Build/typecheck passam.
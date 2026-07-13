## Objetivo
Enriquecer o diagnóstico do Teste Monnera com quatro blocos acionáveis (`practical_actions`, `next_steps`, `manual_path`, `monnera_path`), exibidos no resultado público e no card comercial. Perguntas, pesos, rotas, tarefas e notificações permanecem inalteradas.

## Arquivos reais no projeto
Confirmado por inspeção:
- `src/lib/testeMonnera.ts` — perguntas, pesos e `buildDiagnostico`.
- `src/pages/TesteMonnera.tsx` — resultado público e envio ao RPC `submit_teste_monnera`.
- `src/components/admin/TesteMonneraSection.tsx` — accordion “Questionário de Qualificação” no card comercial.

Nenhum arquivo novo será criado.

## Modelo dos novos campos
```ts
type PracticalAction = {
  tema: string;
  ponto?: string;
  acao?: string;
  caminho_manual?: string;
  caminho_monnera?: string;
};

interface Diagnostico {
  // ...campos atuais
  practical_actions: PracticalAction[];
  next_steps: string[];
  manual_path: string | string[];
  monnera_path: string | string[];
}
```

Temas usados em `practical_actions`: Governança, Metas & Campanhas, Parceiros, Pagamentos, Engajamento, Prioridade 90d, CNPJs e unidades, Regime tributário.

Frases derivadas por regras determinísticas sobre as respostas: porte, CNPJs, papel na decisão, formatos, separação de verbas, metas, campanhas com parceiros, acesso do time, retorno a parceiros, prioridades 90d, dores, meio de pagamento, complexidade de encerramento, ciclos, regime tributário.

## Mudanças por arquivo

### `src/lib/testeMonnera.ts`
- Adicionar tipo `PracticalAction` e os quatro campos em `Diagnostico`.
- Em `buildDiagnostico`, popular os campos a partir das respostas já usadas.
- Não alterar perguntas, opções, pesos, classificações, scoring nem textos existentes.

### `src/pages/TesteMonnera.tsx`
- Incluir os quatro campos no `payload.result` enviado ao RPC `submit_teste_monnera`.
- Renderizar após pontos de atenção/recomendação atuais:
  1. “O que fazer agora” — `next_steps`.
  2. “Caminho manual” — `manual_path` (string ou lista).
  3. “Como a Monnera pode automatizar” — `monnera_path` (string ou lista).
  4. “Ações práticas por tema” — `practical_actions` agrupado por `tema`, mostrando `ponto`, `acao`, `caminho_manual` e `caminho_monnera` quando presentes.
- Manter ressalva: *“Resultado educativo. Não substitui validação jurídica ou contábil.”*

### `src/components/admin/TesteMonneraSection.tsx`
- Ampliar a interface local `Diagnostico` com os mesmos campos (todos opcionais).
- Exibir os quatro blocos dentro do accordion “Questionário de Qualificação”, abaixo da leitura SDR, em layout compacto com tokens do design system.
- Preservar badge “Reunião solicitada”, caixa de solicitação de contato, respostas, scores, leitura SDR e diagnóstico atual.
- Compatibilidade retro: diagnósticos antigos sem os novos campos continuam abrindo sem erro; blocos vazios não aparecem.

## Persistência
Sem migration. O RPC `submit_teste_monnera` já grava `p_payload.result` como JSON; os novos campos entram no mesmo objeto e são lidos pelo card comercial pelo caminho atual.

## Linguagem
Tom instrutor, prático e comercial. Vetados: “blindagem trabalhista”, “sem risco”, “garantia jurídica”, “parecer jurídico”, “isento automaticamente”, “substituir comissão por prêmio”.

## Fora de escopo
Perguntas, pesos, scoring, rotas, lead parcial, movimentação para Lead Qualificado, tarefa de 24h, notificações, migrations.

## Aceite
- Resultado público exibe os quatro blocos novos, além do conteúdo atual.
- Card comercial exibe os quatro blocos dentro do accordion, sem quebrar nada existente.
- Diagnósticos antigos continuam abrindo sem erro.
- Blocos vazios não aparecem.
- Diagnóstico salvo contém `practical_actions`, `next_steps`, `manual_path`, `monnera_path`.
- `npm run build` passa.
## Objetivo
Deixar os cards de score do resultado do Teste Monnera com linguagem mais clara ao cliente. Sem tocar em perguntas, pesos, scoring, RPC, payload, rotas, tarefas ou notificações.

## Arquivo alterado
- `src/pages/TesteMonnera.tsx` — apenas o bloco de renderização dos cards de classificação e o mapeamento de labels usados na UI.

Nada em `src/lib/testeMonnera.ts` neste passo. Thresholds, tipos internos e cálculo permanecem iguais.
Nada em `TesteMonneraSection.tsx` neste passo. O card comercial continua exibindo o que já mostra.

## Mudanças

1. Adicionar metadados locais no arquivo:
   ```ts
   const scoreCardInfo = {
     governanca: {
       label: "Governança",
       ranges: "0-14 bons sinais | 15-29 pontos de atenção | 30+ alta fragilidade",
       description: "Mede separação entre verbas, regras, aceite, desempenho superior e rastreabilidade.",
       classNames: {
         baixa: "bons sinais de governança",
         media: "pontos de atenção em governança",
         alta: "alta fragilidade operacional",
       },
     },
     campanhas: {
       label: "Campanhas",
       ranges: "0-14 baixa estrutura | 15-29 estrutura parcial | 30+ boa estrutura",
       description: "Indica se a operação consegue criar campanhas, metas, acesso ao time e retorno para parceiros.",
       classNames: {
         baixa: "baixa estrutura para campanhas",
         media: "estrutura parcial para campanhas",
         alta: "boa estrutura para campanhas",
       },
     },
     pagamentos: {
       label: "Pagamentos",
       ranges: "0-7 baixo controle | 8-14 controle parcial | 15+ bom controle",
       description: "Avalia fechamento, conciliação e controle entre cálculo aprovado e valor pago.",
       classNames: {
         baixa: "baixo controle de pagamento",
         media: "controle parcial de pagamento",
         alta: "bom controle de pagamento",
       },
     },
   } as const;
   ```

2. Ajustar o grid de cards do resultado para exibir três cards: Governança, Campanhas e Pagamentos.

3. Cada card deve mostrar:
   - nome do eixo (`label`);
   - pontuação obtida;
   - classificação em texto claro;
   - faixa interpretativa (`ranges`);
   - breve explicação (`description`).

4. Remover da UI a exibição de rótulos crus como `baixa`, `media`, `alta`, `Baixa aderência`, `Aderência moderada`, `Alta aderência`. Não alterar os valores internos usados pelo cálculo — a mudança é somente de apresentação para o cliente.

## Layout
- Layout responsivo: `grid-cols-1 md:grid-cols-3 gap-3`.
- Tipografia e tokens já existentes.
- Manter `text-muted-foreground`, `font-display`, `Card/CardContent` ou componentes equivalentes já usados no arquivo.

## Fora de escopo
Não alterar:
- thresholds de classificação;
- função `classify()`;
- perguntas;
- pesos;
- payload enviado ao RPC;
- card comercial (`TesteMonneraSection.tsx`);
- lead parcial;
- tarefas;
- notificações;
- migrations.

## Aceite
- Cards do resultado mostram pontuação, classificação em linguagem clara, faixa e explicação para Governança, Campanhas e Pagamentos.
- Nenhum card usa mais a palavra "aderência".
- Nenhum card mostra rótulos crus `baixa`, `media` ou `alta`.
- Nenhum cálculo, payload ou fluxo muda.
- Layout responsivo mantido.
- `npm run build` passa.

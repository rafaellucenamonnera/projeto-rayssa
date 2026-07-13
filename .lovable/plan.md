## Objetivo
Destacar, dentro do accordion "Questionário de Qualificação" do card comercial, quando o lead clicou em "Agendar conversa com especialista Monnera".

## Arquivo
`src/components/admin/TesteMonneraSection.tsx`

## Alteração
1. Manter o badge existente `Reunião solicitada` inalterado.
2. Identificar a mesma condição já usada para renderizar o badge `Reunião solicitada`.
3. Usando essa mesma condição, adicionar uma caixa informativa logo após o grupo de badges ou antes do card de diagnóstico.
4. Usar classes já presentes no arquivo:
   - `border-primary/30`
   - `bg-primary/10`
   - `text-primary`
   - `text-muted-foreground`
   - `rounded-md`
   - `p-3`

## Texto da caixa

Linha principal:

```text
O cliente solicitou contato com um especialista Monnera ao final do Teste Monnera.
```

Linha secundária, menor:

```text
Priorize o retorno comercial. O cliente demonstrou interesse ativo em conversar sobre o diagnóstico e próximos passos.
```

## Fora de escopo

Não alterar:

- `AdminLeads.tsx`;
- `TesteMonnera.tsx`;
- perguntas;
- scoring;
- RPCs;
- migrations;
- criação de tarefa;
- notificações;
- movimentação de etapa;
- layout geral.

## Critérios de aceite

- A caixa aparece somente quando o mesmo critério do badge `Reunião solicitada` for verdadeiro.
- O badge `Reunião solicitada` continua visível.
- O restante do accordion, incluindo diagnóstico, scores, leitura SDR e respostas, permanece igual.
- `npm run build` passa.

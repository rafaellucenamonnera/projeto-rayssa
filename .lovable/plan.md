## Objetivo
Ajustar apenas o painel de embaixadores (`painel_mp5q4du9`) em `/admin/painel/:panelId`: esconder campos específicos no card aberto, exibir o bloco de comentários/anexos com botão "Salvar", e adicionar suporte a anexos DOC/DOCX. Nenhum outro painel muda. Nenhuma migration nova.

## Mudanças

### 1) `src/pages/admin/AdminLeads.tsx` (somente dentro do card aberto — Dialog de detalhe)

- Envolver com `{!isAmbassadorPanel && (...)}` cada um destes blocos existentes:
  - `Qtd Lojas` (linhas ~2222–2229)
  - `ERP / Sistema` (linhas ~2230–2237)
  - `Qtd Funcionários` (linhas ~2238–2245)
  - `Tipo de empresa` (linhas ~2246–2261)
  - `Canal de tração` (linhas ~2262–2269)
  - Bloco `Embaixador Monnera` (linhas ~2331–2342)
  - Bloco `Valor Médio de Campanhas` (linhas ~2400–2406)
- No bloco de comentários, passar `submitLabel={isAmbassadorPanel ? "Salvar" : "Enviar"}` para o `LeadComments`. Manter as demais props (`leadId`, `currentStage`, `userName`, `actionBasePath`, `canInsertMessage`, `canEditMessage`, `canDeleteMessage`, `canInsertFile`).

Nenhuma outra lógica é tocada (kanban, drag&drop, edição, clonagem, permissões, automações, tarefas, reuniões, contatos, contrato, dossiê, etc.).

### 2) `src/components/admin/LeadComments.tsx`

- Adicionar prop opcional `submitLabel?: string` com default `"Enviar"`.
- Trocar o texto fixo `Enviar` do botão de envio por `{submitLabel}` (mantendo o ícone `Send`).
- No `allowedMimeTypes` local do componente, acrescentar:
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Na validação por extensão, aceitar também `.doc` e `.docx`.
- No `accept` do `input type="file"`, acrescentar `.doc,.docx`.
- Não remover nenhum formato já existente.

Nenhuma mudança em persistência: continua gravando `usuario`, `user_id` e `data_comentario` em `lead_comments` como hoje. Menções, anexos e edição continuam iguais.

## Fora de escopo (não alterar)
- `pipeline_panels`, `pipeline_stages_config`, kanban, arrastar-e-soltar, tarefas, clonagem, automações, permissões, criação/exclusão de painel, `AmbassadorCardTasks`, integrações, storage/bucket, RLS.
- Nenhuma migration nem tabela nova.
- Não alterar `src/lib/campaignFlow.ts` nem `src/components/admin/CommentAttachments.tsx`.

## Validação
- `npm run build` (o harness roda automaticamente após aplicar).
- Smoke manual: abrir `/admin/painel/painel_mp5q4du9`, abrir um card e conferir ausência dos 5 campos + 2 blocos; enviar um comentário com botão "Salvar"; anexar PDF/JPG/PNG/DOC/DOCX; editar comentário; verificar `usuario`/data/hora; conferir que outro painel (ex.: comercial) continua mostrando os campos, bloco Embaixador Monnera, Valor Médio, e botão "Enviar".
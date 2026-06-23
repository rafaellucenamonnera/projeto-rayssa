## Escopo

Duas mudanças de frontend, sem alterações de banco, Edge Functions, RLS ou tabelas.

### 1. Fluxo opcional de financeiro ao mover card para "Proposta Enviada"

**`src/components/admin/CadastroFinanceiroDialog.tsx`**
- Adicionar prop opcional `allowSkipValidation?: boolean` (nome consistente com `AdminLeads.tsx`).
- Quando `allowSkipValidation` for `true`, exibir checkbox `Dados financeiros não obrigatórios nesta proposta`.
- Quando o checkbox estiver marcado:
  - pular obrigatoriedade dos campos financeiros (setup, mensalidade, qtdLojas, campanhas);
  - manter inválidos valores negativos;
  - se `quantidade_lojas` estiver vazia ou inválida, usar `1`;
  - **NÃO** sobrescrever campos existentes com `0` quando o usuário não digitou nada — montar payload condicional do `update`:
    - só incluir cada campo financeiro se o usuário preencheu um valor novo, OU se já existia valor efetivo em `initialData` (preservando-o);
    - campos não tocados e sem valor anterior ficam fora do payload;
  - continuar chamando `onSaved` com os valores efetivos (preenchidos ou herdados) para que o fluxo encadeie `PropostaComercialDialog`.
- Quando o checkbox estiver desmarcado (ou `allowSkipValidation` for `false`/omitido): manter as validações financeiras atuais.
- Atualizar o texto do aviso amarelo para explicar que, na proposta comercial, os dados podem ser dispensados quando a negociação ainda não exigir valores fechados.

**`src/pages/admin/AdminLeads.tsx`**
- No fluxo que trata mudança de status/coluna (`handleStatusChange`, `requestStatusChange` ou `handleDragEnd`, conforme nome no projeto), ao mover para `proposta_enviada` ou `proposta_comercial`:
  - abrir primeiro `CadastroFinanceiroDialog`;
  - preencher `pendingFinanceiro` com `{ leadId, leadName, parceiroId, nextStatus: newStatus, lead }`;
  - renderizar `CadastroFinanceiroDialog` com `allowSkipValidation={true}` (apenas neste caso).
- `handleFinanceiroSaved` já encadeia para abertura da proposta quando `nextStatus` é `proposta_*` — manter, garantindo que abre `PropostaComercialDialog` (modal usado hoje para a proposta rastreável), não `PropostaUploadDialog`.
- Substituir proposta existente continua abrindo direto `PropostaComercialDialog`, sem passar pelo financeiro.
- `contrato_assinado` e demais etapas continuam exigindo financeiro completo, sem `allowSkipValidation`.

### 2. Página pública `/proposta/:token` com CTA de aceite

`src/pages/PropostaPublica.tsx` já existe e a rota `/proposta/:token` já está registrada em `src/App.tsx`. **Não criar página nova nem duplicar rota.** Apenas ajustar a página existente para garantir:

- Carregamento público (sem login) via RPC `get_public_commercial_proposal`.
- Se `accepted_at` existir, mostrar selo `Proposta aceita em <data>` e ocultar o CTA.
- Caso contrário, mostrar CTA flutuante fixo `Aceitar proposta comercial`.
- Ao clicar no CTA, abrir modal com:
  - nome obrigatório;
  - email obrigatório;
  - texto: `Declaro que li e aceito a proposta comercial Monnera, incluindo escopo, condições comerciais, valores, prazos e demais termos apresentados. Ao confirmar, o aceite será registrado no painel Monnera para acompanhamento do time comercial.`;
  - botão `Aceitar proposta comercial`.
- Ao confirmar, chamar RPC `accept_commercial_proposal` com:
  - `p_token`
  - `p_accepted_by_name`
  - `p_accepted_by_email`
  - `p_accepted_ip: null`
  - `p_accepted_user_agent: navigator.userAgent`
- Após sucesso: atualizar UI com status aceito e exibir toast. A notificação ao criador é responsabilidade da RPC já existente.

### Critérios de aceite

- Mover card de `Reunião Realizada` para `Proposta Enviada` abre primeiro `Dados financeiros do contrato`.
- Marcar `Dados financeiros não obrigatórios nesta proposta` permite salvar sem preencher tudo e, em seguida, abre `PropostaComercialDialog`.
- Valores financeiros existentes nunca são sobrescritos por `0` quando o checkbox está marcado e o campo ficou vazio.
- Sem marcar o checkbox, as validações financeiras atuais permanecem.
- Substituir proposta continua abrindo direto `PropostaComercialDialog`.
- `contrato_assinado` e demais etapas continuam exigindo financeiro completo.
- `/proposta/:token` carrega sem login, mostra CTA flutuante, modal de confirmação e chama `accept_commercial_proposal`.
- Build passa.
- Sem alterações em banco, Edge Functions, RLS ou tabelas.

## Objetivo
Substituir o modal antigo `PropostaUploadDialog` (upload de PDF) por um gerador editável de proposta comercial Monnera em React, no fluxo de mover card para `proposta_enviada` / `proposta_comercial`. Sem `file://`. A proposta gerada grava em `commercial_proposals`, gera link público `/proposta/:token` e atualiza `lead.proposta_url`.

## Mudanças

### 1. Novo componente `src/components/admin/PropostaComercialDialog.tsx`
Dialog do shadcn, editável. Props:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `lead: any` (objeto completo — deriva `lead.id`, `lead.nome_fantasia`, financeiro etc.)
- `onSuccess: (publicUrl: string, proposalName: string) => void`
- `onCancel: () => void`

Seções:
- **Identificação**: `proposal_name` (default `Proposta Monnera - <nome_fantasia> - <data>`), `cliente`, `contato_nome`, `contato_email`, `contato_telefone` (defaults do lead).
- **Escopo**: `objetivo` (textarea), `escopo_itens` (lista dinâmica add/remove com `titulo`/`descricao`).
- **Comercial** (Switch `omit_financials`): `valor_setup`, `valor_mensalidade`, `valor_campanhas`, `qtd_parcelas` (defaults do lead); ao omitir, exibir `omit_financials_reason`.
- **Prazos e Condições**: `prazo_implantacao`, `validade_proposta`, `condicoes_pagamento`, `observacoes`.

Ações: `Cancelar`, `Gerar proposta`.

### 2. Submissão
```ts
const token = crypto.randomUUID().replace(/-/g, "");
const publicUrl = `${window.location.origin}/proposta/${token}`;
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("commercial_proposals").insert({
  lead_id: lead.id, token, proposal_name, payload,
  omit_financials, omit_financials_reason: omit_financials ? reason : null,
  public_url: publicUrl, created_by_user_id: user?.id ?? null,
});
```
Em sucesso: copiar link (`navigator.clipboard.writeText`), toast, `onSuccess(publicUrl, proposal_name)`, fechar.

### 3. Integrar em `src/pages/admin/AdminLeads.tsx`
- Remover import `PropostaUploadDialog`; adicionar `PropostaComercialDialog`.
- Manter estado `uploadDialogOpen` (renomear para `proposalDialogOpen` fica para depois — não bloqueia).
- `handleFinanceiroSaved` mantém `setPendingStatusChange` + `setUploadDialogOpen(true)` no branch `proposta_enviada` / `proposta_comercial`.
- `handleReplaceProposta` reabre o mesmo `PropostaComercialDialog`.
- Substituir JSX:
  ```tsx
  <PropostaComercialDialog
    open={uploadDialogOpen}
    onOpenChange={setUploadDialogOpen}
    lead={leads.find(l => l.id === pendingStatusChange?.leadId)}
    onSuccess={handlePropostaGerada}
    onCancel={handlePropostaUploadCancel}
  />
  ```
- Substituir `handlePropostaUploadSuccess` por `handlePropostaGerada(publicUrl, proposalName)`:
  - `replaceOnly` → `updatePropostaUrl(leadId, publicUrl, proposalName)`.
  - Caso contrário → `updateStatus(leadId, "proposta_enviada", publicUrl, proposalName)`.

### 4. Limpeza
- Remover `src/components/admin/PropostaUploadDialog.tsx` (uso único confirmado em `AdminLeads.tsx`).
- Nada em `public/`.

### 5. Sem banco
- `commercial_proposals`, RPCs `get_public_commercial_proposal`, `accept_commercial_proposal` e rota `/proposta/:token` já existem.

## Restrições
- Sem alterações em banco, RLS, Edge Functions, Storage, tabelas.
- Não tocar no fluxo financeiro (continua antes do gerador, com `allowSkipValidation`).
- Sem `file://`.
- Não sobrescrever campos do lead com 0; somente ler para defaults.

## Critérios de aceite
- Mover card para `Proposta Enviada` → financeiro → `PropostaComercialDialog` (não mais upload de PDF).
- `commercial_proposals` recebe registro com `token`, `payload`, `public_url`.
- `lead.proposta_url` recebe `/proposta/:token`.
- Card vai para `proposta_enviada`.
- Link público abre, exibe a proposta e permite aceite.
- `PropostaUploadDialog` removido sem referências.
- Build e typecheck passam.

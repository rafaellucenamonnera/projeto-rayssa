## Objetivo
Criar versão funcional mínima da página pública de proposta comercial, focando no fluxo de aceite via link público. Sem alterações de banco, Edge Functions ou RLS.

## Mudanças

### 1. Novo arquivo `src/pages/PropostaPublica.tsx`
Página pública, com:

- `useParams<{ token: string }>()` para ler o token da URL.
- No mount: chamar `supabase.rpc('get_public_commercial_proposal', { p_token: token })`.
- Estados: `loading`, `error`, `proposal`, `accepting`, `modalOpen`, `name`, `email`.
- Renderização condicional:
  - **Loading**: spinner centralizado.
  - **Erro / não encontrada**: card amigável "Proposta não encontrada ou link inválido".
  - **Carregada**: header com nome da proposta + dados básicos do payload (resumo simples).
  - Se `accepted === true` (ou `accepted_at` presente): badge `Proposta aceita em <data formatada pt-BR>`. CTA oculto.
  - Caso contrário: CTA flutuante fixo (`fixed bottom-6 right-6 z-50`) `Aceitar proposta comercial`.

### 2. Fallback flexível para identificação do cliente
Na renderização, montar o nome do cliente exibido seguindo esta ordem:
- `proposal.proposal_name`
- `proposal.payload?.company`
- `proposal.payload?.leadName`
- `proposal.lead?.nome_fantasia`
- `"Cliente Monnera"` (fallback final)

### 3. Modal de aceite (Dialog do shadcn, inline)
- Inputs obrigatórios: nome, email (validação regex simples).
- Texto legal:
  > Declaro que li e aceito a proposta comercial Monnera, incluindo escopo, condições comerciais, valores, prazos e demais termos apresentados. Ao confirmar, o aceite será registrado no painel Monnera para acompanhamento do time comercial.
- Botão `Aceitar proposta comercial` (desabilitado se vazios ou `accepting`).
- Botão `Cancelar`.

### 4. Submissão do aceite
```ts
supabase.rpc('accept_commercial_proposal', {
  p_token: token,
  p_accepted_by_name: name.trim(),
  p_accepted_by_email: email.trim().toLowerCase(),
  p_accepted_ip: null,
  p_accepted_user_agent: navigator.userAgent,
})
```
- Sucesso: fechar modal, atualizar `proposal` local com `accepted_at = now`, toast `sonner` de sucesso.
- `already_accepted: true`: tratar como sucesso e atualizar UI.
- Erro: toast amigável.

### 5. Registro de rota em `src/App.tsx`
- Adicionar `const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));`
- Adicionar `<Route path="/proposta/:token" element={<PropostaPublica />} />` fora das rotas administrativas protegidas.
- A página pode estar dentro da árvore global de providers, mas não deve exigir usuário logado nem chamar dados protegidos por auth.

## Estilo
- Container centralizado max-w-3xl, padding generoso.
- Tokens semânticos do design system (sem cores hardcoded), tema escuro Monnera.
- Tipografia hierárquica: título da proposta destacado, dados em cards.

## Restrições
- Não alterar banco, RLS, Edge Functions, tabelas ou Storage.
- Não alterar fluxo financeiro já implementado.
- Não criar componentes novos além de `PropostaPublica.tsx` (modal inline).
- Renderização do payload mantida simples — refinamento visual fica para rodada futura quando os assets do gerador chegarem.

## Critérios de aceite
- `/proposta/:token` abre sem login.
- Token inválido → mensagem amigável.
- Token válido → renderiza proposta básica.
- CTA aparece somente quando não aceito.
- Aceite chama `accept_commercial_proposal` com os 5 parâmetros corretos.
- Após aceite: CTA some, badge de aceito aparece, toast de sucesso.
- Build e typecheck passam.
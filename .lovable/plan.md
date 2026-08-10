# Corrigir duplicidade no painel Onb Clientes Cross

Hoje o cadastro falha com "duplicate key ... representative_cards_panel_phone_uniq" porque telefone e e-mail são únicos por painel. A regra correta: **apenas o CNPJ deve ser único**; nome, telefone, e-mail e demais campos podem repetir.

## O que muda

- Telefone e e-mail deixam de ser únicos no painel Onboarding Clientes Cross (continuam únicos nos outros painéis, como hoje).
- CNPJ passa a ser único dentro desse painel (ignorando cards sem CNPJ).
- A mensagem "Já existe cadastro com este telefone ou e-mail" é substituída por uma verificação de CNPJ duplicado, com aviso claro antes de salvar.

## Detalhes técnicos

1. Migração no banco:
   - Recriar `representative_cards_panel_phone_uniq` e `representative_cards_panel_email_uniq` como índices parciais com `WHERE panel_id <> 'painel_msj9fyji'`.
   - Criar `representative_cards_panel_cnpj_uniq` em `(panel_id, cnpj) WHERE cnpj IS NOT NULL`.
   - Antes disso, checar se já existem CNPJs repetidos nesse painel; se houver, o índice único não é criado até a duplicidade ser resolvida.

2. Frontend `src/components/admin/ClienteCrossDialog.tsx`:
   - Remover qualquer bloqueio por telefone/e-mail nesse fluxo.
   - Ao salvar (criação e edição), consultar `representative_cards` por `panel_id` + `cnpj` e exibir toast "Já existe um cliente com este CNPJ." quando houver conflito.
   - Tratar o erro de índice único vindo do banco com a mesma mensagem amigável.

3. Verificação: typecheck limpo e teste manual criando dois clientes com o mesmo telefone/e-mail (deve permitir) e com o mesmo CNPJ (deve bloquear).

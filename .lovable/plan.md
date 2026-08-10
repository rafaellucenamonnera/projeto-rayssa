# Corrigir erro ao salvar "Add Cliente" (CNPJ do Parceiro)

## O que está acontecendo

O formulário envia o campo **CNPJ do Parceiro**, mas a tabela dos cards deste painel (`representative_cards`) não possui essa coluna — confirmado na consulta ao banco. Por isso o salvamento falha com "Could not find the 'cnpj' column" e o card não aparece no funil.

## Correção

1. Migração de banco: adicionar a coluna `cnpj` (texto, opcional) em `representative_cards`.
2. Nenhuma mudança de formulário é necessária — os demais campos (focal, contratante, vendedor, anotações, anexos) já existem.
3. Verificação: criar um cliente com CNPJ preenchido, confirmar que o card aparece na coluna "Cadastro", reabrir e editar.

## Detalhes técnicos

- `ALTER TABLE public.representative_cards ADD COLUMN IF NOT EXISTS cnpj text;`
- Sem alteração de RLS/GRANTs (a tabela já está configurada).
- Após a migração, os tipos do backend são regerados e o typecheck é executado.

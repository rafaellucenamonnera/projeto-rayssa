# Links personalizados no card do Embaixador Monnera

## O que será feito

No painel Embaixadores Monnera, ao abrir o card de um embaixador, será exibida uma nova seção **Links personalizados** com todos os links existentes daquele embaixador:

- Cadastro de lead por código: `/lead/<CODIGO>` (código fixo, não editável)
- Link de indicação: `/indicacao/<nome-final>`
- Teste Monnera: `/testemonnera/<nome-final>`

Cada link terá:
- exibição completa da URL
- botão **Copiar**

E acima deles um campo **Nome final do link** (o trecho após a barra), com botão **Editar / Salvar**, que atualiza os dois links personalizados de uma vez.

## Regras

- O nome final é normalizado automaticamente: minúsculas, sem acentos, espaços viram hífen, apenas letras/números/hífen.
- Validação: mínimo 3 caracteres e precisa ser único entre os embaixadores; se já existir, mostra erro claro.
- Somente administradores podem editar o nome final (as regras de segurança do banco já bloqueiam os demais); para não-admins os links aparecem em modo leitura com botão copiar.
- Se o embaixador ainda não tiver nome final definido, os links usam o código do embaixador como hoje, e ao salvar um nome final passam a usar o novo trecho.
- Links antigos deixam de funcionar após a alteração (comportamento já existente).

## Detalhes técnicos

- Arquivo principal: `src/pages/admin/AdminLeads.tsx`, no bloco de detalhe do card quando `isAmbassadorPanel` é verdadeiro. O parceiro é localizado por `detailLead.parceiro_id` / `partner_code` em `parceirosAll`.
- Nova seção extraída para um componente próprio, `src/components/admin/AmbassadorLinksSection.tsx`, recebendo `parceiroId`, `codigoParceiro` e `slugConsultor`.
- Salvamento: `update` em `public.parceiros_comerciais` (`slug_consultor`), permitido pela política "Admins can update parceiros"; o trigger existente ignora a alteração para não-admins, então o botão de edição só aparece para admin.
- Checagem de unicidade com consulta prévia por `slug_consultor` antes do update e tratamento do erro de duplicidade.
- Base das URLs: `window.location.origin`, igual ao padrão já usado no projeto.
- Sem alterações de banco de dados.

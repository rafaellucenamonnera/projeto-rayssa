## Aplicar diff em AdminPipelineEdit.tsx

### O que muda
Substitui o fluxo atual (criação por `prompt()` com coluna "Novo" automática) por um formulário inline na própria página:

1. **Formulário inline para novo painel**:
   - Campo de texto `Nome do novo painel` (state `newPanelName`).
   - Lista editável de colunas (state `newColumns`, inicia com `["Novo"]`).
   - Botão `+ Coluna` para adicionar e ícone de lixeira para remover (mínimo 1).
   - Botão "Salvar" com spinner via `creatingPanel`.

2. **Validações na criação**:
   - Nome obrigatório (trim).
   - Nome duplicado bloqueado (case-insensitive).
   - Pelo menos uma coluna não-vazia.
   - Sem colunas duplicadas (case-insensitive).

3. **Criação em lote + rollback**:
   - Insere o painel e em seguida insere todas as colunas (`pipeline_stages_config`) com `value = etapa_${newId}_${index+1}`.
   - Se falhar a inserção das colunas, deleta o painel para evitar órfão.

4. **Nova permissão `canManagePanels`**:
   - Calculada em `loadPermission` checando `module_permissions` com `acao IN ('editar','criar_estagio')` no módulo `configuracao_painel`.
   - Substitui a checagem `isAdmin` para criação de painéis: usa `(isAdmin || canManagePanels)` no botão Salvar e nos campos do formulário.
   - Exclusão de painel continua restrita a `isAdmin`.

5. **Reset pós-criação**: limpa `newPanelName` e volta `newColumns` para `["Novo"]`.

### Escopo
- Apenas `src/pages/admin/AdminPipelineEdit.tsx`.
- Sem mudanças de schema, RLS ou backend. Assume que `module_permissions` já suporta `acao IN ('editar','criar_estagio')` no módulo `configuracao_painel`.

### Pontos de atenção
- O diff remove o uso de `window.prompt()` introduzido na iteração anterior — o formulário inline o substitui.
- Não há reordenação de colunas no formulário (ordem = ordem de digitação).
- Usuários não-admin com `canManagePanels` podem criar painéis mas **não** excluir.

### Como testar
1. `/admin/pipeline/edit` como admin: digitar nome + colunas → Salvar → painel aparece selecionado com as colunas criadas.
2. Tentar salvar sem nome / com nome duplicado / sem colunas / com colunas duplicadas → toast de erro.
3. Adicionar/remover colunas via `+ Coluna` e ícone de lixeira.
4. Como usuário não-admin com permissão `editar`/`criar_estagio` em `configuracao_painel`: deve conseguir criar, mas botão Excluir Painel some.

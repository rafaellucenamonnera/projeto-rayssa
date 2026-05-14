## Aplicar diff em AdminPipelineEdit.tsx

### O que muda
A página de edição de painéis (`/admin/pipeline/edit`) recebe melhorias no fluxo de criação de painéis:

1. **Nome personalizado**: ao clicar em "Novo Painel", o admin digita o nome via `prompt()` em vez de criar "Novo Painel" genérico.
2. **Validações**:
   - Nome não pode ser vazio.
   - Nome não pode duplicar um painel existente (comparação case-insensitive).
3. **Coluna padrão automática**: ao criar o painel, uma coluna "Novo" é criada automaticamente no estágio inicial.
4. **Rollback em caso de falha**: se a criação da coluna padrão falhar, o painel recém-criado é excluído para evitar registros órfãos.
5. **Estado de carregamento**: botão "Salvar" mostra spinner (`Loader2`) e fica desabilitado enquanto o painel está sendo criado, prevenindo cliques duplos.

### Escopo
- **Apenas um arquivo**: `src/pages/admin/AdminPipelineEdit.tsx`
- Sem alterações de backend, schema ou banco de dados.

### Como testar
1. Acessar `/admin/pipeline/edit` como admin.
2. Clicar em "Novo Painel".
3. Informar um nome e confirmar.
4. Verificar que o painel aparece com uma coluna "Novo".
5. Tentar criar com nome duplicado → deve aparecer toast de erro.
6. Tentar criar sem nome → deve aparecer toast de erro.
## Ordenação de painéis no menu lateral

Adicionar controle de ordem dos painéis dinâmicos na tela “Edição de Painel”, refletindo imediatamente no menu lateral do gestor. Usa apenas o campo existente `pipeline_panels.sort_order` — sem migration, sem tabela nova, sem alterar `id`, rotas, permissões, cards, etapas ou filtros.

### 1. `src/pages/admin/AdminPipelineEdit.tsx`

Nova seção **“Ordem dos painéis no menu”**, acima ou próxima da lista atual de painéis:

- Renderiza `panels` já carregados via `loadPanels()` (já ordenados por `sort_order`).
- Cada linha mostra: posição (1, 2, 3…), nome do painel e dois botões (ícones `ChevronUp` / `ChevronDown`, lucide-react).
- Botão “Subir” desabilitado no primeiro item; “Descer” no último.
- Ao clicar:
  1. Recalcula a nova ordem localmente (troca com o vizinho).
  2. Normaliza `sort_order` como `1..N` sequencial.
  3. Persiste no banco em uma única passada — `Promise.all` de `update({ sort_order }).eq("id", panel.id)` para cada painel afetado (na prática todos, para garantir sequência limpa).
  4. Em caso de erro: `toast.error` e recarrega estado do banco (rollback natural via `loadPanels`).
  5. Em caso de sucesso: `toast.success`, chama `loadPanels()` e dispara um `window.dispatchEvent(new CustomEvent("pipeline-panels-updated"))` para o sidebar reagir.
- `selectedPanelId` é preservado (a lista é recarregada mas o id atual continua válido).
- Enquanto o update roda, botões ficam `disabled` para evitar cliques concorrentes.

Nada mais do arquivo é tocado — a lista de painéis à esquerda (linha 812) continua funcionando igual, apenas passará a exibir na nova ordem porque `loadPanels()` já ordena por `sort_order`.

### 2. `src/components/AdminSidebar.tsx`

Hoje `loadPanels` roda uma única vez no `useEffect([])`. Ajuste mínimo:

- Extrair `loadPanels` do `useEffect` para poder ser reutilizado.
- Adicionar listener no mesmo `useEffect`:
  ```ts
  window.addEventListener("pipeline-panels-updated", loadPanels);
  return () => window.removeEventListener("pipeline-panels-updated", loadPanels);
  ```
- Nenhuma mudança em filtros (`isAdmin || canAccessPanel`), rotas, itens fixos ou lógica de collapse. Usuários com acesso limitado continuam vendo somente o subconjunto permitido, agora respeitando a nova ordem relativa.

### Fora de escopo (não mexer)

- Migrations, `user_panel_permissions`, `module_permissions`, `pipeline_stages_config`, cards, leads.
- Nomes, ids, rotas `/admin/painel/:panelId`.
- Fluxo de criar/renomear/excluir painel — só o `sort_order` muda.
- Atualização de dependências.

### Validação

- `npm run build` e `npm test` (harness roda automaticamente).
- Smoke manual mental: mover “Painel X” para cima na tela → toast de sucesso → sidebar reordena sem refresh → F5 mantém a ordem → abrir painel reordenado continua carregando etapas normalmente.

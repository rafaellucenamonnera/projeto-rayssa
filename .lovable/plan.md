## Contexto

A sincronização Lovable ↔ GitHub é automática e bidirecional — não há comando manual para "puxar" um commit. Verifiquei o estado atual de `src/pages/admin/AdminDashboard.tsx` contra o commit `1c9a48b Adiciona dias totais no dashboard comercial`:

| Item esperado | Estado atual |
|---|---|
| Coluna "Dias na etapa" em Leads Mais Tempo na Mesma Etapa | Existe como "Dias" (precisa renomear) |
| Coluna "Dias totais" (desde `data_cadastro`) | **Faltando** |
| Indicador "Taxa de Conversão" | Existe como "Conversão Geral" (precisa renomear) |
| Cálculo `contrato_assinado / total_leads * 100` | Já correto (linha 183-185) |

Como o commit não chegou via sync, vou aplicar as mudanças diretamente no arquivo (DB-only não é necessário — tudo é frontend).

## Mudanças em `src/pages/admin/AdminDashboard.tsx`

1. **Interface `StalledLead`**: adicionar campo `dias_totais: number`.
2. **Query de detalhes do lead** (linha ~155-158): incluir `data_cadastro` no `select`.
3. **Mapeamento em `stalled`** (linha ~160-172): calcular `dias_totais = floor((Date.now() - new Date(lead.data_cadastro)) / 86400000)`.
4. **Card "Leads Mais Tempo na Mesma Etapa"** (linha ~382-408):
   - Renomear cabeçalho `Dias` → `Dias na etapa`.
   - Adicionar nova coluna `Dias totais` à direita.
   - Renderizar `{l.dias_totais}d` na nova célula (sem coloração ou cor neutra `text-muted-foreground`).
5. **Card de indicador** (linha ~267): renomear `Conversão Geral` → `Taxa de Conversão`.

## Validação

- Build limpo (sem erros TS).
- Abrir `/admin` → conferir card com nova coluna "Dias totais" e label "Taxa de Conversão".

Sem alterações de banco, edge functions ou outras telas.
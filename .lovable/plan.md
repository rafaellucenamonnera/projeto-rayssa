# Renomear "Consultor" → "Embaixador Monnera"

## Escopo

Substituir, em **todos os textos visíveis ao usuário**, o termo "Consultor" / "Consultor Comercial" / "Consultores" pelo equivalente "Embaixador Monnera" / "Embaixadores Monnera".

Sem alterações em lógica, banco de dados, rotas, identificadores de código ou variáveis.

## Mapa de substituições (apenas strings de UI)

| Original | Novo |
|---|---|
| Consultor / Consultor Comercial | Embaixador Monnera |
| Consultores | Embaixadores Monnera |
| consultor (minúsculo em frase) | embaixador Monnera |
| consultores (minúsculo) | embaixadores Monnera |

## Arquivos afetados (somente strings de interface)

- `src/components/AdminSidebar.tsx` — item "Consultores" do menu
- `src/pages/Index.tsx` — "consultores comerciais", "Quero ser Consultor", "Já sou Consultor"
- `src/pages/LoginParceiro.tsx` — título "Acesso do Consultor", textos e toast
- `src/pages/CadastroParceiro.tsx` — título "Cadastro de Consultor Comercial", descrição e mensagens de erro
- `src/pages/ConfirmacaoCadastro.tsx` — "Código do consultor"
- `src/pages/CadastroLead.tsx` — mensagens "Link inválido ou consultor inativo", "Indicação do consultor ..."
- `src/pages/PainelParceiro.tsx` — título "Painel do Consultor"
- `src/pages/admin/AdminParceiros.tsx` — confirms e toasts ("Excluir o consultor ...", "Consultor excluído", "Consultor aprovado/desaprovado")
- `src/pages/admin/AdminDashboard.tsx` — labels "Consultor", "Consultores", "Ranking de Consultores"
- `src/pages/admin/AdminFinanceiro.tsx` — placeholder "Filtrar por Consultor", "Todos os Consultores", títulos "Comissões por Consultor", "Previsão por Consultor", header CSV "Consultor", coluna "Consultor", "Nenhum consultor encontrado"
- `src/pages/admin/AdminLeads.tsx` — placeholder "Consultor", "Todos Consultores", coluna "Consultor", labels "Consultor", "Consultor responsável"
- `src/components/admin/LeadExportButton.tsx` — header CSV "Consultor"
- `src/components/admin/LeadImportDialog.tsx` — labels visíveis
- `src/components/admin/CadastroFinanceiroDialog.tsx` — labels visíveis
- `src/components/admin/PipelineKanban.tsx` — labels visíveis
- `src/components/parceiro/AddLeadDialog.tsx` — textos visíveis
- `src/pages/admin/AdminKitVendas.tsx` — texto visível

## NÃO será alterado

- Nomes de variáveis, props, interfaces (`ConsultorData`, `selectedConsultor`, `filterConsultor`, `slugConsultor`, etc.)
- Coluna/campo de banco `consultor` (representa o CS importado da planilha — conceito diferente, mantido como está)
- Funções RPC (`get_financeiro_consultores`, `lookup_parceiro_by_slug`, `register_parceiro`, etc.)
- Rotas (`/admin/parceiros`, `/parceiro`, etc.) e parâmetros de URL (`slugConsultor`)
- Arquivo `src/integrations/supabase/types.ts` (auto-gerado)
- Lógica de negócio, RLS, edge functions

## Observação sobre memória do projeto

A regra atual em memory diz "Usar 'Consultor Comercial', NUNCA 'Parceiro' ou 'Agente'". Após a aprovação, atualizarei essa regra para refletir a nova nomenclatura "Embaixador Monnera".

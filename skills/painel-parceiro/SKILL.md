---
name: painel-parceiro
description: Use esta skill sempre que uma tarefa envolver o painel do parceiro: cadastro de parceiro, login de parceiro, cadastro de leads pelo parceiro, kit de vendas, primeiro acesso, reset de senha, formulario de conversao publica ou qualquer feature voltada ao usuario parceiro (nao admin). Ela define o fluxo, as permissoes e os componentes do lado do parceiro no sistema Monnera.
---

# Painel Parceiro Monnera

## Conceito

O **parceiro** e uma empresa ou pessoa que indica leads para a Monnera. Ele tem acesso a um painel proprio com permissoes restritas — ve apenas seus proprios leads e recursos comerciais.

O **admin/gestor_conta** opera o CRM completo e ve todos os leads e paineis.

## Paginas do Parceiro

| Arquivo | Rota | Descricao |
|---|---|---|
| `LoginParceiro.tsx` | `/login` | Login do parceiro |
| `PrimeiroAcesso.tsx` | `/primeiro-acesso` | Definir senha no primeiro acesso |
| `EsqueciSenha.tsx` | `/esqueci-senha` | Solicitar reset de senha |
| `ResetarSenha.tsx` | `/resetar-senha` | Nova senha via link de email |
| `PainelParceiro.tsx` | `/painel` | Dashboard principal do parceiro |
| `CadastroLead.tsx` | `/cadastro-lead` | Cadastrar novo lead (autenticado) |
| `CadastroParceiro.tsx` | `/cadastro-parceiro` | Auto-cadastro de parceiro |
| `ConfirmacaoCadastro.tsx` | `/confirmacao` | Tela apos cadastro bem-sucedido |
| `FormularioConversao.tsx` | `/conversao/:token` | Formulario publico de conversao (sem login) |

## Componentes do Parceiro

### AddLeadDialog (`src/components/parceiro/AddLeadDialog.tsx`)
Dialog para cadastrar novo lead a partir do painel.
Campos obrigatorios: nome_fantasia, nome_responsavel, telefone_responsavel, origem.
Ao cadastrar: lead criado com `parceiro_id` do parceiro logado.

### KitVendasSection (`src/components/parceiro/KitVendasSection.tsx`)
Secao do painel que exibe materiais de venda:
- Argumentos de objecao (`kit_argumentos`) — por pilar
- Portfolio em PDF (`kit_portfolio`)
- Videos (`kit_videos`)
- Posts de redes sociais (`kit_redes_sociais`)
- Mensagens prontas para WhatsApp (`kit_whatsapp_messages`)

## Fluxo de Primeiro Acesso

1. Admin cria o parceiro via `AdminParceiros.tsx` → Edge Function `admin-create-user`
2. Parceiro recebe email com link de primeiro acesso
3. Parceiro acessa `/primeiro-acesso` e define sua senha
4. Parceiro faz login em `/login` e acessa `/painel`

## Formulario Publico de Conversao

Rota: `/conversao/:token`
Arquivo: `FormularioConversao.tsx`

- Nao requer login
- Token unico por lead (`leads.completion_token`)
- Permite que o proprio lead preencha seus dados
- Apos preenchimento: `leads.dados_completos = true`

## Permissoes do Parceiro

- Ve **apenas** leads com `leads.parceiro_id = seu id`
- Nao tem acesso ao painel admin
- Nao ve dados financeiros detalhados de outros parceiros
- Pode cadastrar novos leads
- Pode acessar todo o kit de vendas

## Kit de Vendas — Tabelas

| Tabela | Conteudo |
|---|---|
| `kit_argumentos` | Pilar, objecao, resposta — ordenados por `ordem` |
| `kit_portfolio` | PDFs ativos (`ativo = true`) com titulo |
| `kit_videos` | Videos com thumbnail, titulo, subtitulo, descricao |
| `kit_redes_sociais` | Links com titulo, comentario e imagem |
| `kit_whatsapp_messages` | Mensagens prontas com titulo, subtitulo e imagem |

Gerenciados pelo admin em `AdminKitVendas.tsx`.

## Autenticacao do Parceiro

O parceiro usa autenticacao Supabase padrao (email/password).
Nao tem `user_roles` — a ausencia de role indica que e parceiro.
Verificar sempre se o usuario logado tem `parceiro_id` valido antes de operacoes.

Hook: `useAuth` — `isAdmin` e `isGestorConta` serao `false` para parceiros.

## Parceiros Comerciais — Logos

Logos dos parceiros ficam em:
`public/assets-clientes-monnera/parceiros-comerciais/parceiro-01.png` ... `parceiro-26.png`

Script de normalizacao: `scripts/normalize_partner_logos.py`

## Checklist do Painel Parceiro

Ao implementar features do parceiro:
- [ ] Filtro por `parceiro_id` esta aplicado em todas as queries de leads?
- [ ] O parceiro nao ve dados de outros parceiros?
- [ ] Primeiro acesso e reset de senha funcionam via email?
- [ ] Kit de vendas exibe apenas itens ativos?
- [ ] Formulario de conversao valida o token antes de exibir dados?

## Objetivo
Executar somente verificação final no sandbox Lovable e publicar. Nenhuma alteração de código, banco ou legados.

## Passo 1 — Re-grep em `public/gerador-proposta/index.html`
Confirmar no sandbox:
- 0 ocorrências de `assets/`
- 0 ocorrências de `file://`
- 0 ocorrências de `C:\`
- 0 ocorrências de `./assets`
- 0 ocorrências de `../assets`
- Todas as referências de mídia apontando para `/__l5e/assets-v1/...`

Se qualquer padrão proibido aparecer, parar e reportar antes de publicar.

## Passo 2 — Smoke test Playwright (headless, contra `localhost:8080`)

**Rota interna** `/admin/gerador-proposta/:leadId` (sessão Supabase restaurada via `LOVABLE_BROWSER_SUPABASE_*`):
- iframe `/gerador-proposta/index.html` carrega
- bridge `postMessage` envia `prefill` e gerador hidrata
- nome / email / telefone aparecem no rodapé
- nenhum 404 de asset no network log

**Rota pública** `/proposta/:token` (sem login) — **modo seguro, sem aceite real**:
- iframe abre em modo `view` / readonly
- visual 1:1 renderiza (screenshot)
- botão "Aceitar proposta comercial" visível
- clique no botão abre o dialog de aceite
- **parar aqui**: não confirmar o aceite. Não preencher e submeter o formulário.
- só validar aceite ponta-a-ponta se houver token/proposta de teste dedicada disponível. Nesse caso, confirmar via network que a RPC chamada é `accept_commercial_proposal` (validar payload do POST `/rest/v1/rpc/accept_commercial_proposal`) e que `accepted_at` é preenchido na resposta.
- nunca aceitar proposta real de cliente durante o smoke test.

Capturar screenshots de cada etapa e logs de console/network.

## Passo 3 — Confirmar escopo zero de mudanças

Este publish **não** inclui:
- nenhuma migration nova (`supabase--migration` não será chamado)
- lógica de PDF / anexos no novo gerador
- alteração em bucket `propostas`
- alteração em `lead_comments` / `lead_comment_attachments`
- remoção adicional de componentes legados além do que já está no sandbox

## Passo 4 — Publish
Se build, grep e smoke test passarem:
- preflight de website info (title, description, OG/Twitter, favicon) em `index.html`
- `preview_ui--publish`
- relatar URL e tempo estimado de propagação

Se qualquer verificação falhar: parar, reportar e não publicar.

## Pós-publish
Lembrete ao usuário: atualizar a cópia local a partir do estado publicado/sandbox para evitar comparações contra cópia antiga.

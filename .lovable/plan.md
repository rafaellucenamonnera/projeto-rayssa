## Objetivo
Publicar o Teste Monnera em `https://parceiros.monnera.com.br/testemonnera` (sem hífen), mantendo a rota atual `/teste-monnera` funcionando.

## Alteração

Arquivo único: `src/App.tsx`

Adicionar uma nova `<Route>` apontando para o mesmo componente `TesteMonnera` já usado por `/teste-monnera`, logo abaixo da existente e antes do wildcard `*`:

```tsx
<Route path="/teste-monnera" element={<TesteMonnera />} />
<Route path="/testemonnera" element={<TesteMonnera />} />
```

Nenhum outro arquivo é tocado. Sem mudanças em `TesteMonnera.tsx`, estilos, perguntas, scoring, Supabase, painel comercial, tarefas ou notificações. Sem autenticação na rota.

## Hosting / SPA fallback

Validar após a publicação se o hosting Lovable faz fallback SPA corretamente para `index.html` no domínio customizado. Se `/testemonnera` retornar 404 ao abrir diretamente no navegador, ajustar a configuração de fallback/rewrite no hosting para servir a SPA.

## Publicação

Após aplicar a alteração, publicar o projeto para que a rota fique disponível em produção (`parceiros.monnera.com.br`). O preview já refletirá antes disso.

## Critérios de aceite
- `/testemonnera` e `/teste-monnera` renderizam a mesma página.
- Acesso público, sem login.
- Fluxo de diagnóstico, lead e scoring inalterados.
- Build passa sem novos erros.

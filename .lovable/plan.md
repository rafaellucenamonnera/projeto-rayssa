# Validar a conexão do agente (MCP) depois de publicar

## O que você faz primeiro

Publicar o app. O servidor MCP só é implantado no publish — antes disso a URL de conexão não responde.

## O que eu verifico depois do publish

1. **Endpoint no ar**: conferir se a função `mcp` respondeu ao deploy do publish e se o servidor anuncia as 12 ferramentas (listar painéis, leads, embaixadores, responsáveis; criar/atualizar lead; mover etapa; comentar; criar tarefa; criar/atualizar cliente Cross).
2. **Configuração OAuth**: rodar o diagnóstico do servidor de autorização para confirmar issuer, página de consentimento (`/.lovable/oauth/consent`), registro dinâmico de clientes e lista de redirecionamentos confiáveis.
3. **Tela de consentimento**: abrir a rota de consentimento no app publicado e confirmar que:
   - usuário deslogado é enviado para `/admin/login` e volta para a tela de consentimento após entrar (senha e Google);
   - a tela mostra o nome do cliente e os botões Autorizar / Recusar.
4. **Correções**: se algum passo falhar (redirecionamento perdido, issuer divergente, ferramenta com erro), eu corrijo e reimplanto.

## O que fica com você

Colar a URL de conexão no agente do Codex e aprovar a tela de consentimento com sua conta admin. Depois disso, me diga se o agente listou as ferramentas — se algo falhar no lado do Codex, eu ajusto pelos logs da função.

## Detalhes técnicos

- Ferramentas validam permissões via token OAuth do usuário (RLS aplicada como você), sem chave de serviço.
- Regras já embutidas: CNPJ único no painel Onb Clientes Cross, motivo obrigatório ao mover para `lead_perdido`, anotações limitadas a 500 caracteres, embaixador obrigatório ao criar lead.
- Verificação usa: diagnóstico do servidor OAuth, logs da função `mcp` e navegação automatizada na URL publicada.

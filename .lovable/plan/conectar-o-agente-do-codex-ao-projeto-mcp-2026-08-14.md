# Conectar o agente do Codex ao projeto (MCP)

Expor este app como um servidor MCP para que o agente criado no Codex possa consultar dados, criar e atualizar cards — agindo como você, com login e permissões da sua conta admin.

## Como vai funcionar

1. No Codex, você adiciona a URL do servidor MCP do projeto.
2. Na primeira conexão, abre a tela de login do app e uma tela de consentimento ("Conectar Codex à sua conta").
3. Depois disso o agente age autenticado como o seu usuário: tudo respeita as regras de acesso já existentes e fica registrado com o seu ID.

## Ferramentas que o agente terá

Consulta
- `listar_paineis` — painéis e etapas disponíveis (comercial, Onb Clientes Cross etc.)
- `listar_leads` — busca por nome/CNPJ/etapa/painel, com limite e paginação
- `obter_lead` — detalhe completo de um card, incluindo comentários e tarefas
- `listar_embaixadores` — embaixadores Monnera ativos (para vincular leads)
- `listar_responsaveis` — usuários que podem ser responsáveis por um card

Criação
- `criar_lead` — cria card no funil comercial (nome fantasia, CNPJ, responsável, telefone, e-mail, painel, etapa inicial, embaixador, origem)
- `criar_cliente_cross` — cria card no painel Onb Clientes Cross (nome do parceiro, CNPJ, focal + telefone/e-mail, contratante Monnera, vendedor + telefone/e-mail, anotações até 500 caracteres)

Atualização
- `atualizar_lead` — edita campos do card
- `mover_lead_etapa` — muda a etapa (respeitando as regras do funil, incluindo motivo obrigatório em perda)
- `adicionar_comentario` — comentário no card
- `criar_tarefa` — tarefa com prazo e responsável
- `atualizar_cliente_cross` — edita um card do painel Cross

Cada ferramenta que grava dados é marcada como "não somente leitura", então o Codex pede confirmação antes de executar.

## Regras aplicadas

- CNPJ único no painel Cross; duplicidade retorna erro claro em vez de falha bruta.
- Nenhuma ferramenta usa chave de serviço nem contorna regras de acesso: toda gravação passa pela identidade autenticada.
- Anotações do Cross limitadas a 500 caracteres; campos obrigatórios validados antes de gravar.
- Sem envio de notificações internas por essas ferramentas (evita os erros já conhecidos de tipo de notificação).

## Detalhes técnicos

- Pacote `@lovable.dev/mcp-js` + `zod`; ferramentas em `src/lib/mcp/tools/`, entrada em `src/lib/mcp/index.ts`, plugin `mcpPlugin()` em `vite.config.ts` (gera a edge function `mcp`).
- Autenticação: OAuth 2.1 do backend como authorization server (registro dinâmico de cliente) + `auth.oauth.issuer` no `defineMcp`; token verificado e repassado ao cliente do banco (`supabaseForUser`), então RLS roda como o usuário.
- Nova rota de consentimento `/.lovable/oauth/consent` no app, reaproveitando o login existente (`/admin/login`) com retorno para a URL de consentimento.
- Escritas usando as mesmas tabelas do app: `leads`, `lead_comments`, `lead_tasks`, `representative_cards`; leitura de `pipeline_panels` e `pipeline_stages_config`.
- Deploy da função `mcp` ao final; validação do manifesto de ferramentas.

## Entrega

Ao final, você recebe a URL do servidor MCP para colar na configuração do agente no Codex, junto com um exemplo de uso.

# Gerador de E-mail de Onboarding — Parceiro Baston

## Bloqueio inicial (precisa de você)

O anexo recebido (`email-onboarding-parceiro-baston-monnera-v2.txt`) contém apenas a **copy em texto puro**: assunto, seções 1/2/3, links fixos e os marcadores `{{LINK_MATERIAL_CLIENTE}}` e `{{CODIGO_CADASTRO_PARCEIRO}}`. Não há HTML, CSS inline, logo base64, cabeçalho `#003729`, cards clicáveis nem `{{NOME_PARCEIRO}}`.

Com esse conteúdo é impossível "preservar o layout exatamente igual" — o layout não veio junto. Para seguir, escolha um caminho:

- **A (preferido):** anexar o arquivo `.html` de verdade (com o CSS inline e a logo base64). Ele vira a fonte de verdade intacta e apenas os três marcadores são substituídos.
- **B:** eu monto o HTML na identidade Monnera (cabeçalho verde `#003729`, logo, cards clicáveis, todas as seções e a copy exatamente como no `.txt`), você revisa no preview e ajusta. Nesse caso o resultado é equivalente, não idêntico ao arquivo local.

Em ambos os casos a instrução interna "Substitua este campo antes do envio para cada novo parceiro." é removida do corpo.

Todo o restante do plano assume o HTML final como base intacta.


## O que será construído

### 1. Template versionado no projeto
O HTML aprovado é salvo como arquivo do projeto (fonte de verdade única), com apenas três marcadores substituíveis:

- `{{NOME_PARCEIRO}}`
- `{{CODIGO_CADASTRO_PARCEIRO}}`
- `{{LINK_MATERIAL_CLIENTE}}`

Links fixos (Apresentação Monnera, vídeo tutorial, Arquivo Resumido, Modelo de cadastro de usuários) permanecem no template sem alteração.

### 2. Tela administrativa "E-mail de Onboarding Baston"
Nova aba no admin com:

- Nome do parceiro
- Código de cadastro Parceiro Baston (8 caracteres, A-Z e 0-9)
- Link do material customizado (Canva)
- Destinatário(s), com validação de e-mail
- Assunto, pré-preenchido com: `Boas-vindas à Monnera | Onboarding, Plataforma e Diretrizes de Envio - Parceiro Baston`

Ações: **Gerar preview**, **Copiar HTML final**, **Salvar rascunho**, **Enviar e-mail** (com modal de confirmação obrigatório).

O preview é renderizado em iframe isolado, exatamente o HTML final que será enviado — sem imagem, sem reescrita de estilos.

### 3. Validações e sanitização
- Nome: texto simples, escapado para não quebrar o HTML.
- Código: exatamente 8 caracteres `[A-Z0-9]`; códigos demonstrativos rejeitados; `QATEST01` aceito somente em card marcado como teste.
- Links: precisam ser URLs `https://` válidas.
- Destinatários: validados um a um; envio bloqueado se algum for inválido.

### 4. Histórico de envios
Nova tabela registrando: parceiro, card de origem (quando houver), destinatários, código usado, link do material, assunto, data/hora, usuário responsável e status (`rascunho`, `enviado`, `erro`). Visível na própria tela, com acesso restrito a administradores.

### 5. Envio
Na primeira entrega o envio fica desabilitado e o fluxo entrega geração + preview + cópia + rascunho, conforme você previu. O ponto de integração de envio já fica pronto: assim que o domínio de e-mail do projeto estiver configurado, o botão "Enviar" passa a usar a infraestrutura de e-mail do próprio projeto (sem provedor externo), preservando o HTML inline e a logo base64.

## Uso no teste QA

A tela será usada para o card `TESTE FASE A QA` com nome do card, código `QATEST01` e link `https://www.canva.com/d/c4zxi4vpjmbpv7V`, apenas gerando o preview e listando os destinatários do card. Nenhum envio, nenhuma régua, nenhum processamento de ORCA LOGÍSTICA ou de outros cards.

## Detalhes técnicos

- `src/lib/onboardingEmailTemplate.ts`: template bruto + `renderOnboardingEmail()` com substituição e escape de HTML.
- `src/pages/admin/AdminEmailOnboarding.tsx` (+ rota e item de menu no admin): formulário, preview em iframe `srcDoc`, cópia, rascunho, modal de confirmação.
- Migração: tabela `onboarding_email_sends` com RLS (somente admin), GRANTs para `authenticated`/`service_role`, e `created_by` a partir de `auth.uid()`.
- Envio (fase 2): Edge Function dedicada que recebe o HTML já renderizado e o registro de histórico, marcando `enviado` ou `erro`.
- Sem `dangerouslySetInnerHTML` em componentes React; o HTML vive apenas dentro do iframe do preview.

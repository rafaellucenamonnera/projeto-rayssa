# Gerador de E-mail de Onboarding — Parceiro Baston

## Bloqueio inicial (precisa de você)

O arquivo `email-onboarding-parceiro-baston-monnera-v2.html` está no seu computador (`C:\Users\...`) e o sistema não consegue ler caminhos locais. Para usar o HTML aprovado como fonte de verdade, é necessário que você:

- cole o conteúdo do HTML no chat, ou
- anexe o arquivo na conversa.

Todo o restante do plano assume esse HTML como base intacta (CSS inline, logo base64, cores, cards, seções). Nada de layout será recriado do zero.

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

# Criar card no painel sem campos obrigatórios

Hoje o cadastro de card exige CNPJ (nas ferramentas do agente) e exige nome, telefone e e-mail (no formulário do painel). A ideia é permitir criar o card com qualquer quantidade de informação.

## O que muda

1. CNPJ deixa de ser obrigatório em todos os caminhos de criação:
   - Formulário "Add Cliente" do painel: já era opcional, mas some também a exigência de 14 dígitos — se vier preenchido, é apenas normalizado (só dígitos) e gravado.
   - Ferramentas do agente (`create_card` e `criar_cliente_cross`): CNPJ passa a ser campo opcional, sem rejeição por tamanho.
2. Telefone e e-mail deixam de ser obrigatórios no formulário do painel. E-mail continua validado apenas quando preenchido (formato inválido é recusado).
3. Nome do parceiro continua sendo o único dado necessário, porque é o campo que identifica o card na coluna e o banco não aceita card sem nome. Se preferir permitir card sem nome nenhum, é uma mudança adicional no banco — diga que eu incluo.
4. A checagem de CNPJ duplicado no painel continua valendo, mas só é executada quando o CNPJ foi informado.

## Detalhes técnicos

- `src/components/admin/ClienteCrossDialog.tsx`: remover as validações de telefone, e-mail obrigatório e "CNPJ deve conter 14 dígitos"; manter validação de formato de e-mail quando preenchido, limite de 500 caracteres em anotações e a checagem de duplicidade condicionada a `cnpj` não vazio. Ajustar os rótulos removendo o asterisco de Telefone e E-mail.
- `src/lib/mcp/painel/tools/create-card.ts`: `cnpj` passa a `z.string().optional()`; remover o retorno `INVALID_CNPJ`; gravar `cnpj` normalizado ou `null`.
- `src/lib/mcp/tools/criar-cliente-cross.ts`: mesma mudança; a verificação de card existente com o mesmo CNPJ só roda quando houver CNPJ.
- Sem migração de banco: `cnpj`, `email` e `phone` já aceitam valor nulo em `representative_cards`.

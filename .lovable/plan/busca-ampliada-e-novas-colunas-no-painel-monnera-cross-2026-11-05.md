# Busca ampliada e novas colunas no Painel Monnera (Cross)

## O que muda para você
1. **Busca ampliada** — o campo "Filtrar por nome..." passa a se chamar "Buscar por nome, CNPJ, contratante, responsável ou telefone..." e encontra o card por qualquer um destes dados:
   - Nome do cliente
   - CNPJ (com ou sem pontos, barras e traço)
   - Contratante Monnera (o "nome fantasia" usado no painel)
   - Responsável/focal e vendedor (nome)
   - Telefone de cadastro, do focal e do vendedor (só os números, em qualquer formato)
   - E-mail e código de integração Monnera
2. **Busca tolerante** — ignora acentos e maiúsculas, aceita palavras em qualquer ordem ("silva maria" acha "Maria da Silva") e tolera pequenos erros de digitação (1 letra trocada/faltando em palavras de 5+ letras, ex.: "farmacia sao jao" acha "Farmácia São João").
3. **Visualização em lista** — duas colunas novas: **CNPJ** (formatado 00.000.000/0000-00, "—" quando vazio) e **Código Monnera** (o código de integração, "—" quando ainda não recebido). Em ambas, um clique copia o valor.

Os outros painéis (Comercial, Embaixadores, Sucesso) continuam como estão. Nenhum dado é alterado.

## Detalhes técnicos
- Painel `painel_msj9fyji` carrega `representative_cards` inteiros no cliente; a busca é feita em memória, sem mudança no banco.
- Nova função pura `src/lib/crmSearch.ts`: `normalizeText` (sem acento, minúsculo), `digitsOnly`, `matchesCrmSearch(card, termo)` — cada palavra do termo precisa casar por substring ou por distância de Levenshtein ≤1 contra tokens de full_name, contratante_monnera, focal_name, vendor_name, email, codigo_monnera; termos com ≥4 dígitos também comparam com dígitos de cnpj, phone, focal_phone, vendor_phone.
- `AdminLeads.tsx`: substituir o filtro `includes` (linha ~2111) por `matchesCrmSearch` quando `isCustomCrmPanel`; atualizar placeholder; incluir colunas CNPJ e Código Monnera na tabela da lista só para `isCustomCrmPanel` (usa `codigo_monnera` já carregado, inclusive o fallback).
- Testes vitest em `src/lib/crmSearch.test.ts`: CNPJ formatado vs. só dígitos, telefone, acento, ordem das palavras, erro de 1 letra, termo sem resultado.

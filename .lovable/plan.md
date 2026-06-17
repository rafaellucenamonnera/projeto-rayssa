## Tornar campos de comissão e parcelas opcionais no modal financeiro

Arquivo a alterar:
`src/components/admin/CadastroFinanceiroDialog.tsx`

Não alterar outros arquivos.

Contexto:
No modal "Dados financeiros do contrato", aberto ao mover um lead de "Reunião realizada" para "Proposta enviada", os campos de comissão e parcelas devem continuar visíveis, mas não podem ser obrigatórios.

Mudanças em `handleSave`:
Remover as validações que bloqueiam o salvamento quando estes campos estão vazios ou zerados:

- validação de `parcelas <= 0`
- validação de percentual de comissão quando `tipoComissao === "percentual"`
- validação de valor fixo de comissão quando `tipoComissao === "fixo"`

Manter apenas as validações dos campos centrais:
- `setup >= 0`
- `mensalidade >= 0`
- `qtdLojas > 0`
- `campanhas >= 0`

Persistência no Supabase:
No `.update({...})`, ajustar `qtd_parcelas` para:
qtd_parcelas: form.comissao_vitalicia || parcelas <= 0 ? null : parcelas

Manter percentual_consultor: percentualEfetivo como já está. Quando os campos de comissão estiverem vazios, percentualEfetivo deve continuar caindo para 0, sem exibir erro.

Callback onSaved:
Ajustar qtd_parcelas para:
qtd_parcelas: form.comissao_vitalicia || parcelas <= 0 ? 0 : parcelas

Não alterar:
- Alerta amarelo
- Checkbox "Comissão vitalícia"
- UI dos campos de comissão/parcelas
- Preview de cálculos automáticos
- Textos do modal
- Layout

Critério de aceite:
- O build deve passar.
- Ao mover um lead de "Reunião realizada" para "Proposta enviada", deve ser possível salvar preenchendo apenas Setup, Mensalidade, Quantidade de lojas e Receita de campanhas.
- O salvamento não deve exigir tipo de comissão, percentual de comissão, valor fixo de comissão, quantidade de parcelas ou comissão vitalícia.

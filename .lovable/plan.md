Alterar apenas `src/pages/admin/AdminLeads.tsx`.

## 1. Estado e helpers
- Adicionar `valor_campanhas: string` em `LeadEditFormData` e `emptyEditFormData` (`""`).
- Novo estado: `const [financialInfoExpanded, setFinancialInfoExpanded] = useState(false)`.
- Nova função pura:

```ts
const isFinanceiroZerado = (lead: any) => {
  const comissaoMensal = Number(lead?.valor_mensalidade || 0) * Number(lead?.percentual_consultor || 0);
  const parcelasContratadas = Number(lead?.qtd_parcelas || 0);
  const valorTotalContrato = comissaoMensal * parcelasContratadas;
  const parcelasPagas = Number(lead?.parcelas_pagas || 0);
  return !lead?.comissao_vitalicia &&
    comissaoMensal === 0 && parcelasContratadas === 0 &&
    valorTotalContrato === 0 && parcelasPagas === 0;
};
```

## 2. Popular editFormData
Em `openLeadDetail`, `startEditCard`, `cancelEditCard` incluir:
`valor_campanhas: lead.valor_campanhas != null ? String(lead.valor_campanhas) : ""`.

Em `openLeadDetail` e `startEditCard`, após popular o lead:
`setFinancialInfoExpanded(!isFinanceiroZerado(lead));`

## 3. saveEditedCard
Após validar o título:

```ts
const valorCampanhas = editFormData.valor_campanhas.trim() === "" ? null : Number(editFormData.valor_campanhas);
if (valorCampanhas !== null && !Number.isFinite(valorCampanhas)) {
  toast.error("Valor médio de campanhas inválido");
  return;
}
```

Incluir `valor_campanhas: valorCampanhas` **apenas** no payload do update em `leads` (não em `representative_cards` nem `ambassador_cards`).

## 4. Modo leitura "Título e descrição"
Substituir o conteúdo atual por:

```tsx
<div className="space-y-1">
  <p className="text-sm font-medium">{detailLead.nome_fantasia || "—"}</p>
  <p className="text-sm text-muted-foreground">{detailLead.descricao_necessidade || "—"}</p>
</div>
```

Modo edição: manter Input de `nome_fantasia` e Textarea/Input existente de `descricao_necessidade`.

## 5. Valor Médio de Campanhas
Condicional:
`currentPanelId !== "sucesso" && !isAmbassadorPanel && (isEditingCard || detailLead.valor_campanhas != null)`

- Em edição: `<Input type="number" min="0" step="0.01" value={editFormData.valor_campanhas} onChange={...} placeholder="0,00" />`.
- Leitura: `fmt(detailLead.valor_campanhas)`.

## 6. Informações Financeiras
Ao lado do título, botão `variant="outline" size="sm"` que alterna `financialInfoExpanded`:
- recolhido → "Expandir informações financeiras"
- expandido → "Recolher informações financeiras"

Envolver o conteúdo financeiro (dados, parcelas, barra de progresso) em `{financialInfoExpanded && (<>...</>)}`.

## Fora do escopo
Nada além de `src/pages/admin/AdminLeads.tsx`. Sem migration, schema, refactor, alterações em permissões, pipeline ou regras financeiras.

## Validação
- `npm run build` e reportar resultado.
- Editar no painel comercial: título, descrição e valor médio editáveis; salvar persiste os 3.
- Financeiro zerado → recolhido; preenchido → expandido; botão alterna.

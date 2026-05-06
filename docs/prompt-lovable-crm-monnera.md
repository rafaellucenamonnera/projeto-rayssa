# Prompt para Codex — Painel de Sucesso (Monnera)

ID: `success-panel-architecture-audit-rebuild`

## IMPORTANTE
- Auditar integralmente o repositório **antes** de modificar qualquer código.
- Não implementar novas redundâncias.
- Não aplicar regras globais de outros painéis ao Painel de Sucesso.
- Reaproveitar o que estiver correto.
- Remover apenas o que conflita com o escopo.
- Toda regra de negócio deve estar no backend.
- Frontend deve apenas consumir e exibir.
- Foco em performance e clareza para usuário não técnico (sem acesso ao banco).

## OBJETIVO
Reconstruir o Painel de Sucesso como central operacional de saúde de clientes, baseado no Google Drive e em dados internos de interação.

---

## FASE 1 — AUDITORIA E DIAGNÓSTICO
Mapear e classificar em **Reaproveitar / Corrigir / Remover**:
1. Estrutura atual do Painel de Sucesso
2. Componentes existentes
3. Integrações com Drive
4. Cálculos no frontend
5. Regras herdadas de outros painéis
6. Permissões
7. Estrutura de cards
8. Clonagem
9. Filtros

---

## FASE 2 — ISOLAMENTO
Garantir:
- `panel_type = sucesso`

Isolar:
- lógica
- indicadores
- automações
- permissões

---

## FASE 3 — DRIVE
Implementar `syncDriveClients()` com:
- Carga inicial
- Rotina diária às **02:00**
- Chave única: **CNPJ**

Regras:
- Se CNPJ existe: atualizar
- Se CNPJ não existe: criar

Fonte (Drive):
- Empresa
- CNPJ
- Responsável CS
- CSAT
- Impacto
- Receita Mensalidade
- Receita Campanha
- Receita Ordem de Pagamento

---

## FASE 4 — RECEITA
Ler aba **Receita / Contratante** e calcular:
- receita mês atual
- receita mês anterior
- variação percentual: `((atual - anterior) / anterior) * 100` (quando anterior existir)
- `revenue_total = mensalidade + campanha + ordem_pagamento`

Exibir no card:
- valor atual
- percentual
- tendência (↑ verde / ↓ vermelho)

Somatório por coluna:
- `SUM(revenue_total)`

---

## FASE 5 — INTERAÇÃO
Origem: comentários e logs internos.

Calcular:
- última interação
- quantidade de interações
- dias sem interação
- consultor
- responsável atual

---

## FASE 6 — SCORE DE PRIORIZAÇÃO
Criar score com base em:
- impacto financeiro
- queda de receita
- dias sem interação
- risco vindo do Drive

Fórmula base:

```txt
score =
(peso_impacto_financeiro) +
(peso_queda_receita) +
(peso_dias_sem_interacao) +
(peso_risco_drive)
```

Resultado:
- Ordenação automática no topo do Kanban

---

## FASE 7 — FILTROS
Implementar filtros obrigatórios:
- Empresa
- Consultor
- Responsável
- Status campanha
- Impacto

Regra:
- Todos os filtros devem afetar cards, indicadores e somatórios.

---

## FASE 8 — PERMISSÕES
Implementar:
- acesso por painel
- acesso por todos os cards
- acesso por responsabilidade

Regras:
- Usuário comum: vê cards sob sua responsabilidade, ou todos se tiver permissão de “ver todos”
- Admin: acesso irrestrito

---

## FASE 9 — CLONAGEM
Regras:
- Painel de Sucesso **não pode receber clones**
- Painel de Sucesso **pode originar clones** para outros painéis

UX:
- Painel Sucesso não aparece como destino

---

## FASE 10 — UX
Garantir leitura em segundos:
- quem está em risco
- quanto vale
- há quanto tempo está sem interação
- quem é o responsável

Exibir no card:
- nome
- risco
- receita total
- tendência
- dias sem interação
- responsável

---

## FASE 11 — LIMPEZA
Remover apenas o que estiver fora do escopo:
- duplicidade
- lógica de negócio no frontend
- dados redundantes
- regras herdadas de outros painéis

---

## FASE 12 — VALIDAÇÃO
Testar:
- importação inicial
- atualização diária
- filtros
- score
- receita
- permissões
- UX

---

## ESTRUTURA FUNCIONAL MÍNIMA
- Tipo de painel: `sucesso`
- Coluna inicial obrigatória: `Onboarding Sucesso`
- Todo cliente novo entra obrigatoriamente nessa coluna

---

## ENTREGA FINAL
- painel funcional
- sem redundância
- orientado à retenção
- escalável
- com informações claras, objetivas e acionáveis para usuário não técnico

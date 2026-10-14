# Novo Painel Comercial

## Decisões confirmadas
- Indicações pelo link dos Embaixadores Monnera entram na coluna **MQL**.
- **Todas** as automações do Painel Comercial são desligadas. Isso inclui: lead parado vai para Perdido, proposta aceita vai para Convertido, contrato assinado cria card no onboarding e as mudanças de coluna ao agendar reunião ou enviar proposta. Os cards só mudam de coluna quando alguém os move.
- Mercado, Tipo e Impacto são opcionais em Lista Prospects. São obrigatórios para entrar em MQL e em qualquer coluna seguinte. Perdidos não exige.
- Os cards atuais serão movidos, com registro no histórico de cada card.

## 1. Colunas (nesta ordem)
Lista Prospects | MQL | Lead (em contato) | Reunião Agendada | Reunião Realizada | Proposta Enviada | Cliente Convertido | Contrato Enviado | Contrato Assinado | Kickoff Realizado | Perdidos

## 2. Para onde vão os cards atuais
- Lead, Qualificação, Reunião Entrega Diagnóstico, Reunião Especialista, Proposta, Follow-up 1 a 5 e Lead Qualificado vão para **Lead (em contato)**.
- Lead Convertido, Contrato Enviado, Contrato Assinado e Nutrição vão para **Kickoff Realizado**.
- Lead Perdido, nos registros novos e antigos, vai para **Perdidos**.
- As colunas antigas deixam de aparecer. Nenhum card é apagado.

## 3. Card
- Campo **Mercado**: Farma, Pet, Material de Construção, Autopeças, Alimentar, Outros. Aparece fixo no card.
- Campo **Tipo**: Varejo, Distribuição, Operador Logístico, Indústria. Aparece fixo no card.
- Etiqueta **Impacto**: Alto em vermelho, Médio em laranja, Baixo em amarelo. Cada etiqueta também mostra o nome por extenso.
- Campo **MRR**, em reais, aparece no card.
- Mover para MQL ou adiante sem Mercado, Tipo e Impacto é bloqueado. A mensagem informa o que falta preencher.

## 4. Filtros e totais
- Filtros de Mercado, Tipo e Impacto, que podem ser usados juntos.
- Filtro de período com a opção **Entrada** ou **Saída**, para ver os cards que entraram ou saíram de cada coluna no período escolhido.
- Cada coluna mostra o número de cards e a soma do MRR, respeitando todos os filtros.

## 5. Topo do painel
- Os quadros de contagem por coluna no topo serão retirados. O Kanban passa a ocupar a tela inteira.

## Fora do escopo
- Relatórios: você disse que vai pedir mudanças separadamente.
- Os outros painéis (Onb Clientes Cross, Embaixadores, Sucesso, Campanhas) ficam como estão.

## Detalhes técnicos
- Migração aditiva em `leads`: `mercado`, `tipo_negocio` e `impacto` (text, com check, nullable) e `mrr numeric`. O `tipo_empresa` existente permanece, para não quebrar outros fluxos.
- Recriar os registros de `pipeline_stages_config` com panel_key='comercial'. Novos values para Lista Prospects, MQL, Cliente Convertido e Kickoff. Reaproveitar os values existentes quando houver correspondência (reuniao_agendada, reuniao_realizada, proposta_enviada, contrato_enviado, contrato_assinado, etapa_comercial_1781718801678 para Perdidos, novo_lead como Lead em contato).
- Mover os dados com `set_config('app.system_lead_update','on',true)` e registrar cada mudança em `lead_stage_history`.
- Desligar os triggers e as tarefas agendadas do painel comercial: auto-lost (cron), move_accepted_commercial_proposal_to_converted, trg_leads_ensure_onboarding_card, reset/stage timers e os updates de status no front em AgendarReuniao e PropostaUpload. Usar DISABLE TRIGGER ou um guard por panel; as funções não são apagadas.
- register_lead_public e register_parceiro passam a gravar o value de MQL.
- Validação de transição no PipelineKanban, na lista e no RPC/trigger, com teste vitest para a regra de obrigatoriedade.
- O filtro Entrada/Saída consulta `lead_stage_history` (entrou_em/saiu_em) pelo período escolhido.

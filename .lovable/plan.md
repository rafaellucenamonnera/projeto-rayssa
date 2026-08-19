# Código Monnera visível no card — painel Onb Clientes Cross

Tornar o Código Monnera um dado visível, rastreável e controlado no card, sem alterar Gmail, Jira, Canva, cron ou movimentações automáticas existentes.

## O que será entregue

1. Bloco destacado "Código Monnera" no detalhe do card (painel Onb Clientes Cross), mostrando:
   - código atual, quando existir;
   - origem (`codigo_source`: Gmail/Jira, sincronização manual, edição administrativa, código de teste);
   - data de recebimento;
   - `thread_id` / referência da origem e chave Jira, quando existirem;
   - status da validação, com selo colorido.
2. Estados exibidos:
   - `Pendente — aguardando criação do painel` (etapa Cadastro, sem tarefa Jira);
   - `Pendente — aguardando retorno do Jira` (etapa Criação Painel com tarefa Jira criada);
   - `Código recebido` (código gravado, ainda sem validação de formato concluída);
   - `Código validado` (8 caracteres A-Z/0-9, sem divergência, não é exemplo);
   - `Formato não confirmado` (ex.: `MNR-A1B2C3`);
   - `Código de exemplo rejeitado` (`3SAXJF92`, `UB5PXGDB`, `XXXXXXX`, `XXXXXXXX`);
   - `Código divergente` (código do card diferente do último código recebido da origem).
3. Regras por etapa:
   - **Cadastro**: mostra "Pendente — aguardando criação do painel". O código não é exigido e não bloqueia nada.
   - **Criação Painel**: mostra o código assim que ele chega pelo fluxo já existente (e-mail Jira / sincronização manual), registrando origem e evidência.
   - **Material Onboarding Cliente**: mostra o código como informação confirmada e impede a entrada na etapa quando o código estiver ausente, inválido, de exemplo, em formato não confirmado ou divergente.
4. Visibilidade no board: selo compacto com o código (ou "sem código") no cartão da lista quando houver espaço.
5. Permissões: somente leitura para usuários comuns. Administradores podem corrigir manualmente o código, com justificativa obrigatória (mínimo 10 caracteres) e registro em histórico.
6. Códigos de exemplo nunca aparecem como válidos: são exibidos com o selo "Código de exemplo rejeitado".

## Detalhes técnicos

**Estado atual verificado**
- `representative_cards` já possui `codigo_monnera`, `codigo_source`, `codigo_evidencia`, `codigo_teste`, `origin_thread_id`, `jira_issue_key`, `jira_issue_status`, `jira_created_at`. Não existe coluna com a data de recebimento do código.
- A RPC `apply_monnera_code_to_card` já valida formato de 8 caracteres, rejeita os quatro códigos de exemplo, rejeita `MNR-…`, detecta divergência e duplicidade, grava histórico em `representative_card_history` e notifica. Ela é reutilizada, não reescrita.
- Etapas do painel `painel_msj9fyji`: `etapa_painel_msj9fyji_1` (Cadastro), `_2` (Criação Painel), `_3` (Material Onboarding Cliente). Hoje nenhuma regra de banco ou de tela exige código para entrar em `_3`.
- O detalhe do card é montado em `src/pages/admin/AdminLeads.tsx` (bloco de seções `detalhes`).

**Migrations**
1. `alter table public.representative_cards add column if not exists codigo_recebido_at timestamptz;` — data de recebimento.
2. Atualizar `apply_monnera_code_to_card` de forma aditiva: gravar `codigo_recebido_at = coalesce(codigo_recebido_at, now())` no mesmo `UPDATE`. Nenhuma outra regra da função muda.
3. Nova RPC `set_monnera_code_manual(p_card_id uuid, p_codigo text, p_justificativa text)`, `SECURITY DEFINER`, `search_path = public`:
   - exige `has_role(auth.uid(),'admin')` e justificativa com no mínimo 10 caracteres;
   - aplica as mesmas validações de formato/exemplo/duplicidade da RPC existente;
   - grava `codigo_source = 'edicao_admin'`, evidência com a justificativa e o usuário, `codigo_recebido_at`;
   - registra `representative_card_history` (ação `codigo_monnera_editado_admin`) e `card_field_provenance` (`field_name = 'codigo_monnera'`, `source = 'manual'`, `evidence = justificativa`).
4. Ajuste aditivo em `representative_card_guard_stage_change`: ao entrar na etapa cujo rótulo normalizado é "material onboarding cliente" no painel `painel_msj9fyji`, bloquear quando o código estiver ausente, fora do padrão `^[A-Z0-9]{8}$`, na lista de exemplos, ou marcado como teste em card não-teste. A regra é resolvida pelo rótulo em `pipeline_stages_config`, não por `stage_id` fixo. Nenhuma outra condição do trigger é alterada.

**Frontend**
- Novo componente `src/components/admin/CodigoMonneraSection.tsx`: bloco destacado com código, selo de status, origem, data, `thread_id`, chave Jira, evidência resumida e — para admin — formulário de correção manual com justificativa obrigatória, chamando `set_monnera_code_manual`.
- Nova função pura `src/lib/monneraCode.ts` com `DEMO_CODES`, `isValidMonneraCode` e `resolveCodeStatus(card, stageLabel)` devolvendo um dos sete estados. Lógica testável, fora do JSX.
- `src/pages/admin/AdminLeads.tsx`: renderizar `CodigoMonneraSection` no topo da seção de detalhes do painel Cross e propagar o patch de estado como já é feito nos demais blocos; passar `codigo_monnera` ao board.
- `src/components/admin/PipelineKanban.tsx`: nova prop opcional `showMonneraCode` para exibir o selo compacto do código no cartão, ativada apenas no painel Cross.

**Não será alterado**
Worker Gmail, funções Jira, fluxo Canva, cron, régua de cobrança e movimentações automáticas. Nenhum código será aplicado a cards reais durante a implementação.

**Testes**
Verificação em modo leitura/simulação sobre cards existentes e o card `TESTE FASE A QA`: card sem código, com código válido, formato não confirmado (`MNR-…`), código de exemplo, código divergente, atualização vinda do fluxo Jira já existente e edição administrativa com justificativa. Ao final: `npm run build` e typecheck.

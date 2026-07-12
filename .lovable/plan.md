# Teste Monnera — Landing pública + Backend + Painel Comercial

## Pontos críticos (não violar)

1. **NÃO criar** valor `lead_qualificado`. **NÃO alterar** enum `lead_status`. `leads.status_lead` é usado como texto.
2. **Reutilizar** a coluna existente "Lead Qualificado" do painel `comercial`, cujo `value` técnico é `etapa_comercial_1783879107510`.
3. Tabela nova: **`teste_monnera_diagnosticos`** (não `lead_teste_monnera_diagnostics`).
4. RPC única com **payload jsonb**: `submit_teste_monnera(p_payload jsonb)` — nada de múltiplos parâmetros.
5. `action_url` das notificações: `/admin/painel-comercial?card=<id>` (padrão já usado em `src/lib/notifications.ts`).
6. Se houver rascunho anterior com `lead_qualificado`, `lead_teste_monnera_diagnostics` ou RPC com parâmetros separados, **substituir** por este padrão.

## Escopo

Criar landing pública `/teste-monnera` + backend (tabela, colunas resumo, RPC) + dobra no card do painel comercial. Sem tocar em onboarding, sucesso, financeiro, campanhas, propostas ou fluxos de outros painéis.

## Arquivos

Novos:
- `supabase/migrations/<ts>_teste_monnera.sql`
- `src/pages/TesteMonnera.tsx`
- `src/lib/testeMonnera.ts`
- `src/components/admin/TesteMonneraSection.tsx`

Editados:
- `src/App.tsx` (registrar rota pública `/teste-monnera`)
- `src/lib/pipelineConstants.ts` (label do value dinâmico)
- `src/components/admin/PipelineKanban.tsx` (2 selos no card)
- `src/pages/admin/AdminLeads.tsx` (carregar campos-resumo, renderizar dobra)

## 1. Migration

### 1.1 Garantir coluna "Lead Qualificado" (idempotente, sem duplicar)
```sql
INSERT INTO public.pipeline_stages_config (panel_key, value, label, sort_order)
SELECT 'comercial', 'etapa_comercial_1783879107510', 'Lead Qualificado',
       COALESCE((SELECT max(sort_order)+1 FROM public.pipeline_stages_config WHERE panel_key='comercial'), 0)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages_config
   WHERE panel_key='comercial' AND value='etapa_comercial_1783879107510'
);
```
Não mexe se já existir (é o caso).

### 1.2 Tabela `public.teste_monnera_diagnosticos`
Colunas: `id uuid pk default gen_random_uuid()`, `lead_id uuid not null references public.leads(id) on delete cascade`, `submitted_at timestamptz not null default now()`, `respondent_nome text`, `respondent_sobrenome text`, `respondent_email text`, `respondent_telefone text`, `respondent_empresa text`, `respondent_cargo text`, `respondent_segmento text`, `answers jsonb not null`, `scores jsonb not null` (icp/governanca/campanhas/pagamentos), `classificacao jsonb not null`, `result_color text check (result_color in ('verde','amarelo','vermelho','cinza'))`, `result_title text`, `result_summary text`, `pontos_atencao jsonb`, `recomendacao text`, `leitura_sdr jsonb`, `solicitou_reuniao boolean not null default false`, `utm jsonb`, `user_agent text`, `ip inet`, `created_at timestamptz not null default now()`.

Grants + RLS na mesma migration:
```sql
GRANT SELECT ON public.teste_monnera_diagnosticos TO authenticated;
GRANT ALL ON public.teste_monnera_diagnosticos TO service_role;
ALTER TABLE public.teste_monnera_diagnosticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê diagnósticos" ON public.teste_monnera_diagnosticos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'leads', 'visualizar')
);
```
Sem policies de INSERT/UPDATE/DELETE — escrita só via RPC `SECURITY DEFINER`.
Index: `(lead_id, submitted_at desc)`.

### 1.3 Colunas-resumo em `public.leads`
`ADD COLUMN IF NOT EXISTS`:
- `teste_monnera_last_diagnostic_id uuid references public.teste_monnera_diagnosticos(id) on delete set null`
- `teste_monnera_result_color text`
- `teste_monnera_recommendation text`
- `teste_monnera_solicitou_reuniao boolean not null default false`
- `teste_monnera_priority text`
- `teste_monnera_scores jsonb`
- `teste_monnera_submitted_at timestamptz`

### 1.4 RPC `public.submit_teste_monnera(p_payload jsonb) returns jsonb`
`SECURITY DEFINER`, `SET search_path = public`.

Lógica:
1. Extrai campos do jsonb: `lead.{nome, sobrenome, email, telefone, empresa, cargo, segmento}`, `answers`, `scores`, `classificacao`, `result_color/title/summary`, `pontos_atencao`, `recomendacao`, `leitura_sdr`, `solicitou_reuniao` (default false), `utm`, `user_agent`, `priority`.
2. Validações: email regex válido; `empresa`, `telefone`, `nome` não vazios. Normaliza `v_email=lower(trim)`, `v_tel_digits=regexp_replace(tel,'\D','','g')`.
3. `PERFORM set_config('app.system_lead_update','on', true)` antes de mexer em leads (bypass do trigger anônimo).
4. Match do lead em `panel_id='comercial'`, ordem:
   - `lower(email_responsavel)=v_email`
   - `regexp_replace(telefone_responsavel,'\D','','g')=v_tel_digits`
   - `lower(nome_fantasia)=lower(v_empresa)`
5. Se achou: UPDATE preservando dados existentes, seta `status_lead='etapa_comercial_1783879107510'`, atualiza campos vazios, atualiza `teste_monnera_*` (color/priority/scores/recommendation/solicitou_reuniao/submitted_at).
6. Senão: INSERT com `panel_id='comercial'`, `status_lead='etapa_comercial_1783879107510'`, `origem='landing_teste_monnera'`, `nome_fantasia=empresa`, `nome_responsavel=nome+' '+sobrenome`, contato, `dados_completos=false`, campos `teste_monnera_*`.
7. INSERT em `teste_monnera_diagnosticos` (linha nova a cada submit → histórico) `RETURNING id INTO v_diag_id`.
8. UPDATE `leads.teste_monnera_last_diagnostic_id=v_diag_id`.
9. Se `solicitou_reuniao=true`:
   - INSERT em `lead_tasks`: título "Contato Teste Monnera — reunião solicitada", `due_at=now()+interval '24 hours'`, `status='pendente'`, `assigned_to=leads.responsible_user_id`, `created_by=NULL`.
   - `PERFORM public.create_notification(...)` para `responsible_user_id` (se existir) com `type='teste_monnera_reuniao'`, `title='Reunião solicitada — Teste Monnera'`, `action_url='/admin/painel-comercial?card='||v_lead_id`, `delivery_key='teste_monnera_reuniao:'||v_lead_id`.
   - Se `responsible_user_id` NULL: loop em `module_permissions` (`modulo='leads' AND acao='visualizar' AND permitido=true`) e notifica cada, delivery_key único por destinatário.
10. Retorna `jsonb_build_object('lead_id', v_lead_id, 'diagnostic_id', v_diag_id)`.

Grants:
```sql
REVOKE ALL ON FUNCTION public.submit_teste_monnera(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_teste_monnera(jsonb) TO anon, authenticated;
```

## 2. `src/lib/testeMonnera.ts`

Fonte única para landing e dobra.
- `QUESTIONNAIRE`: 8 blocos, perguntas `single`/`multi`/`scale05`.
- Pesos: ICP (porte + participação decisão), Governança (formatos + separação salário/comissão/prêmio + termo/comunicação + regras acessíveis + apuração + auditabilidade), Campanhas (metas + desempenho + prioridade 90d + dor), Pagamentos (meio + conciliação).
- `computeScores(answers)` → `{icp, governanca, campanhas, pagamentos}`.
- `classify(scores)` → faixas.
- `buildDiagnostico(scores, classifs, answers)` → `{result_color, result_title, result_summary, pontos_atencao[≤5], recomendacao, leitura_sdr:{prioridade, dor_principal, gancho, proximo_passo}, priority}`.
- Regra cor: Governança 30+ vermelho; 15-29 amarelo; 0-14 verde. Cinza se ICP 0-9 e Governança<15.
- Sem "blindagem trabalhista"/"sem risco"/"parecer jurídico". Microcopy: `Resultado educativo. Não substitui validação jurídica ou contábil.`

## 3. `src/pages/TesteMonnera.tsx`

Rota pública sem login. Steps: 0 hero+dados → 1..8 blocos → 9 resultado. Persistência em `localStorage['monnera_teste_monnera_v1']` limpa após submit.

UI:
- Hero com título/subtítulo/card "O diagnóstico avalia"/microcopy.
- Etapa 1 valida obrigatórios (toast sonner).
- Blocos: `<Progress>` topo, 1-2 perguntas/página, Voltar/Próximo. Multi=Checkbox, Single=RadioGroup, Scale 0-5=6 radios horizontais.
- Resultado: título colorido, resumo, cards Governança/Campanhas/Pagamentos (**ICP nunca visível**), até 5 pontos de atenção, recomendação, microcopy jurídica, CTA `Agendar conversa com especialista Monnera`.
- Ao entrar em resultado: 1º submit via `supabase.rpc('submit_teste_monnera', { p_payload: {..., solicitou_reuniao:false} })`, guarda `lead_id`.
- CTA: 2º submit com `solicitou_reuniao:true` no mesmo payload (RPC atualiza mesmo card + tarefa 24h). Mensagem final: `Recebemos seu diagnóstico. Uma tarefa foi criada no painel comercial para contato em até 24h.` Limpa localStorage.
- Mobile-first. Reutilizar `logo-monnera.jpg`.

## 4. `src/App.tsx`
```tsx
const TesteMonnera = lazy(() => import("./pages/TesteMonnera"));
// entre as rotas públicas:
<Route path="/teste-monnera" element={<TesteMonnera />} />
```

## 5. `src/lib/pipelineConstants.ts`
Adicionar:
```ts
PIPELINE_LABELS["etapa_comercial_1783879107510"] = "Lead Qualificado";
```
Sem alterar `PIPELINE_STAGES`/`PIPELINE_STAGE_ORDER` — a etapa é dinâmica em `pipeline_stages_config`.

## 6. `src/components/admin/PipelineKanban.tsx`
Quando o lead tem `teste_monnera_last_diagnostic_id`:
- Selo `Teste Monnera` com cor por `teste_monnera_result_color` (verde/amarelo/vermelho/cinza).
- Selo `Reunião solicitada` quando `teste_monnera_solicitou_reuniao=true`.
Sem alterar drag/drop nem layout.

## 7. `src/components/admin/TesteMonneraSection.tsx`
`<Collapsible>` titulado `Questionário de Qualificação`, prop `leadId`.
```ts
supabase.from('teste_monnera_diagnosticos').select('*').eq('lead_id', leadId).order('submitted_at',{ascending:false}).limit(1)
```
Renderiza: diagnóstico (cor+título+resumo), scores internos ICP/Governança/Campanhas/Pagamentos (**ICP só aqui**), classificação, recomendação, leitura SDR (prioridade/dor/gancho/próximo passo), respostas agrupadas por bloco (via `QUESTIONNAIRE`), selo "Reunião solicitada".

## 8. `src/pages/admin/AdminLeads.tsx`
- Incluir `teste_monnera_last_diagnostic_id, teste_monnera_result_color, teste_monnera_solicitou_reuniao` no select de leads.
- No detalhe do card quando `panel_id==='comercial'` e `teste_monnera_last_diagnostic_id != null`, renderizar `<TesteMonneraSection leadId={lead.id} />`.

## 9. Validação
- `npm run build`.
- E2E: `/teste-monnera` deslogado; preencher; ver resultado sem ICP; CTA cria card em "Lead Qualificado"; dobra visível; tarefa 24h + notificação; reenvio mesmo email/telefone/empresa não duplica.

## Fora de escopo
WhatsApp/Calendly, outros painéis, parecer jurídico, remoção de funcionalidades existentes.

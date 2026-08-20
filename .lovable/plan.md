# Corrigir persistência do link Canva manual (card TESTE FASE A QA)

## O que está errado hoje

A tela envia o link manual para a rotina `register_canva_material` com `template_design_id = null`, mas a coluna `template_design_id` da tabela `canva_material_generations` é obrigatória (NOT NULL). O banco recusa a gravação e o botão "Validar e salvar link" retorna erro — mesmo com link válido, código Monnera correto e card na etapa certa.

Confirmado no banco: `template_design_id` e `design_id` estão como NOT NULL; não há restrição de valores para `source`; o índice único é `(card_id, codigo_monnera, design_id)`, o que já garante idempotência da entrada manual.

## Correção (escopo mínimo)

1. Tornar `template_design_id` opcional na tabela `canva_material_generations` (a entrada manual não tem template de origem e não deve inventar um design fictício). Registros existentes não são alterados.
2. Manter a mesma rotina `register_canva_material`, com a mesma assinatura, sem mudar validações (código de 8 caracteres, link `https://canva.link/...`, card não bloqueado, código igual ao do card).
3. Na tela do card, gravar a entrada manual com:
   - `source = "manual_link"`;
   - `design_id` = apenas o token final do próprio link público, usado só como chave de idempotência — nunca tratado como design criado via API do Canva;
   - `template_design_id` = nulo;
   - `metadata` com: `source_type = "manual_link"`, `canva_design_created = false`, `public_link_validated = true`, token do link, URL pública completa, usuário e data.
   O usuário autor e a data também são gravados pelo banco (`created_by`, `created_at`), e o histórico do card continua recebendo o evento `canva_material_gerado`.
4. Após o link salvo com sucesso, a tela dispara a continuidade automática: executa **somente** a etapa Canva pendente e reavalia os gates seguintes, sem forçar nenhuma outra ação. O operador não precisa mover o card manualmente.
5. Reenviar o mesmo link retorna o registro já existente (índice único `card_id + código + design_id`), sem criar duplicidade nem nova versão.


## O que continua igual

- Salvar o link **não** envia e-mail e **não** move etapa por si só; quem move é o orquestrador, respeitando os gates atuais (código Monnera válido, envio confirmado com `message_id`).
- O avanço automático de Criação Painel → Material Onboarding Cliente após código Monnera válido permanece como está.
- Execução real segue restrita à allowlist (card TESTE FASE A QA); ORCA LOGÍSTICA permanece em simulação.
- Falha em qualquer etapa continua gerando tarjeta vermelha, pendência no card e notificação a Rafael e Maycon — nada é simulado como sucesso.

## Detalhes técnicos

- Migração: `ALTER TABLE public.canva_material_generations ALTER COLUMN template_design_id DROP NOT NULL;`
- Arquivo alterado: `src/components/admin/CanvaPublicLinkSection.tsx` (parâmetros do `register_canva_material` e chamada de continuidade após sucesso).
- Sem mudança em `src/lib/canvaLink.ts`, `supabase/functions/_shared/canvaLink.ts`, no orquestrador `cross-onboarding-advance` ou nas regras de movimentação.

## Teste

Teste exclusivamente no card TESTE FASE A QA, confirmando: badge "Link confirmado"; registro com `source = manual_link`; `template_design_id` nulo; `metadata.canva_design_created = false`; etapa Canva concluída no painel de etapas; nenhum e-mail enviado; nenhuma movimentação de etapa indevida; e o mesmo link salvo novamente retorna o registro existente, sem duplicidade.

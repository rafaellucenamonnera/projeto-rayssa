# Add Cliente — Painel Onboarding Clientes Cross

Criar um botão único "Add Cliente" no painel **Onboarding Clientes Cross**, abrindo um formulário completo de cadastro de cliente, com anexos e edição posterior do card.

## Campos do card

- Nome do Parceiro (obrigatório)
- CNPJ do Parceiro (14 dígitos, opcional)
- Focal Parceiro (nome), telefone, e-mail
- Contratante Monnera
- Vendedor responsável (texto livre), telefone, e-mail
- Anotações (até 500 caracteres)
- Anexos: PDF, Excel (xls/xlsx/csv), JPG/PNG

## Comportamento

- O botão aparece **apenas** neste painel; os outros painéis continuam com o formulário atual.
- Ao salvar, o card entra na primeira coluna ("Cadastro").
- Abrindo o card, todos os campos ficam editáveis e salvam no mesmo lugar.
- Anexos podem ser adicionados e removidos tanto na criação quanto na edição, com download por link temporário.
- O card no kanban continua mostrando nome, telefone e e-mail como hoje.

## Detalhes técnicos

1. **Migração de banco**
   - Novas colunas em `representative_cards`: `focal_name`, `focal_phone`, `focal_email`, `contratante_monnera`, `vendor_name`, `vendor_phone`, `vendor_email` (todas texto, nulas).
   - Nova tabela `representative_card_attachments` (card_id, storage_path, file_name, mime_type, size_bytes, created_by) com GRANTs para `authenticated`/`service_role`, RLS ativa e políticas alinhadas às de `representative_cards` (usuários internos leem/escrevem; exclusão pelo autor ou admin).
   - Bucket privado `representative-card-attachments` com políticas em `storage.objects` para usuários autenticados internos.

2. **Frontend**
   - `src/pages/admin/AdminLeads.tsx`: constante `CROSS_CLIENT_PANEL_ID = "painel_msj9fyji"`; quando ativo, o botão de criação vira "Add Cliente" e abre o novo diálogo; `createRepresentativeCard` passa a gravar os campos extras (mapeando Nome do Parceiro → `full_name`, telefone/e-mail do focal → `phone`/`email` para manter a listagem e a checagem de duplicidade).
   - Novo componente `src/components/admin/ClienteCrossDialog.tsx` reutilizado em criação e edição, com validação (e-mails, CNPJ, limite de 500 caracteres) e feedback via toast.
   - Novo componente `src/components/admin/CardAttachments.tsx` para upload/listagem/remoção de anexos, com validação de tipo e tamanho (limite 10 MB por arquivo) e URL assinada para download.
   - No detalhe do card deste painel, a aba de detalhes exibe os novos campos e a seção de anexos.

3. **Verificação**
   - Typecheck limpo e teste manual: criar cliente, anexar PDF/Excel/JPG, reabrir, editar e remover anexo.

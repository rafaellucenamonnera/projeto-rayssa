# Corrigir "Erro ao adicionar comentário" nos cards do painel Onb Clientes Cross

## O que está acontecendo

Na aba **Conversa** dos cards do painel Onb Clientes Cross (ex.: DISTRIBUIDORA MASCOTE), o comentário é gravado na tabela de comentários de **leads do funil comercial**, que exige que o card exista na tabela `leads`. Os cards desse painel ficam em outra tabela (cards de painel personalizado), então o banco recusa a gravação e a tela mostra "Erro ao adicionar comentário".

Confirmado no banco: o vínculo obrigatório de `lead_comments.lead_id` aponta para `leads(id)`; o card do Cross não existe lá.

O painel de Embaixadores já tem tratamento próprio (usa a tabela de comentários dos cards de embaixador). Os painéis personalizados (Cross) não têm.

## Correção

1. Usar, nos painéis personalizados, a tabela de comentários própria dos cards de painel (`representative_card_comments`), em vez da tabela de leads.
2. Completar essa tabela para suportar o mesmo comportamento das outras conversas:
   - colunas de etapa, nome do usuário exibido e data do comentário;
   - tabela de anexos de comentário (PDF, imagens, Word), espelhando a que já existe para embaixadores;
   - permissões de acesso (RLS + GRANTs) equivalentes: quem enxerga o card enxerga a conversa; edição/exclusão apenas do próprio comentário (ou admin).
3. Criar um componente de conversa para cards de painel personalizado (baseado no já existente para embaixadores), com envio, listagem, edição, exclusão e anexos.
4. Ligar esse componente na aba **Conversa** do detalhe do card quando o painel for personalizado, mantendo o comportamento atual para o funil comercial e para embaixadores.

## Observação sobre a aba Tarefas

A aba **Tarefas** desses cards grava na tabela de tarefas de leads, que tem a mesma restrição — deve falhar pelo mesmo motivo. Não há tabela de tarefas para cards de painel personalizado hoje.

Opções:
- (A) corrigir só a Conversa agora, conforme acima;
- (B) corrigir também as Tarefas, criando a tabela de tarefas de cards de painel personalizado e ligando a aba.

Diga qual prefere; sem resposta, sigo com (A).

## Detalhes técnicos

- Migração: `ALTER TABLE public.representative_card_comments` (add `etapa text`, `usuario text`, `data_comentario timestamptz default now()`), nova `public.representative_card_comment_attachments` (FK para o comentário, `storage_path`, `file_name`, `mime_type`, `size_bytes`), GRANTs para `authenticated`/`service_role`, RLS espelhando as políticas de `ambassador_card_comments`.
- Anexos no bucket já usado (`lead-comment-attachments`), com prefixo próprio dos cards de painel.
- Novo `src/components/admin/RepresentativeCardComments.tsx` (cópia adaptada de `AmbassadorCardComments.tsx`).
- `src/pages/admin/AdminLeads.tsx`: na aba Conversa, escolher entre embaixador / painel personalizado (`isCustomCrmPanel`) / lead comercial.
- Sem notificações internas nesse fluxo (evita o erro conhecido de tipo de notificação).
- Validar com `tsgo`/build.

# Filtro de origem/domínio na aba Triagem Gmail

Mudança aditiva: novos metadados de origem da thread e um filtro na aba Triagem Gmail. Nenhuma regra de classificação, liberação, card, tarefa, Canva, cron ou e-mail é alterada.

## O que o usuário vai ver

Na aba "Triagem Gmail":
- Novo campo de busca "Origem/domínio da thread" que aceita `@baston.com.br`, um domínio, um remetente, destinatário ou participante e retorna todas as triagens cuja thread contenha o termo.
- Lista de domínios encontrados (chips clicáveis) montada a partir das mensagens carregadas, para seleção rápida.
- Botão para limpar o filtro; combina com os filtros já existentes (resultado, revisado, status operacional, CNPJ, remetente, código, período).
- Colunas adicionais na lista: origem sugerida, domínio de origem e nº de mensagens da thread.
- No detalhe da mensagem: remetente inicial, participantes (de/para/cc), domínios encontrados e evidência da origem.

Quando os metadados não existirem (mensagens antigas), o filtro cai automaticamente para `from_address` / `to_address` já gravados — nada fica invisível nem bloqueado.

## Dados

Migration aditiva em `gmail_processed_messages` (todas nullable, sem default que altere linhas):
- `thread_participants` jsonb — `{ from: [], to: [], cc: [], first_sender, most_frequent_sender, message_count }`
- `thread_domains` jsonb — array de domínios distintos
- `origin_sender` text
- `origin_domain` text
- `origin_match_type` text (`sender` | `recipient` | `thread` | `manual`)
- `origin_match_evidence` text

Sem novas policies: a tabela já tem RLS e os campos herdam as regras atuais. GRANTs existentes cobrem as colunas novas.

Backfill único e não destrutivo: para linhas existentes, preencher `origin_sender`/`origin_domain`/`origin_match_type='sender'`/`origin_match_evidence` a partir de `from_address`, e `thread_domains` a partir dos domínios de `from_address` + `to_address`. Nenhum campo de status, classificação ou vínculo é tocado.

## Worker

Em `supabase/functions/gmail-baston-sync/index.ts`, apenas gravação adicional: ao processar uma mensagem, coletar de/para/cc da thread (a função já busca a thread completa) e preencher os seis campos acima no mesmo insert/update já existente. Nenhuma decisão de classificação, pendência ou criação de card usa esses campos.

## Interface

Em `src/pages/admin/AdminTriagemGmail.tsx`:
- Tipo `TriageMessage` recebe os campos novos (opcionais).
- Novo estado `filterOrigem` + derivação `availableDomains` a partir das mensagens carregadas.
- Predicado do filtro: normaliza o termo (remove `@` inicial, lowercase) e casa contra `origin_sender`, `origin_domain`, `thread_domains`, `thread_participants` e, como fallback, `from_address`/`to_address`.
- Colunas e bloco de detalhe conforme descrito acima.

## Testes

Verificação via consultas de leitura e navegação no preview: thread com remetente `@baston.com.br`, com destinatário `@baston.com.br`, com múltiplos domínios, sem domínio conhecido, filtro isolado, filtro combinado com CNPJ/status/período, limpeza do filtro e mensagem sem thread completa. Conferência final de que contagens de cards, tarefas e envios de e-mail permanecem idênticas antes e depois.

## Arquivos

- nova migration em `supabase/migrations/`
- `supabase/functions/gmail-baston-sync/index.ts` (só gravação de metadados)
- `src/pages/admin/AdminTriagemGmail.tsx`

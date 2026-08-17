# Fase B — Reconfiguração para a conta rafael.lucena@monnera.com.br

Verificação somente leitura já executada. Nenhum e-mail foi enviado, nenhum card, tarefa ou notificação foi criado, e nenhum arquivo do projeto foi alterado.

## Verificação de conexão (somente leitura)

| Item | Resultado |
|---|---|
| Conta efetivamente autenticada | `rafael.lucena@monnera.com.br` (confirmado via chamada de perfil do Gmail: 13.139 mensagens, 9.869 threads) |
| Conexão | "Rafael's Gmail" (`google_mail`, OAuth2, via gateway) — existe no workspace, **ainda não vinculada a este projeto** |
| Permissões concedidas | `gmail.readonly`, `gmail.send`, `gmail.compose`, `gmail.modify` |
| Filtros ativos hoje | `from:baston.com.br` + `newer_than:7d`, máx. 50 mensagens por execução, revalidação do domínio após o fetch. Nenhum filtro por destinatário |
| Funções que usam a conta | Apenas `supabase/functions/gmail-baston-sync` |
| Secrets | `LOVABLE_API_KEY` e `GMAIL_SYNC_CRON_SECRET` presentes; `GOOGLE_MAIL_API_KEY` **ausente** — por isso todas as execuções do cron falham desde o início |
| Dependência de `maycon.santos@monnera.com.br` | Nenhuma no código, nas funções ou nos secrets. A única referência é o usuário `maycon.santos` como destinatário de notificações internas (não é conta de e-mail autenticada) |
| E-mails / cards / tarefas criados | Nenhum. `gmail_processed_messages` continua vazia |

## O que será alterado

**1. Conta e conector**
- Vincular a conexão "Rafael's Gmail" (`rafael.lucena@monnera.com.br`) a este projeto, gerando o secret `GOOGLE_MAIL_API_KEY` usado pela função.
- Nenhum outro secret é criado ou alterado.

**2. Filtros de leitura em `gmail-baston-sync`**
- Passar a consultar mensagens recebidas **e** mensagens direcionadas a `rafael.lucena@monnera.com.br`, mantendo o recorte de parceiro:
  `(from:baston.com.br OR to:rafael.lucena@monnera.com.br) newer_than:7d`
- Manter a revalidação do remetente após o fetch, para não processar mensagens fora do escopo.
- Preservar `thread_id` e `message_id` em `gmail_processed_messages` exatamente como já são gravados hoje — nada muda na idempotência.

**3. Envio de e-mails**
- Nenhum envio será implementado nesta etapa. O escopo `gmail.send` fica disponível, porém sem nenhum caminho de código que o utilize.
- O envio automático só entra depois de aprovação explícita da configuração, em etapa separada.

**4. Remoção de dependência de maycon.santos**
- Confirmar por varredura que nenhuma função, secret ou configuração usa essa conta como caixa de e-mail. Nada a remover no código.
- As notificações internas para o usuário Maycon permanecem intactas (item 5 pede para não alterar regras de notificação).

**5. Documentação**
- Atualizar o cabeçalho de `gmail-baston-sync/index.ts` registrando a conta autorizada, os filtros ativos e a regra de "não enviar e-mails".

## O que NÃO será tocado

Jira, Canva, criação automática de cards, cron (`gmail-baston-sync-2h`), processamento automático, regras de tarefas e notificações permanecem exatamente como estão. O worker continuará com a mesma lógica de criação de card — apenas a caixa e os filtros de leitura mudam.

## Observação importante

Ao vincular o conector, o cron (que já roda de 2 em 2 horas e hoje falha) passará a executar de verdade e poderá criar cards a partir dos e-mails encontrados. Se você quiser evitar isso agora, posso incluir um modo de triagem (processa e registra, sem criar card) — diga se prefere assim antes de eu executar.

## Pendências que dependem de você

1. Confirmar se o vínculo do conector deve ser feito agora ou apenas após decidir o modo de triagem.
2. Confirmar a janela de busca (hoje 7 dias) e o teto de 50 mensagens por execução.

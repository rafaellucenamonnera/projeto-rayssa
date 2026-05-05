# Sync automático de clientes (Google Drive → Painel Sucesso)

## Objetivo
Automatizar criação/atualização de cards no painel **sucesso** sem ação manual do usuário.

## Função
- Edge Function: `sync-drive-clients`
- Fonte: `GOOGLE_SHEETS_CSV_URL` (planilha publicada em CSV)
- Chave única: `CNPJ` normalizado (14 dígitos)

## Regras
- Se não existe `cnpj + status=sucesso`: cria lead novo em `status_lead=novo_lead`.
- Se existe: atualiza **somente campos alterados**.
- Sem CNPJ válido: ignora linha.

## Campos sincronizados
- Cadastro: `nome_fantasia`, `nome_responsavel`, `email_responsavel`, `telefone_responsavel`, `cidade`, `erp_utilizado`, `quantidade_lojas`, `quantidade_funcionarios`.
- Financeiro: `valor_mensalidade`, `valor_campanhas`.

## Logs
A execução grava resumo em `public.sync_job_logs` com:
- processados, criados, atualizados, erros.

## Execução diária (02:00)
No Supabase Scheduler, agendar chamada HTTP para:
`POST https://<PROJECT-REF>.supabase.co/functions/v1/sync-drive-clients`

Cron:
`0 2 * * *`

Header obrigatório:
- `Authorization: Bearer <SERVICE_ROLE_KEY ou token interno>`

## Execução inicial (massa)
Rode a função manualmente uma vez pelo painel (ou curl) para popular a base.

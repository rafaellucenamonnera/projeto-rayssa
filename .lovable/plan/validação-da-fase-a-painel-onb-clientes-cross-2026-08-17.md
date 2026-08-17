# Validação da Fase A — Painel Onb Clientes Cross

Roteiro de validação ponta a ponta do que já foi implementado. Nada de Jira, Canva, Gmail, cron ou processamento automático é tocado.

## Já confirmado (leitura, sem alterar nada)

- Triggers ativos em `representative_cards`: `representative_cards_guard_stage` (impede mover card bloqueado) e `representative_cards_log_stage` (grava histórico de etapa/bloqueio).
- Tabelas novas existem com RLS: `representative_card_history` (apenas SELECT e INSERT — sem UPDATE/DELETE, ou seja, imutável), `representative_card_notes` (SELECT/INSERT/UPDATE), `representative_card_tasks` (SELECT + ALL para admin/gestor).
- `notifications_type_check` existe com os tipos ampliados.
- `representative_card_history` está hoje com 0 registros, então todos os eventos gerados no teste são rastreáveis.

## O que a validação vai fazer

1. Build completo do projeto e typecheck; qualquer erro é corrigido antes de seguir.
2. Teste em navegador (Playwright, sessão autenticada) no painel Onb Clientes Cross, em um card de teste criado para isso:
   - criar tarefa (título, descrição, prazo, responsável);
   - editar título, descrição, prazo, responsável e status;
   - concluir com nota obrigatória (verificando que a conclusão sem nota é bloqueada);
   - excluir logicamente como administrador e confirmar que a tarefa sai da lista mas continua na base com `deleted_at`;
   - anexar e remover um arquivo;
   - criar e editar observação operacional;
   - abrir a aba Histórico e conferir os eventos registrados;
   - bloquear o card sem motivo (deve recusar) e depois com motivo;
   - tentar mover o card bloqueado no board (deve falhar com mensagem);
   - resolver o bloqueio e mover normalmente.
3. Verificações no banco (somente leitura) após cada bloco:
   - linhas em `representative_card_history` na ordem esperada;
   - tentativa de UPDATE e DELETE no histórico para provar a imutabilidade (deve ser recusada);
   - tarefa excluída com `deleted_at` preenchido;
   - notificações geradas para os destinatários resolvidos por perfil/permissão, incluindo Rafael Lucena e Maycon Santos, e leitura de uma delas;
   - permissões: confirmar que usuário sem permissão de exclusão não tem o botão e que a policy recusa a operação;
   - conferir que notificações do painel comercial (tipos antigos) continuam sendo aceitas pela constraint.
4. Limpeza: o card de teste, tarefas, anexo e observação criados são removidos ao final; o histórico permanece (é imutável por design) e isso é reportado.

## Observações técnicas

- Os testes de UI rodam contra o preview local com a sessão gerenciada; nenhuma migração nova é necessária — a Fase A já está aplicada.
- A prova de imutabilidade do histórico é feita com UPDATE/DELETE executados como usuário autenticado (papel `authenticated`), não como superusuário do banco.
- Caso algum passo falhe, o relatório traz comando executado, erro exato e a correção mínima proposta, sem sair do escopo da Fase A.

## Relatório final

Comando executado, resultado, erros encontrados, migrações (nenhuma nova esperada), tabelas/triggers/policies verificadas, evidência (screenshots e saídas de consulta) e confirmação de que nenhum módulo das Fases B e C foi alterado.

# Corrigir travamento após login e troca de telas

## Objetivo
Eliminar a tela branca ou sem resposta que só volta após atualizar, mantendo a navegação lateral rápida e previsível.

## Correções
1. Fortalecer o carregamento da sessão: impedir esperas indefinidas ao buscar permissões, ignorar respostas antigas e sempre liberar a tela com sucesso ou erro claro.
2. Limpar bloqueios invisíveis de janelas e do menu móvel ao trocar de tela, evitando que uma camada fechada continue bloqueando cliques.
3. Melhorar a troca de telas: usar um carregamento visual estável e uma recuperação automática única quando um arquivo de tela desatualizado falhar após nova publicação.
4. Fechar o menu móvel ao escolher uma opção, reduzindo sobreposição e deixando a navegação imediata.

## Verificação
- Entrar e abrir a área administrativa sem tela branca.
- Alternar repetidamente entre opções do menu lateral.
- Abrir e fechar janelas antes de navegar e confirmar que a tela continua clicável.
- Confirmar que falhas de sessão ou carregamento mostram recuperação, sem espera infinita.
- Conferir a versão para computador e celular, além da compilação final.

## Limites
Sem alterar dados, regras comerciais, permissões ou automações existentes.

# Corrigir travamento após salvar o card

## Diagnóstico confirmado
O salvamento no banco termina, mas a tela fica sem aceitar cliques por causa de duas janelas abertas ao mesmo tempo: a edição é aberta sobre os detalhes do card. Ao salvar, a lista e os detalhes são atualizados antes de a janela superior terminar de fechar, deixando o bloqueio de interação ativo.

## Alteração
- Fechar primeiro a janela de edição.
- Atualizar o card na tela somente no ciclo seguinte, depois que o fechamento terminar.
- Manter o salvamento, anexos e histórico como estão.
- Validar no painel autenticado que a janela fecha, os dados permanecem salvos e a página continua clicável.

## Critérios de aceite
- O botão Salvar deixa de girar após a resposta.
- A janela de edição fecha.
- O card exibe os dados novos sem atualizar a página.
- A tela continua aceitando cliques e rolagem.
- Os dados permanecem após atualizar a página.

# Correção: edições do card travando ao salvar (painel Onb Clientes Cross)

## O que acontece hoje

Ao editar um card já criado e clicar em Salvar, a janela fica girando sem terminar e sem mensagem de erro. Ao atualizar a página, nada do que foi digitado está salvo — o pedido nunca chegou ao banco.

## Causa identificada

O controle de sessão do aplicativo (`src/hooks/useAuth.tsx`) consulta os perfis do usuário *dentro* do aviso de mudança de sessão. Nesse momento a biblioteca de autenticação mantém um bloqueio interno; a consulta feita ali fica esperando o bloqueio que só será liberado depois que ela terminar.

Isso não aparece ao abrir a página: acontece quando a sessão é renovada automaticamente (aba aberta há algum tempo, volta do segundo plano). A partir desse instante, **qualquer** pedido ao banco na aba fica pendurado para sempre — por isso salvar trava, não dá erro, e recarregar a página resolve temporariamente.

Confirmado nas leituras: as permissões do banco para os cards estão corretas para administradores/gestores e os gatilhos existentes apenas devolvem mensagem de erro (não travam), então o travamento não vem do banco.

## Correção

1. `src/hooks/useAuth.tsx`: mover a busca de perfis para fora do aviso de sessão (execução adiada), mantendo o mesmo comportamento visível. Isso elimina o travamento de todos os pedidos da aba.
2. `src/components/admin/ClienteCrossDialog.tsx` (janela "Editar cliente", usada para todas as edições do card): rede de segurança no salvamento — se o pedido não responder em ~20 segundos, o botão volta ao normal e aparece uma mensagem clara pedindo para tentar de novo, em vez de girar indefinidamente.
3. Sem mudanças de banco, sem alterar campos, regras ou o restante do painel.

## Verificação

- Abrir um card do painel, editar os campos, salvar e confirmar que os dados persistem após atualizar a página.
- Simular a renovação de sessão e repetir o salvamento para confirmar que não trava mais.
- Conferir que a criação de card, comentários, tarefas e anexos continuam funcionando.

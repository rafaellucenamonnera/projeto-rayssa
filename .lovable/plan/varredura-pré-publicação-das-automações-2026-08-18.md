# Varredura pré-publicação das automações

Recomendo uma varredura curta antes de publicar. Nada é alterado nesta etapa: é só leitura, diagnóstico e um relatório de pendências e gargalos.

## O que será verificado

1. **Worker Gmail (`gmail-baston-sync`)**
   - Confirmar que o filtro ampliado (Baston + Jira para a caixa autorizada) está de fato rodando e ingerindo mensagens.
   - Checar as últimas execuções (sucesso, erro, duração, volume) e se o modo continua em triagem.
   - Verificar se há agendamento recorrente ativo (a cada 2h) ou se o worker só roda sob demanda.

2. **Fluxo Cross / Onboarding**
   - Estado dos 7 cards elegíveis: bloqueios abertos, pendências por etapa, ausência de código Monnera.
   - Se as regras de liberação por etapa estão coerentes (código não obrigatório antes de "Criação Painel").
   - Se há cards presos sem responsável ou sem histórico.

3. **Envio de e-mail de onboarding**
   - Confirmar que a allowlist de QA continua ativa (evita disparo real acidental em produção).
   - Verificar registros de envio com status inconsistente (preso em "enviando", falhas).

4. **Canva**
   - Validar que apenas links públicos são aceitos e que não há registros com link de edição gravado.

5. **Triagem WhatsApp e Gmail**
   - Registros pendentes acumulados, correções aplicadas e erros de processamento recentes.

6. **Saúde geral antes de publicar**
   - Erros recentes nas funções de borda.
   - Avisos do scanner de segurança (RLS/policies) em tabelas novas do fluxo Cross.
   - Build/typecheck limpo.

## Entregável

Um relatório curto no chat com:
- Bloqueios que impedem publicar (se houver).
- Pendências que não impedem publicar, mas precisam de acompanhamento.
- Gargalos das automações (falta de agendamento, dependência de ação manual, pontos sem retry).
- Recomendação objetiva: publicar agora ou corrigir antes.

## Depois da varredura

Se aparecerem correções necessárias, apresento um segundo plano com as mudanças antes de executar qualquer alteração.

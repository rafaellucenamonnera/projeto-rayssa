# Prompt para Lovable — Evolução CRM Comercial Monnera

Implemente a evolução abaixo **sem refatorar o que já existe**; faça apenas inserções e ajustes mínimos necessários para entregar valor com performance e foco no usuário final (não técnico, sem acesso ao banco).

## Contexto do produto
Estamos evoluindo o CRM comercial do Monnera para ganhar previsibilidade de receita, disciplina comercial e integração operacional.

## Diretrizes obrigatórias
- Não refatorar estrutura existente.
- Priorizar UX clara, objetiva e com linguagem simples.
- Garantir performance (consultas enxutas, paginação/filtros, evitar renderizações desnecessárias).
- Não depender de inserções manuais no banco.
- Entregar fluxos guiados na interface para usuários não técnicos.
- Manter rastreabilidade completa (logs/auditoria).

## Escopo funcional

### 1) Pipeline de Leads
- Visões: **Kanban (principal)** e Lista.
- Etapas padrão:
  1. Lead
  2. Contato Realizado
  3. Reunião Agendada
  4. Reunião Realizada
  5. Proposta Enviada
  6. Lead Convertido
  7. Contrato Enviado
- Permitir: criar/editar/reordenar etapas e drag-and-drop entre colunas.
- Exibir total financeiro consolidado por coluna no Kanban.

### 2) Regra crítica financeira (obrigatória no estágio Lead)
Campos obrigatórios:
- Valor Setup
- Valor Mensalidade
- Quantidade de lojas
- Receita de Campanhas

Cálculos automáticos:
- Mensalidade total = quantidade de lojas × valor mensalidade
- Valor total = setup + mensalidade total + campanhas

Bloqueio de avanço:
- Ao mover lead de etapa, abrir modal obrigatório de financeiro quando faltar dado.
- Impedir avanço sem preenchimento válido.

Auditoria financeira:
- Registrar quem preencheu e quando.
- Registrar quem editou e quando.

### 3) Módulo de E-mail (Gmail)
- Menu lateral: **E-mail**.
- Integração via OAuth Google por usuário.
- Funcionalidades: Caixa de entrada, Enviados, Rascunhos, Lixeira e envio de e-mails.
- Retaguarda: conectar, reconectar, desconectar e gerenciar conta conectada.
- Preparar base para automações futuras.

### 4) Módulo de Atividades (Google Agenda)
- Menu lateral: **Atividades**.
- CRUD de atividades com vínculo opcional/obrigatório a lead (conforme regra vigente do sistema).
- Integração Google Agenda por usuário:
  - Conectar conta
  - Vincular agenda
  - Ao criar atividade, enviar evento e salvar `google_event_id`
- Listagens: do dia, futuras e atrasadas.
- Alertas visuais para atividades atrasadas.

### 5) Módulo de Contatos
- Entidades: Pessoas e Empresas.
- Campos obrigatórios: Nome, Telefone, Email, Empresa.
- Vínculos: Pessoa→Empresa e Pessoa→Lead.
- Contato vinculado deve aparecer no detalhe do lead.
- Funcionalidades: criar, editar, excluir e filtrar por nome/email/empresa/telefone.

### 6) RBAC (Permissões por perfil)
Perfis:
- Usuário (operacional)
- Consultor
- Gestor Monnera

Regras:
- Usuário: atua no próprio escopo; sem financeiro e sem configurações.
- Consultor: gestão comercial do dia a dia; configurações bloqueadas.
- Gestor Monnera: acesso total, inclusive pipeline, financeiro e configurações.

### 7) Configurações
- Gerenciar perfis com checkboxes de permissões.
- Integrações: Gmail e Google Agenda.
- Gestão de usuários: criar usuário e definir perfil.

### 8) Logs e auditoria
Registrar eventos de:
- Alterações em leads
- Alterações financeiras
- Alterações em contatos
- Atividades criadas/editadas
- Alterações de permissões

## Banco de dados (alto nível)
Garantir compatibilidade/expansão para as tabelas:
`users`, `leads`, `pipelines`, `contatos`, `lead_contatos`, `atividades`, `email_config`, `logs`.

## UX esperada
- Pipeline com Kanban fluido e valores por coluna.
- Tela de lead com blocos: Dados gerais, Financeiro, Contatos, Atividades.
- E-mail com experiência parecida com cliente de e-mail padrão.
- Atividades com visão de lista e agenda.
- Contatos em tabela com filtros rápidos.

## Regras de negócio críticas
- Lead não avança sem financeiro válido.
- Financeiro só pode ser alterado por perfil autorizado (gestor, conforme regra final do produto).
- Integrações são por usuário (credenciais individuais).
- Tudo auditado.

## Critérios de aceite (objetivos)
1. Usuário sem conhecimento técnico consegue criar e mover lead com feedback claro.
2. Sistema bloqueia avanço de etapa quando faltam dados financeiros obrigatórios.
3. Totais financeiros por coluna aparecem no Kanban sem degradação perceptível.
4. Gmail e Google Agenda conectam por OAuth e funcionam por usuário.
5. Perfis RBAC respeitam restrições em UI e backend.
6. Logs registram autoria e data/hora das ações críticas.

## Entrega incremental sugerida
1. Regra financeira + bloqueio + auditoria + total no Kanban.
2. Atividades + Google Agenda.
3. E-mail Gmail.
4. Contatos + vínculos com lead.
5. Configurações + RBAC completo + hardening de logs.

Ao final, apresente:
- Resumo do que foi implementado.
- Lista de pendências técnicas.
- Riscos e próximos passos (WhatsApp, automações, forecast, relatórios, ERP).

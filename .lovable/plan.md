## Objetivo
Eliminar o erro "Erro ao salvar card" no Painel Comercial quando o usuário com permissão `leads.editar` (mas sem role `admin`/`gestor_conta`) edita campos gerais do card. A causa é a trigger `trg_protect_lead_responsible_user` rejeitando o update porque o frontend envia `responsible_user_id` no payload mesmo sem alterá-lo, e a função SQL só libera para admin/gestor.

## Mudanças

### 1. Frontend — `src/pages/admin/AdminLeads.tsx` (`saveEditedCard`)
- Calcular `responsibleChanged` e `slackChanged` comparando `editFormData.responsible_user_id` / `responsible_slack_user_id` com `detailLead.responsible_user_id` / `responsible_slack_user_id`.
- Só incluir `responsible_user_id` no payload (tanto no ramo `isCustomCrmPanel` quanto no ramo padrão de `leads`) quando `responsibleChanged` for `true`.
- Só incluir `responsible_slack_user_id` no payload do ramo `leads` quando `slackChanged` for `true`.
- Substituir o tratamento de erro por log detalhado:
  ```ts
  console.error("Erro ao salvar card", error);
  toast.error(`Erro ao salvar card: ${error.message}`);
  ```
- Ajustar o bloco de notificação para usar o novo `responsibleChanged` (em vez de checar `payload.responsible_user_id`) preservando o comportamento atual.

Nenhuma outra função, layout, pipeline, edge function ou bucket será alterado.

### 2. Migration Supabase — `public.protect_lead_responsible_user()`
Recriar a função (mantendo a mesma assinatura/trigger `trg_protect_lead_responsible_user`) para permitir alteração de `responsible_user_id` quando o usuário autenticado satisfaz **qualquer** uma das condições:

- `has_role(auth.uid(), 'admin')`
- `has_role(auth.uid(), 'gestor_conta')`
- `public.has_module_permission(auth.uid(), 'leads', 'editar')`

Comportamento preservado:
- Caminho anônimo (`auth.uid() IS NULL`) continua forçando `NEW.responsible_user_id := OLD.responsible_user_id`.
- Se `NEW.responsible_user_id` não mudar, segue passando direto.
- Se mudar e o usuário não atender a nenhuma das três condições acima, mantém o `RAISE EXCEPTION` atual.

SQL (resumo):
```sql
CREATE OR REPLACE FUNCTION public.protect_lead_responsible_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.responsible_user_id := OLD.responsible_user_id;
    RETURN NEW;
  END IF;

  IF NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor_conta'::app_role)
      OR public.has_module_permission(auth.uid(), 'leads', 'editar')
    ) THEN
      RAISE EXCEPTION 'Apenas administradores, gestores ou usuários com permissão leads.editar podem alterar o responsável pelo lead';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

## Validação
- Logar como usuário com `leads.editar` (Rafael Lucena) e salvar edição geral do card no painel comercial → sucesso, sem erro.
- Alterar o responsável com o mesmo usuário → sucesso e notificação enviada.
- Usuário sem nenhuma das três permissões tentando alterar responsável → continua bloqueado pela trigger.

## Fora do escopo
Sem mudanças em layout, pipeline, outras edge functions, buckets ou permissões de outros módulos.
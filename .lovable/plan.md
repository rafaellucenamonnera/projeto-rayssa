## Causa raiz encontrada

O frontend (`src/pages/CadastroParceiro.tsx`, linhas 118–129) chama a RPC `register_parceiro` passando **9 parâmetros**, incluindo `p_cliente_monnera` e `p_cliente_monnera_cnpj`. Mas a função no banco aceita apenas **7 parâmetros** (sem esses dois) e a tabela `parceiros_comerciais` **não possui** essas colunas.

Resultado: o PostgREST devolve "Could not find the function public.register_parceiro(...)" para todo cadastro. O `catch` genérico transforma isso em **"Erro ao cadastrar. Tente novamente."** — mesmo quando os dados estão corretos. Nenhum cadastro consegue ser concluído pelo formulário hoje.

## Arquivos analisados

- `src/pages/CadastroParceiro.tsx` — formulário + submit
- `supabase/functions/delete-orphan-user/index.ts` — cleanup (não é a causa)
- RPC `public.register_parceiro` e tabela `public.parceiros_comerciais` (via SQL)

## Plano de correção (mínimo, sem refatorar)

### 1) Backend — migration

Adicionar colunas e atualizar a RPC para receber os dois campos. Sem alterar policies nem fluxo.

```sql
ALTER TABLE public.parceiros_comerciais
  ADD COLUMN IF NOT EXISTS cliente_monnera boolean,
  ADD COLUMN IF NOT EXISTS cliente_monnera_cnpj text;

CREATE UNIQUE INDEX IF NOT EXISTS parceiros_comerciais_cpf_key
  ON public.parceiros_comerciais (cpf);
CREATE UNIQUE INDEX IF NOT EXISTS parceiros_comerciais_email_key
  ON public.parceiros_comerciais (email);

-- DROP da assinatura antiga + CREATE da nova com os 2 parâmetros extras
DROP FUNCTION IF EXISTS public.register_parceiro(uuid,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.register_parceiro(
  p_user_id uuid, p_codigo_parceiro text, p_nome text, p_cpf text,
  p_email text, p_telefone_ddd text, p_telefone_numero text,
  p_slug_consultor text, p_cliente_monnera boolean,
  p_cliente_monnera_cnpj text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result json;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  INSERT INTO public.parceiros_comerciais
    (user_id, codigo_parceiro, nome, cpf, email, telefone_ddd, telefone_numero,
     slug_consultor, cliente_monnera, cliente_monnera_cnpj)
  VALUES
    (p_user_id, p_codigo_parceiro, p_nome, p_cpf, p_email, p_telefone_ddd,
     p_telefone_numero, p_slug_consultor, p_cliente_monnera, p_cliente_monnera_cnpj)
  RETURNING json_build_object('id', id, 'nome', nome,
    'codigo_parceiro', codigo_parceiro, 'slug_consultor', slug_consultor)
  INTO result;
  RETURN result;
END $$;
```

### 2) Frontend — `src/pages/CadastroParceiro.tsx`

Trocar o `catch` genérico por mensagens específicas. Sem mudar layout, validações nem campos.

- `authError` "already registered" / "User already registered" → toast: **"Este e-mail já possui cadastro. Acesse seu painel ou recupere sua senha."** (mantém o link "Acesse seu painel" já presente)
- `authError` "weak_password" → toast: **"Senha fraca. Escolha uma senha mais segura."**
- `insertError` com `parceiros_comerciais_cpf_key` ou `cpf` → toast + erro no campo: **"Este CPF ou CNPJ já está vinculado a um cadastro existente."**
- `insertError` com `parceiros_comerciais_email_key` → toast: **"Este e-mail já possui cadastro. Acesse seu painel ou recupere sua senha."**
- Qualquer outro erro → toast: **"Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte."** + `console.error` com o erro real para diagnóstico.
- Sucesso → toast: **"Cadastro enviado com sucesso. Agora aguarde a aprovação para acessar o painel."** (texto atualizado).
- A validação client-side já cobre "campos obrigatórios", "senhas não coincidem" e "CNPJ inválido" — sem mudar.

### 3) Pergunta antes de implementar

O escopo do projeto pede também validar se o **CNPJ do cliente Monnera realmente existe** na base. Hoje **não existe** uma tabela de clientes Monnera para consultar (só temos `parceiros_comerciais`, `leads`, `lojas` etc.).

Quer que eu:

- **(A)** apenas grave o CNPJ informado sem validar contra base (mensagem "CNPJ inexistente" fica fora deste fix); ou
- **(B)** valide contra alguma tabela que você indicar (qual?)?

Sem essa definição, sigo com **(A)** — que é o mínimo para destravar o cadastro e entregar todas as outras mensagens específicas pedidas.

## Teste após implementar

1. Cadastrar novo embaixador com dados válidos → toast de sucesso + redirect `/confirmacao`.
2. Repetir com mesmo e-mail → toast específico de e-mail duplicado.
3. Repetir com mesmo CPF e e-mail novo → toast específico de CPF duplicado.
4. Senha fraca (`123456`) → toast específico.
5. Verificar no banco que `cliente_monnera` e `cliente_monnera_cnpj` ficam gravados.

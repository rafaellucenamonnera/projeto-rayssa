# Validação de senha — criação e troca apenas

## Escopo
Não tocar em `/login` (`src/pages/admin/AdminLogin.tsx` e equivalente parceiro). Mensagens lá permanecem:
- "Preencha email e senha"
- "Email ou senha incorretos"

Aplicar validação de força de senha em:
- `/primeiro-acesso` → `src/pages/PrimeiroAcesso.tsx`
- `/resetar-senha` → `src/pages/ResetarSenha.tsx`
- `/cadastro` → `src/pages/CadastroParceiro.tsx` (se houver campo de senha)

## Regras
- Mínimo 6 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 caractere especial (não alfanumérico)

## Implementação

### 1. Helper compartilhado
Criar `src/lib/passwordPolicy.ts`:
- `validatePassword(pw: string): { valid: boolean }`
- `PASSWORD_RULES_TEXT = "Mínimo de 6 caracteres, uma letra maiúscula e um caractere especial"`
- `PASSWORD_INVALID_MSG = "Sua senha ainda não atende aos requisitos. Use no mínimo 6 caracteres, uma letra maiúscula e um caractere especial."`
- `PASSWORD_WEAK_MSG = "Essa senha não foi aceita. Use no mínimo 6 caracteres, uma letra maiúscula e um caractere especial."`
- Regex: `/[A-Z]/` e `/[^A-Za-z0-9]/` + `length >= 6`

### 2. `/primeiro-acesso`
- Substituir checagem `password.length < 6` por `validatePassword(password)`; toast com `PASSWORD_INVALID_MSG`.
- Abaixo do input "Nova Senha", lista de requisitos (3 linhas) com check verde quando cumprido (texto: "Mínimo de 6 caracteres", "Uma letra maiúscula", "Um caractere especial").
- No catch, mapear erros do Supabase contendo "weak" / "password" / "Password should" → `PASSWORD_WEAK_MSG`.

### 3. `/resetar-senha`
- Mesma validação e mesmo bloco de requisitos abaixo do campo.
- Mesmo mapeamento de erro do Supabase.

### 4. `/cadastro` (`CadastroParceiro.tsx`)
- Se o fluxo tem campo de senha, aplicar mesma validação + lista de requisitos.
- Se não tem (cadastro só envia link de primeiro acesso), nenhuma mudança.

## Não fazer
- Nada em `/login`.
- Não alterar políticas no backend.
- Não habilitar HIBP agora.

## Critério de aceite
- Login segue com mensagens atuais.
- Em `/primeiro-acesso` e `/resetar-senha` a lista de requisitos aparece e atualiza ao digitar.
- Senha fraca bloqueia o submit com a mensagem amigável.
- Erro do Supabase nunca aparece cru ao usuário.

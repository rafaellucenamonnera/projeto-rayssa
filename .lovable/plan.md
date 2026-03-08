
## Análise do Problema

Baseado nos logs de autenticação, identifiquei o problema:

1. **O link de recovery é clicado** → Supabase faz login implícito via `PASSWORD_RECOVERY` (19:27:42)
2. **A página `/resetar-senha` fica carregando** → O componente espera o evento `PASSWORD_RECOVERY` mas pode não capturá-lo
3. **O usuário clica novamente no link** → Erro "Email link is invalid or has expired" (19:30:55) porque o token já foi usado

### Causa Raiz

O problema está no **timing do `onAuthStateChange`**. Quando o Supabase processa o token na URL e faz o login via recovery, o evento `PASSWORD_RECOVERY` pode disparar **antes** do componente React montar o listener. Como resultado:

- O `onAuthStateChange` não captura o evento que já passou
- O `getSession()` retorna uma sessão, mas o componente fica esperando eternamente se a sessão foi estabelecida antes do mount

### Solução

Modificar `ResetarSenha.tsx` para:

1. **Processar os parâmetros de hash da URL** para detectar o recovery flow
2. **Adicionar timeout de segurança** para evitar loading infinito
3. **Melhorar a detecção da sessão** verificando se já existe uma sessão válida imediatamente

### Mudanças no Código

**`src/pages/ResetarSenha.tsx`:**
- Verificar hash da URL para detectar `type=recovery` 
- Usar `setReady(true)` imediatamente quando há sessão válida
- Adicionar timeout de fallback (5s) com mensagem de erro clara
- Adicionar botão para solicitar novo link caso expire

### Detalhes Técnicos

```text
URL do Supabase após click no email:
/resetar-senha#access_token=xxx&type=recovery&...

Fluxo corrigido:
1. Página carrega → detecta hash com type=recovery
2. Supabase processa token automaticamente 
3. useEffect captura sessão ou evento
4. Timeout protege contra loading infinito
```

## Sincronizar com a main

Não consigo executar comandos git (merge, push, pull, checkout) a partir do ambiente Lovable — git é gerenciado internamente. Mas a sincronização entre Lovable e GitHub é bidirecional e automática:

### O que já está sincronizado

- Toda alteração feita aqui no Lovable é enviada automaticamente para a branch padrão do repositório GitHub conectado.
- Toda alteração feita direto no GitHub (push ou merge na branch padrão) é puxada automaticamente para o Lovable.

### Para sincronizar a main agora

Faça uma das opções no GitHub:

1. **Se você tem uma branch de feature aberta e quer trazer para a main:**
   - Abra um Pull Request da branch → `main`
   - Faça o merge no GitHub
   - O Lovable detecta o novo commit na `main` em poucos segundos e atualiza o preview

2. **Se a main do GitHub está à frente do Lovable (commits feitos fora):**
   - Não precisa fazer nada — o Lovable sincroniza automaticamente
   - Se não atualizar em ~1 min, abra o menu (+) → GitHub → reconecte o projeto

3. **Se você quer publicar a versão atual da main:**
   - Use o botão Publish no canto superior direito do Lovable

### O que eu posso fazer aqui

- Aplicar novas migrations / código direto no Lovable (vai para a `main` automaticamente)
- Validar permissões, queries e estado do banco
- Revisar diffs de arquivos

Me diga qual desses cenários é o seu caso (PR pendente, commits externos na main, ou publicar) que eu sigo a partir daí.
## Corrigir download do dossiê em AdminLeads.tsx

**Arquivo:** `src/pages/admin/AdminLeads.tsx` (função `handleDownloadDossie`, linhas 1052–1087)

**Problema:** A função lista `dossies/` na raiz com `search: leadId`, mas a edge `generate-dossie` salva em `dossies/{leadId}/dossie-{nome}.txt`. O `list` retorna vazio e o botão sempre falha.

**Correção:**

1. Listar a pasta correta do lead:
   ```ts
   const { data: files } = await supabase.storage
     .from("propostas")
     .list(`dossies/${leadId}`);
   ```

2. Encontrar o arquivo que começa com `dossie-` e termina com `.txt`:
   ```ts
   const dossieFile = files?.find(
     (f) => f.name.startsWith("dossie-") && f.name.endsWith(".txt")
   );
   ```

3. Gerar signed URL com o caminho completo:
   ```ts
   .createSignedUrl(`dossies/${leadId}/${dossieFile.name}`, 3600)
   ```

O restante do fluxo (fetch + blob download) permanece igual.

**Fora de escopo:** edge function `generate-dossie`, bucket `propostas`, formato `.txt`.

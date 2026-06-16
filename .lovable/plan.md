## Análise

Verifiquei o arquivo `src/components/admin/LeadImportDialog.tsx` e a interface `LeadImportDialogProps` já contém as props opcionais necessárias:

```typescript
interface LeadImportDialogProps {
  parceiros: { id: string; nome: string }[];
  onImported: () => void;
  customCrmMode?: boolean;
  users?: { user_id: string; nome: string }[];
  panelId?: string;
  firstStageId?: string;
}
```

O `AdminLeads.tsx` passa `usersAll` (tipo `{ user_id: string; nome: string }[]`) como prop `users`, e o TypeScript compila sem erros. A alteração solicitada já está aplicada no código atual.

**Nenhuma modificação de arquivo é necessária.**
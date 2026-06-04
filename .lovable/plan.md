## Adicionar vínculo de painel (panel_id) aos leads

### Contexto
O Kanban precisa filtrar cards por painel. A coluna `panel_id` será adicionada à tabela `leads` com foreign key para `pipeline_panels(id)` e valor padrão `'comercial'` para leads existentes.

### Mudanças

**1. Migration SQL no Supabase**
Executar via `supabase--migration`:
```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS panel_id text NOT NULL DEFAULT 'comercial';

UPDATE public.leads
SET panel_id = 'comercial'
WHERE panel_id IS NULL OR panel_id = '';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_panel_id_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_panel_id_fkey
  FOREIGN KEY (panel_id)
  REFERENCES public.pipeline_panels(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_leads_panel_id ON public.leads(panel_id);
```

**2. Validação pós-migration**
Confirmar via `supabase--read_query`:
- Existência da coluna `panel_id` em `leads`
- `panel_id = 'comercial'` para leads antigos
- Foreign key `leads_panel_id_fkey` apontando para `pipeline_panels(id)`
- Índice `idx_leads_panel_id` existente

**3. Build**
Verificar que o projeto continua compilando após a migration.

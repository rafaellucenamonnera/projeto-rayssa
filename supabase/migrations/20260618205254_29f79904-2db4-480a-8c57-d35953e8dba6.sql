-- Helper to check module_permissions
create or replace function public.has_module_permission(_user_id uuid, _modulo text, _acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_permissions
    where user_id = _user_id
      and modulo = _modulo
      and acao = _acao
      and permitido = true
  );
$$;

grant execute on function public.has_module_permission(uuid, text, text) to authenticated, service_role;

-- =========================
-- leads
-- =========================
drop policy if exists "Module perm insert leads" on public.leads;
create policy "Module perm insert leads"
  on public.leads for insert to authenticated
  with check (public.has_module_permission(auth.uid(), 'leads', 'criar'));

drop policy if exists "Module perm update leads" on public.leads;
create policy "Module perm update leads"
  on public.leads for update to authenticated
  using (
    public.has_module_permission(auth.uid(), 'leads', 'editar')
    or public.has_module_permission(auth.uid(), 'leads', 'mover_pipeline')
    or public.has_module_permission(auth.uid(), 'leads', 'editar_pipeline')
    or public.has_module_permission(auth.uid(), 'leads', 'editar_financeiro')
  )
  with check (
    public.has_module_permission(auth.uid(), 'leads', 'editar')
    or public.has_module_permission(auth.uid(), 'leads', 'mover_pipeline')
    or public.has_module_permission(auth.uid(), 'leads', 'editar_pipeline')
    or public.has_module_permission(auth.uid(), 'leads', 'editar_financeiro')
  );

drop policy if exists "Module perm delete leads" on public.leads;
create policy "Module perm delete leads"
  on public.leads for delete to authenticated
  using (public.has_module_permission(auth.uid(), 'leads', 'excluir'));

-- =========================
-- lead_tasks
-- =========================
drop policy if exists "Module perm insert lead_tasks" on public.lead_tasks;
create policy "Module perm insert lead_tasks"
  on public.lead_tasks for insert to authenticated
  with check (public.has_module_permission(auth.uid(), 'leads', 'criar_tarefa'));

drop policy if exists "Module perm update lead_tasks" on public.lead_tasks;
create policy "Module perm update lead_tasks"
  on public.lead_tasks for update to authenticated
  using (public.has_module_permission(auth.uid(), 'leads', 'concluir_tarefa'))
  with check (public.has_module_permission(auth.uid(), 'leads', 'concluir_tarefa'));

-- =========================
-- lead_comments
-- =========================
drop policy if exists "Module perm insert lead_comments" on public.lead_comments;
create policy "Module perm insert lead_comments"
  on public.lead_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_module_permission(auth.uid(), 'leads', 'inserir_mensagem')
  );

drop policy if exists "Module perm update own lead_comments" on public.lead_comments;
create policy "Module perm update own lead_comments"
  on public.lead_comments for update to authenticated
  using (
    user_id = auth.uid()
    and public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
  )
  with check (
    user_id = auth.uid()
    and public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
  );

drop policy if exists "Module perm delete own lead_comments" on public.lead_comments;
create policy "Module perm delete own lead_comments"
  on public.lead_comments for delete to authenticated
  using (
    user_id = auth.uid()
    and public.has_module_permission(auth.uid(), 'leads', 'excluir_mensagem')
  );

-- =========================
-- lead_comment_attachments
-- =========================
drop policy if exists "Module perm select lead_comment_attachments" on public.lead_comment_attachments;
create policy "Module perm select lead_comment_attachments"
  on public.lead_comment_attachments for select to authenticated
  using (public.has_module_permission(auth.uid(), 'leads', 'acessar'));

drop policy if exists "Module perm insert lead_comment_attachments" on public.lead_comment_attachments;
create policy "Module perm insert lead_comment_attachments"
  on public.lead_comment_attachments for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_module_permission(auth.uid(), 'leads', 'inserir_arquivo')
  );

-- =========================
-- storage.objects for lead-comment-attachments bucket
-- =========================
drop policy if exists "Module perm select lead-comment-attachments" on storage.objects;
create policy "Module perm select lead-comment-attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lead-comment-attachments'
    and public.has_module_permission(auth.uid(), 'leads', 'acessar')
  );

drop policy if exists "Module perm insert lead-comment-attachments" on storage.objects;
create policy "Module perm insert lead-comment-attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lead-comment-attachments'
    and public.has_module_permission(auth.uid(), 'leads', 'inserir_arquivo')
  );

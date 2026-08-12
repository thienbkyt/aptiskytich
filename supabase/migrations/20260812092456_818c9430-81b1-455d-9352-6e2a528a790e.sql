create table public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','planned','done','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_feature_suggestions_user_id on public.feature_suggestions(user_id);
create index idx_feature_suggestions_created_at on public.feature_suggestions(created_at desc);

grant select, insert, update, delete on public.feature_suggestions to authenticated;
grant all on public.feature_suggestions to service_role;

alter table public.feature_suggestions enable row level security;

create policy "own_select" on public.feature_suggestions
  for select to authenticated using (user_id = auth.uid());
create policy "own_insert" on public.feature_suggestions
  for insert to authenticated with check (user_id = auth.uid());
create policy "admin_select" on public.feature_suggestions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin_update" on public.feature_suggestions
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "admin_delete" on public.feature_suggestions
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create trigger trg_feature_suggestions_updated_at
  before update on public.feature_suggestions
  for each row execute function public.update_updated_at_column();

create policy "suggestion_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'suggestion-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "suggestion_files_select_own_or_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'suggestion-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));

create policy "suggestion_files_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'suggestion-files' and public.has_role(auth.uid(), 'admin'));
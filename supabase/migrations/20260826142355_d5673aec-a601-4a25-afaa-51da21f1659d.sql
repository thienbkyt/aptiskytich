alter table public.tmp_missing_imgs enable row level security;

drop policy if exists "admin_only_tmp_missing_imgs" on public.tmp_missing_imgs;
create policy "admin_only_tmp_missing_imgs"
  on public.tmp_missing_imgs
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.tmp_missing_imgs from anon;
grant select, insert, update, delete on public.tmp_missing_imgs to authenticated;
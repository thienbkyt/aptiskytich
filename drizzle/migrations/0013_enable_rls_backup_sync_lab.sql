alter table public.backup_sync_lab_20260922 enable row level security;

revoke all on public.backup_sync_lab_20260922 from anon;
grant select, insert, update, delete on public.backup_sync_lab_20260922 to authenticated;
grant all on public.backup_sync_lab_20260922 to service_role;

create policy "Admins can manage backup_sync_lab_20260922"
on public.backup_sync_lab_20260922
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));
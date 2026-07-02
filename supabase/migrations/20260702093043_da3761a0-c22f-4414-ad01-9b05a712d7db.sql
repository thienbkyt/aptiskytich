create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_type text not null check (device_type in ('mobile','tablet','desktop')),
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

grant select, insert, update, delete on public.user_devices to authenticated;
grant all on public.user_devices to service_role;

alter table public.user_devices enable row level security;

create policy "own devices select" on public.user_devices for select using (auth.uid() = user_id);
create policy "own devices insert" on public.user_devices for insert with check (auth.uid() = user_id);
create policy "own devices update" on public.user_devices for update using (auth.uid() = user_id);
create policy "own devices delete" on public.user_devices for delete using (auth.uid() = user_id);

alter table public.user_devices replica identity full;
alter publication supabase_realtime add table public.user_devices;

create or replace function public.register_device(p_device_id text, p_type text, p_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_devices (user_id, device_id, device_type, device_label, last_seen_at)
  values (auth.uid(), p_device_id, p_type, p_label, now())
  on conflict (user_id, device_id)
  do update set last_seen_at = now(),
                device_type = excluded.device_type,
                device_label = excluded.device_label;

  delete from public.user_devices
  where user_id = auth.uid()
    and device_type = p_type
    and device_id <> p_device_id;
end;
$$;

revoke execute on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;
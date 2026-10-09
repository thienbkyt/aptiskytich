-- Học Key Siêu Tốc: nội dung key do admin sửa + tiến độ "đã thuộc" của học viên
create table if not exists public.key_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null,               -- 'l3_mnemonic' (ref = "<topic>|<code>") | 'r5_signal' (ref = exam_set_id)
  ref text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (kind, ref)
);
alter table public.key_notes enable row level security;
drop policy if exists "key_notes read" on public.key_notes;
create policy "key_notes read" on public.key_notes for select to authenticated using (true);
drop policy if exists "key_notes admin write" on public.key_notes;
create policy "key_notes admin write" on public.key_notes for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select, insert, update, delete on public.key_notes to authenticated;

create table if not exists public.key_learned (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_set_id uuid not null,
  part text not null,
  learned_at timestamptz not null default now(),
  primary key (user_id, exam_set_id)
);
alter table public.key_learned enable row level security;
drop policy if exists "key_learned own" on public.key_learned;
create policy "key_learned own" on public.key_learned for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.key_learned to authenticated;

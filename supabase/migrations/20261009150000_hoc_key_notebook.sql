-- Học Key Thần Tốc: câu nhớ riêng của từng học viên + sổ key cá nhân
create table if not exists public.key_user_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.key_user_notes enable row level security;
drop policy if exists "key_user_notes own" on public.key_user_notes;
create policy "key_user_notes own" on public.key_user_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.key_user_notes to authenticated;

create table if not exists public.key_notebook (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_set_id uuid not null,
  part text not null,
  source text not null default 'manual',
  added_at timestamptz not null default now(),
  primary key (user_id, exam_set_id)
);
alter table public.key_notebook enable row level security;
drop policy if exists "key_notebook own" on public.key_notebook;
create policy "key_notebook own" on public.key_notebook for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.key_notebook to authenticated;

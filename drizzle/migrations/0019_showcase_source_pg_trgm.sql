create extension if not exists pg_trgm with schema extensions;

alter table public.showcase_entries add column if not exists source text not null default 'user';
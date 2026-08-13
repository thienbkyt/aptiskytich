create or replace view public.site_stats_v as
select
  (select count(*) from public.exam_sets where is_published) as de_count,
  (select count(*) from public.profiles)                     as user_count,
  (select count(*) from public.test_results)                 as attempt_count;

create or replace function public.get_site_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(s) from public.site_stats_v s;
$$;
grant execute on function public.get_site_stats() to anon, authenticated;

revoke all on public.site_stats_v from anon, authenticated;

alter table public.tmp_key13 enable row level security;
alter table public.tmp_rathi_1208 enable row level security;
revoke all on public.tmp_key13 from anon, authenticated;
revoke all on public.tmp_rathi_1208 from anon, authenticated;
create policy "tmp_key13 admin only" on public.tmp_key13 for select to authenticated using (public.is_admin(auth.uid()));
create policy "tmp_rathi_1208 admin only" on public.tmp_rathi_1208 for select to authenticated using (public.is_admin(auth.uid()));
create policy "feedback_images_auth_read" on storage.objects for select to authenticated using (bucket_id = 'feedback-images');
create policy "feedback_images_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'feedback-images');
create policy "feedback_images_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'feedback-images' and public.has_role(auth.uid(),'admin'));

create table public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  content text not null,
  score_image_url text,
  is_anonymous boolean not null default false,
  is_approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.student_feedback to anon;
grant select, insert, update, delete on public.student_feedback to authenticated;
grant all on public.student_feedback to service_role;
alter table public.student_feedback enable row level security;
create policy "sf_public_read_approved" on public.student_feedback for select using (is_approved = true);
create policy "sf_own_read" on public.student_feedback for select to authenticated using (auth.uid() = user_id);
create policy "sf_own_insert" on public.student_feedback for insert to authenticated with check (auth.uid() = user_id);
create policy "sf_admin_read" on public.student_feedback for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "sf_admin_update" on public.student_feedback for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "sf_admin_delete" on public.student_feedback for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create index student_feedback_created_idx on public.student_feedback (created_at desc);

create table public.exam_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, exam_date)
);
create table public.exam_review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.exam_reviews(id) on delete cascade,
  skill text not null check (skill in ('speaking','listening','reading','writing','grammar_vocab')),
  part text not null,
  topic text not null
);
create index exam_reviews_date_idx on public.exam_reviews (exam_date desc);
create index exam_review_items_review_idx on public.exam_review_items (review_id);

grant select, insert, update, delete on public.exam_reviews to authenticated;
grant all on public.exam_reviews to service_role;
grant select, insert, update, delete on public.exam_review_items to authenticated;
grant all on public.exam_review_items to service_role;
alter table public.exam_reviews enable row level security;
alter table public.exam_review_items enable row level security;

create policy "er_auth_read" on public.exam_reviews for select to authenticated using (true);
create policy "er_own_insert" on public.exam_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "er_own_update" on public.exam_reviews for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin')) with check (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "er_own_delete" on public.exam_reviews for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create policy "eri_auth_read" on public.exam_review_items for select to authenticated using (true);
create policy "eri_own_insert" on public.exam_review_items for insert to authenticated with check (exists (select 1 from public.exam_reviews r where r.id = review_id and (r.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "eri_own_update" on public.exam_review_items for update to authenticated using (exists (select 1 from public.exam_reviews r where r.id = review_id and (r.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))) with check (exists (select 1 from public.exam_reviews r where r.id = review_id and (r.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "eri_own_delete" on public.exam_review_items for delete to authenticated using (exists (select 1 from public.exam_reviews r where r.id = review_id and (r.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
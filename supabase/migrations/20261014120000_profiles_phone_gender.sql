-- SĐT + giới tính trong Thông tin tài khoản (không bắt buộc, không xác minh)
alter table public.profiles add column if not exists phone text, add column if not exists gender text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_gender_check') then
    alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('male','female','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_phone_check') then
    alter table public.profiles add constraint profiles_phone_check check (phone is null or phone ~ '^0[0-9]{9}$');
  end if;
end $$;

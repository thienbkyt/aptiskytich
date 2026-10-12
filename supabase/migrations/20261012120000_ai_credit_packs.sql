-- 12/10/2026: Bán gói lượt chấm AI (Pro mua thêm) + ví trừ theo từng đợt (đợt sắp hết hạn trừ trước).
-- Đã chạy trực tiếp trên DB; file này để lưu vết. Backup: bak_ai_credit_grants_20261012, bak_feature_usage_credit_20261012.

create table if not exists public.ai_credit_packs (
  key text primary key, label text not null,
  credits integer not null check (credits > 0), price_vnd integer not null check (price_vnd > 0),
  valid_days integer not null default 90, badge text, active boolean not null default true,
  sort_order integer not null default 0, updated_at timestamptz not null default now()
);
alter table public.ai_credit_packs enable row level security;
create policy "credit packs read" on public.ai_credit_packs for select using (true);
create policy "credit packs admin write" on public.ai_credit_packs for all to authenticated
  using ((select has_role((select auth.uid()), 'admin'::app_role)))
  with check ((select has_role((select auth.uid()), 'admin'::app_role)));
insert into public.ai_credit_packs (key, label, credits, price_vnd, valid_days, badge, sort_order) values
  ('credits_10', '10 lượt chấm AI', 10, 19000, 90, null, 1),
  ('credits_30', '30 lượt chấm AI', 30, 49000, 90, 'Phổ biến', 2),
  ('credits_80', '80 lượt chấm AI', 80, 99000, 90, 'Tiết kiệm 35%', 3)
on conflict (key) do nothing;

alter table public.ai_credit_grants add column if not exists used integer not null default 0;
alter table public.ai_credit_grants add column if not exists payment_id uuid unique references public.payments(id);
alter table public.ai_credit_grants add column if not exists source text not null default 'voucher';
alter table public.feature_usage add column if not exists credit_grant_id uuid references public.ai_credit_grants(id);

-- Trigger allocate_ai_credit (BEFORE INSERT feature_usage): mỗi lượt trả bằng ví (theo ref_id) trừ 1 vào
-- đợt còn hạn có expires_at sớm nhất, tăng ai_credit_grants.used.
-- check_feature_access: credits_balance = SUM(amount - used) của các đợt còn hạn.
-- grant_credits_for_payment(payment_id): service role gọi từ payos-webhook, cộng lượt (unique payment_id).
-- get_my_ai_wallet(): số dư + 20 đợt gần nhất cho giao diện.
-- notify_on_payment_paid: nhãn + hạn dùng cho gói lượt. referral_on_payment_paid: bỏ qua credits_*.
-- (Định nghĩa đầy đủ các hàm xem trên DB.)

-- 1. voucher_codes
CREATE TABLE public.voucher_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  code_norm text GENERATED ALWAYS AS (upper(btrim(code))) STORED,
  kind text NOT NULL CHECK (kind IN ('standalone','checkout')),
  gift_days integer NOT NULL DEFAULT 0,
  gift_ai_cap integer,
  gift_ai_credits integer NOT NULL DEFAULT 0,
  credit_expires_at timestamptz,
  applies_to_plans text[],
  requires_activity boolean NOT NULL DEFAULT false,
  max_total_uses integer,
  max_per_user integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX voucher_codes_code_norm_key ON public.voucher_codes (code_norm);

COMMENT ON TABLE public.voucher_codes IS 'Mã ưu đãi CHỈ TẶNG THÊM (ngày/lượt), TUYỆT ĐỐI không giảm số tiền phải trả. payos-webhook có chốt từ chối khi paidAmount < expectedAmount — thêm loại mã giảm giá tiền sẽ làm đơn hợp lệ bị từ chối.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_codes TO authenticated;
GRANT ALL ON public.voucher_codes TO service_role;
REVOKE ALL ON public.voucher_codes FROM anon;

ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage voucher codes"
ON public.voucher_codes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. voucher_redemptions
CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.voucher_codes(id),
  user_id uuid NOT NULL,
  payment_id uuid REFERENCES public.payments(id),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX voucher_redemptions_code_user_key ON public.voucher_redemptions (code_id, user_id);
CREATE UNIQUE INDEX voucher_redemptions_payment_key ON public.voucher_redemptions (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX voucher_redemptions_user_idx ON public.voucher_redemptions (user_id);

GRANT SELECT ON public.voucher_redemptions TO authenticated;
GRANT ALL ON public.voucher_redemptions TO service_role;
REVOKE ALL ON public.voucher_redemptions FROM anon;

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
ON public.voucher_redemptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all redemptions"
ON public.voucher_redemptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. ai_credit_grants
CREATE TABLE public.ai_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  source_code_id uuid REFERENCES public.voucher_codes(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX ai_credit_grants_user_expires_idx ON public.ai_credit_grants (user_id, expires_at);

GRANT SELECT ON public.ai_credit_grants TO authenticated;
GRANT ALL ON public.ai_credit_grants TO service_role;
REVOKE ALL ON public.ai_credit_grants FROM anon;

ALTER TABLE public.ai_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credit grants"
ON public.ai_credit_grants FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all credit grants"
ON public.ai_credit_grants FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. feature_usage.paid_by_credit
ALTER TABLE public.feature_usage ADD COLUMN IF NOT EXISTS paid_by_credit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.feature_usage.paid_by_credit IS 'Lượt này trả bằng quỹ credit tặng, không tính vào trần ngày của gói.
ĐỊNH NGHĨA "1 LƯỢT": đếm bằng COUNT(DISTINCT COALESCE(ref_id, id::text)) — GIỐNG HỆT check_feature_access.
Một phiên nhiều part cùng gradingSessionId = 1 lượt. Phiên Full Test chấm cả Writing lẫn Speaking
ghi 2 dòng (2 feature_key) nhưng cùng ref_id → vẫn là 1 lượt.
Nếu đổi cách đếm ở đây phải đổi cả trong check_feature_access, nếu không quỹ sẽ lệch tiền.';
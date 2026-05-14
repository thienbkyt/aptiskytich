## Tracking chi phí vận hành tự động

Mục tiêu: ngoài chi phí nhập tay (cố định như Lovable Pro, Supabase Pro), app sẽ tự đếm các khoản biến đổi (AI tokens, TTS chars, storage GB, edge invocations) và **ước lượng cost VND** dựa trên đơn giá admin tự cấu hình.

⚠️ Lưu ý: đây là **ước lượng dựa trên usage thực tế của app** — không phải hóa đơn từ Lovable. Số liệu sát nhưng có thể chênh ±10% so với billing thật vì không tính được overhead, free tier, network egress.

---

### 1. Cấu trúc dữ liệu mới

**Bảng `usage_events`** — log từng sự kiện sử dụng tài nguyên:
- service: `lovable_ai` | `gemini_direct` | `google_tts` | `supabase_storage` | `supabase_db` | `edge_function`
- event_type: `chat_completion` | `tts_synthesis` | `storage_snapshot` | `function_invocation`...
- model: tên model (vd `google/gemini-2.5-flash`) — nullable
- units: số lượng (tokens / chars / MB / calls)
- unit_type: `input_tokens` | `output_tokens` | `chars` | `mb_month` | `calls`
- estimated_cost_vnd: numeric — tính sẵn lúc insert
- source_function: tên edge function gọi (grade-exam, dictionary-lookup...)
- metadata: jsonb (user_id, request_id, latency...)
- created_at

RLS: chỉ admin xem. Edge function dùng service role để insert.

**Bảng `pricing_config`** — đơn giá admin tự sửa:
- service, model, unit_type
- price_per_unit (USD)
- usd_to_vnd_rate (default 25500)
- effective_from (date) — cho phép giữ history khi giá đổi
- is_active

Seed mặc định:
- `google/gemini-2.5-flash`: $0.075/1M input, $0.30/1M output
- `google/gemini-2.5-pro`: $1.25/1M input, $5.00/1M output
- Google TTS Standard: $4.00/1M chars
- Supabase Storage: $0.021/GB/tháng
- Supabase DB: $0.125/GB/tháng
- Edge function invocation: $2.00/1M calls

RLS: admin only.

---

### 2. Logging tự động trong edge functions

**Edit `grade-exam`, `dictionary-lookup`, `parse-exam`**:
Sau mỗi lần gọi Lovable AI Gateway, parse `usage` trong response (`prompt_tokens`, `completion_tokens`), gọi helper `logUsage()` insert vào `usage_events` với cost được tính từ `pricing_config`.

**Edit `tts` và `tts-bundle`**:
Log `service: google_tts`, `units: text.length`, `unit_type: chars`.

Helper chung `_shared/usage-logger.ts` — load pricing 1 lần, cache 5 phút trong memory edge function.

Fail-soft: nếu logging lỗi không làm hỏng request chính (try/catch silent).

**Đếm edge function invocation**: thay vì query analytics logs (tốn quota), tự increment trong helper — mỗi function log 1 dòng `function_invocation` ở đầu request.

---

### 3. Snapshot storage + DB hàng ngày

Edge function mới `snapshot-usage`:
- Query `pg_database_size('postgres')` → DB size MB
- Query `storage.objects` sum size theo bucket → storage MB
- Insert 2 dòng `usage_events` với `service: supabase_storage|supabase_db`, `units: MB`, cost = MB × giá GB-month / 30 / 1024

Không setup cron tự động (theo memory: no cron). Thay vào đó:
- Nút **"Cập nhật snapshot"** trên trang Admin Report → admin bấm khi cần
- Hoặc auto-trigger 1 lần/ngày khi admin mở trang (check last snapshot < 24h → skip)

---

### 4. UI Admin Report — tabs song song

Restructure trang `/admin/report` thành 3 tabs:

**Tab 1: "Chi phí nhập tay"** (giữ nguyên cost_records hiện tại — bảng + form + chart năm)

**Tab 2: "Chi phí ước lượng (tự động)"**
- Card tổng: tổng VND tháng / so sánh tháng trước
- Bảng breakdown theo service:
  - Lovable AI — X tokens — Y VND
  - Google TTS — X chars — Y VND
  - Storage — X GB-month — Y VND
  - Edge functions — X calls — Y VND
- Bar chart 12 tháng stacked theo service
- Nút "Cập nhật snapshot storage/DB"
- Top 10 ngày tốn nhất (table)

**Tab 3: "Tổng hợp"**
- Tổng cộng = nhập tay + ước lượng
- Pie chart phân bổ chi phí theo nguồn

**Trang con `/admin/report/pricing`** — admin sửa bảng đơn giá:
- List pricing_config rows với inline edit
- Nút "Thêm dòng giá mới"
- Hiển thị tỷ giá USD→VND có thể chỉnh

Link "Cấu hình đơn giá" trong header tab 2.

---

### 5. Routing & navbar

Không thay đổi route chính, thêm:
- `/admin/report` (đã có) — bổ sung tabs
- `/admin/report/pricing` — sub page

---

### Phạm vi không động vào

- Logic Import Center
- Bảng `cost_records` hiện có (giữ nguyên + dữ liệu seed)
- Các edge function logic chính (chỉ thêm vài dòng `logUsage()` ở cuối)

---

### Thứ tự thực hiện

1. Migration: `usage_events` + `pricing_config` + seed đơn giá
2. Helper `_shared/usage-logger.ts`
3. Patch `grade-exam`, `dictionary-lookup`, `parse-exam`, `tts`, `tts-bundle`
4. Edge function mới `snapshot-usage`
5. Restructure `AdminReport.tsx` thành tabs
6. Trang `AdminReportPricing.tsx`

Sau khi xong, chạy thử vài lần grade Speaking → kiểm tra `usage_events` có log đúng → xem chart hiển thị.

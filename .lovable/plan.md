

# Tắt hoàn toàn process-email-queue

## Vấn đề
`process-email-queue` đang được gọi liên tục qua pg_cron, tạo ra hàng loạt boot/shutdown cycles dù không có email nào cần gửi. Điều này tiêu tốn tài nguyên Cloud không cần thiết.

## Giải pháp

### Bước 1: Xóa pg_cron job
Chạy migration SQL để unschedule job `process-email-queue` khỏi pg_cron, ngừng hoàn toàn việc gọi Edge Function định kỳ.

```sql
SELECT cron.unschedule('process-email-queue');
```

### Bước 2: Xóa Edge Function
Xóa file `supabase/functions/process-email-queue/` và undeploy function để không còn tồn tại trên server.

## Lưu ý
- Auth emails (xác thực đăng ký, reset mật khẩu) vẫn hoạt động bình thường — chúng sẽ dùng template mặc định của hệ thống.
- Nếu sau này cần gửi email, có thể thiết lập lại bằng cách cấu hình email infrastructure.

## File thay đổi
- Xóa `supabase/functions/process-email-queue/index.ts`
- Xóa `supabase/functions/process-email-queue/deno.json`
- Cập nhật `supabase/config.toml` — xóa section `[functions.process-email-queue]`
- Migration SQL: unschedule cron job


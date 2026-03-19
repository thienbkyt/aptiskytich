

# Fix: Link đổi mật khẩu không bấm được trong Gmail

## Nguyên nhân

Email đặt lại mật khẩu mặc định chứa link dạng URL dài, Gmail có thể không hiển thị đúng dạng clickable. Cần tạo email template tùy chỉnh với nút HTML rõ ràng để Gmail luôn hiển thị đúng.

## Giải pháp

Tạo auth email templates tùy chỉnh với nút bấm HTML đẹp, tương thích Gmail.

### Bước 1: Scaffold auth email templates
- Tạo 6 template email (signup, recovery, magic-link, invite, email-change, reauthentication)
- Mỗi template có nút CTA rõ ràng bằng HTML `<a>` button — luôn clickable trên Gmail

### Bước 2: Áp dụng branding Aptis Kỳ Tích
- Dùng màu `#E11D1F` (primary) cho nút bấm
- Copy tiếng Việt phù hợp: "Đặt lại mật khẩu", "Xác nhận email"...
- Logo nếu có

### Bước 3: Deploy edge function `auth-email-hook`

### Lưu ý
- Domain email (`notify.www.aptiskytich.vn`) đang chờ DNS verification
- Templates có thể scaffold và deploy ngay, email sẽ gửi được khi DNS xác nhận xong
- Trong khi chờ, hệ thống vẫn gửi email mặc định


# Hoàn tất khôi phục email xác thực

## Trạng thái vừa kiểm tra

- `aptiskytich.vn` vẫn do iNET quản lý qua `laocai.vclouddns.com` và `sapa.vclouddns.com`.
- Website và bản ghi xác minh tên miền gốc đều đang hoạt động bình thường.
- `notify.aptiskytich.vn` đã được giao đúng cho `ns3.lovable.cloud` và `ns4.lovable.cloud`.
- Tên miền gửi email đã xác minh; hệ thống đang ở bước cuối: xác nhận đường gửi email sẵn sàng.

## Việc tiếp theo

1. Không đổi nhà đăng ký tên miền và không chuyển DNS sang Cloudflare.
2. Không chỉnh thêm bản ghi DNS lúc này để tránh làm gián đoạn quá trình xác nhận.
3. Chờ hệ thống hoàn tất xác nhận đường gửi, sau đó kiểm tra lại trạng thái một lần.
4. Gửi thử email đăng ký thật và kiểm tra cả kết quả gửi lẫn nhật ký email xác thực.
5. Nếu bước xác nhận vẫn treo quá thời gian DNS thông thường, chạy lại xác minh từ mục Email rồi kiểm tra lỗi cụ thể.

## Phương án dự phòng

Nếu iNET về sau thực sự không hỗ trợ bản ghi NS cho tên con, có hai hướng mà **không cần chuyển quyền sở hữu tên miền khỏi iNET**:

- Chuyển riêng nơi quản lý DNS sang một nhà cung cấp hỗ trợ NS cho tên con; iNET vẫn là nhà đăng ký.
- Tắt đường gửi email hiện tại và dùng dịch vụ email khác trên một tên con riêng với các bản ghi DNS mà iNET hỗ trợ.

Hiện chưa cần dùng phương án dự phòng vì việc giao quyền cho `notify` đã được hệ thống xác nhận thành công.

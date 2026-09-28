# Làm mới trang Giới thiệu bạn

## Phạm vi
- Chỉ chỉnh `src/pages/Referral.tsx`; giữ nguyên toàn bộ truy vấn, xử lý dữ liệu, yêu cầu rút tiền và hộp thoại hiện có.
- Bỏ phần chia sẻ không còn dùng và dọn các import tương ứng.

## Giao diện
- Gộp tiêu đề và mã giới thiệu thành khối nổi bật màu đỏ cam, có hai chỉ số quyền lợi và nút sao chép.
- Rút gọn thống kê còn số bạn đã mua và số tiền rút được.
- Đổi mức hoa hồng thành thanh bậc thang 4 mốc, giữ logic tiến độ và thêm ví dụ tiền thực nhận.
- Làm mới phần ba bước hoạt động, phần rút tiền, trạng thái trống lịch sử và điều khoản thu gọn.
- Giữ khung trang `max-w-3xl`, khoảng cách `space-y-5`, hỗ trợ giao diện sáng/tối và điện thoại.

## Kiểm tra
- Kiểm tra biên dịch sau thay đổi.
- Mở trang ở kích thước máy tính và điện thoại để xác nhận bố cục, trạng thái tải và các nút sao chép/rút tiền không bị chồng lấn.

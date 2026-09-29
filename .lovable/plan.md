# Tinh gọn nhận xét và phân tích Writing/Speaking

## Thay đổi giao diện Writing
- Tách feedback theo các nhãn hiện có, đưa “Gợi ý nâng cao” ra khối amber riêng bên dưới.
- Nếu feedback lặp lại một nhãn, chia nội dung thành hai nhóm và hiển thị bằng hai tab “Email thân mật” / “Email trang trọng”; nếu chỉ có một nhóm thì hiển thị trực tiếp.
- Đổi mỗi tiêu chí thành dòng gọn với viền trái theo màu hiện tại, tiêu đề và nội dung; không dùng các box lớn.
- Thêm liên kết “Xem n lỗi cụ thể ↓” dưới tiêu chí ngữ pháp/chính tả, tính theo `emailIndex` khi dữ liệu có chỉ số email, rồi cuộn đến danh sách lỗi.
- Danh sách lỗi mặc định chỉ hiện ba mục, có nút xem thêm/thu gọn và giữ nguyên giao diện từng lỗi.

## Tinh gọn phần phân tích
- Bỏ việc hiển thị “Nhóm lỗi” và “Hồ sơ từ vựng” trong cả Writing và Speaking, không xóa hai component nguồn.
- Thống kê bài chỉ còn Số câu, Số từ và Trung bình từ/câu theo lưới ba cột.

## Hướng dẫn phản hồi AI Writing
- Bổ sung cùng một quy tắc cho feedback Part 1 và Part 2–4: mục “Ngữ pháp & chính tả” nêu tổng lỗi, chọn 2–3 lỗi quan trọng theo dạng `X → Y`, rồi chỉ người học xem danh sách đầy đủ; nếu không lỗi thì khen ngắn.
- Không thay đổi rubric, band hay công thức điểm; không chạm Speaking.

## Kiểm tra
- Chạy kiểm tra TypeScript và `deno check` cho hàm chấm.
- Kiểm tra trạng thái build sau thay đổi; triển khai lại riêng hàm chấm nếu mọi kiểm tra đạt.

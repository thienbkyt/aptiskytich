# Vá màn hình trắng và tải vô hạn

## Phạm vi
- Chỉ chỉnh các file người dùng nêu.
- Không thay đổi cách chấm điểm, lưu bài, phân quyền hoặc dữ liệu.

## Thực hiện
1. Thêm màn hình dự phòng thống nhất cho bài thi: tiêu đề bài thi, thông báo rõ ràng, nút thoát và ghi nhận lỗi `blank_screen_guard`.
2. Full Test và Full Part tự bỏ qua kỹ năng/phần không có dữ liệu; lỗi tải đề hiển thị lỗi thay vì hoàn tất với 0 điểm.
3. Writing Marathon chặn chỉ số đề vượt phạm vi, xử lý danh sách rỗng, và cho phép thử lại khi tải lỗi.
4. Các trang xem lại bài luôn kết thúc trạng thái tải; dữ liệu hỏng hoặc đề đã gỡ sẽ có nút về Lịch sử.
5. Grammar và các màn tổng kết Reading/Listening có lối thoát khi câu hỏi/trang hiện tại không còn tồn tại.
6. Kiểm tra TypeScript, bản dựng và rà lại mọi `return null` toàn màn hình trong đúng phạm vi.

## Chi tiết kỹ thuật
- Dùng `logClientError("blank_screen_guard", new Error(componentName), { reason })` một lần cho mỗi trạng thái dự phòng.
- Giữ thứ tự hooks hợp lệ; fallback chỉ đặt sau các hooks cần thiết hoặc qua component con chuyên biệt.
- Các lỗi truy vấn được chuyển thành trạng thái lỗi hiển thị, không đổi dữ liệu hay kết quả bài thi.

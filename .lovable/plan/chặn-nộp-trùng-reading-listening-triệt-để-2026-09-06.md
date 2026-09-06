# Chặn nộp trùng Reading/Listening triệt để

## Thay đổi
- Xác minh đường part lẻ không truyền mã phiên, còn Full Part và Full Test giữ mã phiên ổn định; vì vậy lớp chặn hiện tại bị bỏ qua ở part lẻ.
- Đổi lớp chặn dữ liệu cho riêng Reading/Listening: tìm lần nộp gần nhất theo người học + đúng bộ đề, không phụ thuộc mã phiên; nếu dưới 5 phút thì cập nhật bản ghi cũ, quá 5 phút mới tạo bản ghi mới.
- Ghi log khi phát hiện lần nộp trùng, đồng thời giữ log cảnh báo nếu cập nhật bản ghi cũ thất bại.
- Ở cả hai màn Reading và Listening, giữ khóa sau khi nộp thành công; chỉ mở lại khi thao tác nộp báo lỗi hoặc người học bấm “Làm lại”.

## Kiểm tra
- Kiểm tra kiểu và trạng thái build.
- Rà lại cả part lẻ, Full Part và Full Test để bảo đảm đều đi qua cùng lớp chặn.

## Phạm vi
- Không thay đổi Writing, Speaking, Grammar.
- Không tạo migration và không xóa dữ liệu cũ.

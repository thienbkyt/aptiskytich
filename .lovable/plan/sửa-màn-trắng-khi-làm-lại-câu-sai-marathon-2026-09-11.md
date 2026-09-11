# Sửa màn trắng khi làm lại câu sai Marathon

## Thay đổi
- Trong trang Listening và Reading, coi `retryWrongSetIds` là danh sách duy nhất khi chạy lại câu sai; không áp dụng bộ lọc key hoặc nhãn ưu tiên.
- Tải trực tiếp các đề publish bị thiếu khỏi danh sách thường, gồm đề clone, rồi ghép đúng thứ tự và loại trùng.
- Không truyền `priorityLabel` khi người học bấm “Làm lại câu sai”.
- Với Part 1, chỉ giữ các đề còn ít nhất một câu sai hợp lệ sau khi lọc theo mã câu.
- Trong cả hai Marathon engine, thay trạng thái rỗng bằng màn hình có tiêu đề bài thi, thông báo danh sách đã thay đổi và nút Thoát.
- Ghi `marathon_empty_sets` kèm kỹ năng, part, trạng thái retry và số đề mỗi khi hiện màn hình rỗng.

## Kiểm tra
- Kiểm tra kiểu TypeScript và trạng thái build.
- Xác nhận luồng thường vẫn giữ nguyên bộ lọc key/ưu tiên; luồng retry dùng đúng danh sách đề sai, kể cả đề clone.

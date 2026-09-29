# Kế hoạch sửa hiển thị lỗi Speaking

## Phạm vi
Chỉ sửa 4 file giao diện Speaking được yêu cầu; không thay đổi backend, dữ liệu hoặc cách chấm điểm.

## Thực hiện
1. **Hồ sơ kết quả Speaking**
   - Mở rộng dữ liệu từng câu để nhận lỗi ngữ pháp và từ phát âm.
   - Gạch chân lỗi trực tiếp trong transcript khi có dữ liệu; giữ cách hiển thị cũ khi không có lỗi.
   - Hiển thị một khối luyện phát âm và một khối xu hướng lỗi sau toàn bộ câu, trước bài mẫu dùng chung.

2. **Kết quả ngay sau khi thi**
   - Truyền hai trường lỗi mới từ kết quả chấm vào hồ sơ Speaking.
   - Xóa khối phân tích Speaking bị lặp ở màn tổng kết từng phần.

3. **Xem lại trong lịch sử**
   - Đọc thêm câu hỏi từ các dòng chấm và giữ thứ tự theo `item_index`.
   - Ưu tiên dữ liệu V2; nếu thiếu danh sách câu thì dựng lại từ các dòng chấm đã lưu.
   - Hợp nhất an toàn câu hỏi, transcript, bản sửa, lỗi ngữ pháp và lỗi phát âm từ nguồn V2, dòng chấm, rồi mới đến dữ liệu đề.
   - Với kết quả V2 hiển thị cả Part trên một trang để nút Trước/Sau chuyển đúng sang Part khác.

4. **Điểm CEFR ở mục lục lịch sử**
   - Đọc thêm CEFR từ kết quả Speaking.
   - Writing/Speaking không dùng `review_snapshot.band`; Speaking chỉ hiện CEFR thật đầu tiên, thiếu thì để trống.

## Kiểm tra
- Chạy kiểm tra TypeScript tự động.
- Kiểm tra lỗi build mới nhất và xác nhận các trường lỗi không làm màn cũ bị crash khi dữ liệu thiếu.

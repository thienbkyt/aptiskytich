# Thống nhất phần nhận xét Writing

## Thực hiện
- Tách toàn bộ phần nhận xét AI hiện có trong màn xem lại thành `WritingGradingReview`, nhận một kết quả chấm Writing.
- Dùng lại component này tại đúng vị trí cũ trong màn xem lại và ngay dưới ô điểm của màn kết quả sau chấm.
- Khi poll kết quả chấm, lấy thêm bài viết cải thiện và mẹo nâng điểm nếu dữ liệu có sẵn.
- Giữ nguyên khối đề bài/bài làm/bài tham khảo, chỉ đổi nhãn bài tham khảo để phân biệt rõ.

## Phạm vi
- Chỉ sửa `WritingExamEngine.tsx`, `WritingResults.tsx` và tạo `WritingGradingReview.tsx`.
- Không thay đổi logic chấm điểm hay dữ liệu.

## Kiểm tra
- Chạy typecheck và kiểm tra build preview không còn lỗi.

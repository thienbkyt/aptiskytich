## Mục tiêu

Tự động ghép các bộ đề hiện có theo prefix tên (ví dụ `Đề 01`, `Đề 02`...) thành Full Part cho từng kỹ năng, để chúng hiện ra ở tab "Full Part" của từng trang luyện kỹ năng (Speaking/Listening/Reading/Writing/Grammar & Vocabulary).

Ví dụ Speaking:
- `Đề 01 - Speaking - Speaking Part 1` + `... Part 2` + `... Part 3` + `... Part 4` → gộp thành Full Part tên **Đề 01**.
- Tương tự cho Grammar & Vocabulary (6 parts), Listening (4), Reading (4), Writing (4).

## Cách hoạt động

Thêm nút **"Tự động ghép theo tên đề"** trong tab `Ghép Full Part` (Admin → Import Center → Ghép & Quản lý → Ghép Full Part).

Khi bấm nút:

1. Lấy toàn bộ `exam_sets` của kỹ năng đang chọn (theo dropdown Kỹ năng có sẵn).
2. Với mỗi bộ đề, trích prefix từ `title` bằng regex `^Đề\s*(\d+)` → ví dụ `Đề 01`, `Đề 02`.
3. Bỏ qua bộ đề không match prefix hoặc đã có `full_test_id`.
4. Nhóm các bộ đề theo prefix. Chỉ ghép nhóm có **≥ 2 parts khác nhau** (đủ điều kiện Full Part).
5. Với mỗi nhóm:
   - Nếu đã tồn tại 1 `full_test_id` cho cùng prefix ở kỹ năng khác (ví dụ `Đề 01` của Listening đã có full_test_id) → **tái sử dụng** cùng UUID đó, để giữ liên kết Full Test 5 kỹ năng.
   - Nếu chưa có → tạo `full_test_id` mới.
   - Đặt `full_test_title = "Đề <NN>"` (ví dụ `Đề 01`).
   - UPDATE `exam_sets` set `full_test_id` + `full_test_title` cho tất cả bộ đề trong nhóm.
6. Hiển thị toast: `✓ Đã ghép N nhóm cho [kỹ năng] (M bộ đề)`.
7. Refresh danh sách hiển thị bên dưới.

Có dialog xác nhận trước khi chạy để tránh nhấn nhầm, kèm preview số nhóm sẽ ghép.

Tùy chọn thêm: checkbox **"Ghép cho tất cả 5 kỹ năng"** để chạy 1 lần cho mọi skill thay vì chỉ skill đang chọn.

## File thay đổi

- `src/components/admin/merge/MergeFullPart.tsx`: thêm nút + handler `handleAutoMerge`, dialog xác nhận, logic group-by-prefix và reuse full_test_id.

Không thay đổi schema DB, không thay đổi flow hiển thị Full Part ở phía user — vì `useSkillFullSets` đã đọc theo `full_test_id` sẵn.

## Câu cần xác nhận

1. Title prefix mặc định là `Đề <số>` (1-2 chữ số). OK chứ, hay cần regex khác?
2. Có muốn nút **"Ghép cho tất cả 5 kỹ năng"** trong 1 lần bấm không, hay chỉ ghép theo kỹ năng đang chọn?

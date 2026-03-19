

# Nâng cấp hệ thống quản lý đề thi & câu hỏi

## Hiện trạng

- Database có bảng `tests` (skill, part, title, time_limit) và `questions` (test_id, question_text, options, correct_answer, ...) nhưng gần như trống (1 test, 0 câu hỏi).
- Trang Admin hiện chỉ quản lý **câu hỏi rời** (không gắn vào bộ đề test nào).
- Bulk Import hiện chỉ nhập câu hỏi đơn lẻ, không hỗ trợ tạo test + gắn câu hỏi vào test.

## Mục tiêu

Cho phép admin **tạo/sửa/xóa bộ đề (tests)** và **gắn câu hỏi vào từng bộ đề**, qua cả giao diện thủ công và import Excel.

## Kế hoạch triển khai

### 1. Nâng cấp trang Admin — Quản lý bộ đề (Tests CRUD)

Thêm một section mới trên trang Admin để quản lý bộ đề:

- **Danh sách tests**: Hiển thị tất cả bộ đề, lọc theo skill/part
- **Tạo test mới**: Form nhập skill, part, title, time_limit
- **Sửa/Xóa test**: Inline edit và delete
- **Xem câu hỏi trong test**: Click vào test → hiển thị danh sách câu hỏi thuộc test đó
- **Thêm/sửa/xóa câu hỏi trong test**: Form câu hỏi gắn `test_id`, hỗ trợ `order_index` để sắp xếp thứ tự

Giao diện chia 2 panel hoặc 2 tab: **"Quản lý bộ đề"** và **"Quản lý câu hỏi"**.

### 2. Nâng cấp Bulk Import — Import theo bộ đề

Cập nhật template Excel và logic import:

- **Template mới** có thêm cột: `test_title`, `skill`, `part`, `order_index`
- Logic import:
  1. Nhóm rows theo `test_title + skill + part`
  2. Tạo test (hoặc tìm test đã tồn tại) cho mỗi nhóm
  3. Insert câu hỏi với `test_id` tương ứng
- Hỗ trợ **update**: Nếu test đã tồn tại (cùng skill + part + title), có tùy chọn ghi đè hoặc bỏ qua

### 3. Kết nối trang luyện tập với dữ liệu thật

Cập nhật các trang Speaking, Writing, Listening, Reading, Grammar để:

- Fetch danh sách tests từ database thay vì dùng dữ liệu tĩnh
- Card hiển thị số câu hỏi thực tế từ DB
- Nút "Luyện tập" navigate tới route làm bài với `test_id`

## Chi tiết kỹ thuật

### Files cần tạo/sửa

| File | Thay đổi |
|------|----------|
| `src/pages/Admin.tsx` | Thêm tab "Quản lý bộ đề", form CRUD test, hiển thị câu hỏi theo test |
| `src/components/admin/BulkImport.tsx` | Cập nhật template + logic import theo bộ đề |
| `src/components/admin/TestManager.tsx` | **Mới** — Component quản lý tests |
| `src/components/admin/QuestionManager.tsx` | **Mới** — Component quản lý câu hỏi trong 1 test |
| `src/pages/Speaking.tsx`, `Writing.tsx`, `Listening.tsx`, `Reading.tsx`, `GrammarVocabulary.tsx` | Fetch tests từ DB, hiển thị số câu hỏi thực |

### Database

Không cần thay đổi schema — bảng `tests` và `questions` (với `test_id`) đã đủ. Chỉ cần đảm bảo khi import/tạo câu hỏi thì gắn đúng `test_id`.

### Luồng hoạt động

```text
Admin tạo bộ đề:
  1. Chọn skill (reading/listening/...)
  2. Chọn part (Part 1/Part 2/...)
  3. Nhập title (Test 1, Test 2...)
  4. Thêm câu hỏi vào bộ đề (thủ công hoặc import Excel)

Import Excel:
  1. Download template mới (có cột test_title, skill, part)
  2. Điền dữ liệu
  3. Upload → Preview → Confirm
  4. Hệ thống tự tạo tests + gắn questions
```


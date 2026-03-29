

# Sửa format Import Vocabulary theo đề thi Aptis thực tế

## Vấn đề

Template hiện tại dùng **1 sheet `Core_Vocab`** với format MCQ đơn giản (option_a/b/c/d), không đúng với format thực tế của bài thi Aptis. Bài thi thực tế có **5 phần Vocabulary** riêng biệt, mỗi phần có dạng bài khác nhau với **11 lựa chọn (A-K)**.

## Format chuẩn Aptis Vocabulary (25 câu – 13 phút)

```text
Part 01 (Q1-5):   Word Synonym Matching    — Nối từ đồng nghĩa (11 options A-K)
Part 02 (Q6-10):  Sentence Definition      — Hoàn thành câu định nghĩa (11 options A-K)  
Part 03 (Q11-15): Definition Matching       — Nối định nghĩa với từ (11 options A-K)
Part 04 (Q16-20): Gap Fill                  — Điền từ vào câu (11 options A-K)
Part 05 (Q21-25): Collocation               — Nối từ kết hợp phổ biến (11 options A-K)
```

Điểm chung: Mỗi part có **5 câu hỏi** + **11 từ lựa chọn (A-K)**, chỉ dùng **6 từ**, còn **5 từ thừa**.

## Giải pháp

### 1. Cập nhật types — thêm 5 sheet mapping cho Vocab

Thay `Core_Vocab` (1 sheet) bằng 5 sheet: `V_Part1` → `V_Part5`, mỗi sheet map đến skill `grammar_vocab` với part tương ứng.

### 2. Cập nhật Excel template — 5 sheets mới đúng format

Mỗi sheet có cấu trúc:
- `word` / `sentence` / `definition` — nội dung câu hỏi (tùy dạng bài)
- `option_A` → `option_K` — 11 từ lựa chọn
- `correct_answer` — đáp án đúng (A-K)
- `explanation` — giải thích

### 3. Viết parser mới cho từng dạng Vocab

Mỗi parser đọc 5 câu + 11 options, lưu vào `extra_data` với format phù hợp cho engine hiển thị (danh sách options A-K, correct letter, question type).

### File thay đổi

1. **`src/components/admin/import/types.ts`** — Thay `Core_Vocab` bằng `V_Part1`–`V_Part5` trong `FULL_EXAM_SHEETS`
2. **`src/components/admin/import/ExcelImport.tsx`** — Thay template sheet `Core_Vocab` bằng 5 sheets mới với sample data đúng format
3. **`src/components/admin/import/excelParsers.ts`** — Thay `parseCoreVocab` bằng 5 parser mới + cập nhật `parseSheet` switch


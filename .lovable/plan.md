## Vấn đề

Trong panel "Đáp án & Giải thích" của Reading Part 1 (gap-fill), đoạn văn đang hiển thị nguyên `{1}`, `{2}`, `{3}`… vì `ReviewAnswerPanel.tsx` chỉ in thô `question_text` từ DB. Đồng thời ô "Đáp án của bạn" chỉ hiện chuỗi JSON nên fallback ra "Đã trả lời (xem trên bài thi ở trên)".

Dữ liệu thật trong DB:
- `question_text`: đoạn văn nhiều dòng có `{1}…{5}`
- `extra_data.gaps`: `[{options: string[], correct: number}, …]` — gap 0 là "done for you" (options rỗng)
- `user_answer`: `{"partType":"part1","answers":[null, idx, idx, …]}`
- Một câu Part 1 = 1 row `exam_questions` duy nhất, `question_type = "gap_fill"`

## Mục tiêu

Render lại đoạn văn trong panel review, thay `{n}` bằng **từ đáp án đúng được highlight**. Nếu user chọn sai, hiện kèm từ user đã chọn bị gạch ngang màu đỏ. Nếu bỏ trống thì hiện "—" mờ.

## Phạm vi

- Reading **Part 1** (gap_fill, `{n}` trong `question_text`, `extra_data.gaps`).
- Áp dụng cùng renderer cho bất kỳ câu nào có pattern `{n}` + `extra_data.gaps` (phòng khi Part 3/4 cùng shape).
- KHÔNG động vào engine làm bài, không đổi data, không đổi cách chấm điểm.
- Các skill khác (Listening / Grammar / Writing / Speaking) giữ nguyên — panel hiện tại của họ đã ổn.

## Thay đổi

### 1. `HistoryReviewPager.tsx`
- Khi query `exam_questions` cho panel, thêm cột `extra_data` vào `.select(...)`.
- Truyền `extra_data` xuống `ReviewAnswerPanel` qua type `ReviewQuestion`.

### 2. `ReviewAnswerPanel.tsx`
- Mở rộng type `ReviewQuestion`: thêm `extra_data?: any`.
- Helper mới `parseUserAnswers(raw)`:
  - Nếu raw parse được JSON dạng `{partType, answers: number[]}` → trả về mảng `answers`.
  - Nếu là số đơn → trả mảng 1 phần tử.
  - Ngược lại → `null`.
- Helper `isGapFillQuestion(q)`: `q.extra_data?.gaps` là mảng và `question_text` chứa `/\{\d+\}/`.
- Render nhánh **gap-fill**:
  - Split `question_text` theo `/\{(\d+)\}/`.
  - Với mỗi gap index `n`:
    - `gap = extra_data.gaps[n]`
    - `userPick = parsedAnswers?.[n]`
    - `correctText = gap.options[gap.correct]` (gap 0 có options rỗng → bỏ qua, render `{1}` gốc hoặc skip).
    - Trạng thái:
      - Gap "done for you" (options rỗng) → hiện literal hoặc bỏ.
      - User đúng → chip xanh: `correctText` (✓).
      - User sai → chip đỏ với `userText` gạch ngang + chip xanh `correctText` ngay sau.
      - User bỏ trống → chip xanh `correctText` + nhãn nhỏ "(bỏ trống)".
  - Mỗi dòng của passage là 1 `<p>` để giữ ngắt dòng đẹp.
- Khối tóm tắt (Đúng/Sai/Bỏ trống) cho **gap-fill** tính trên từng gap (bỏ gap "done for you"), không phải trên row câu hỏi.
- Ẩn hoàn toàn 2 box "Đáp án của bạn / Đáp án đúng" mặc định cho row gap-fill (đã thể hiện inline trong passage).
- Khối "Giải thích" giữ nguyên — chỉ hiện nếu `explanation` non-empty.
- Các loại câu khác (MCQ thường) giữ nguyên render hiện tại.

### 3. Style chip inline (Tailwind, dùng token sẵn có)
- Chip đúng: `inline-flex items-center rounded px-1.5 py-0.5 text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200`.
- Chip sai (user pick): cùng layout, `bg-destructive/10 text-destructive border-destructive/20 line-through`.
- Chip blank hint: `text-[10px] text-muted-foreground ml-1`.

## Không làm trong bước này

- Không refactor Part 2 (drag-order), Part 3 (matching), Part 4 (heading dropdowns) — sẽ làm sau nếu user thấy cần.
- Không đổi UI engine làm bài.
- Không đổi flow Pager hay logic chấm.

## File chạm

- Sửa: `src/components/history/ReviewAnswerPanel.tsx`
- Sửa: `src/components/history/HistoryReviewPager.tsx` (thêm `extra_data` vào select + truyền prop)
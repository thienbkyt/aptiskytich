
# Tối ưu UX luồng "Xem lại bài đã làm"

Phạm vi: chỉ sau khi nộp (HistoryDetail, HistoryReviewPager, các Engine ở `reviewMode`). Không đụng UI làm bài thật, không đụng phối màu, không đụng logic chấm điểm.

Đã xác nhận:
- Layout 1 part = 1 trang scroll dọc (không click-through từng câu).
- Explanation: **70% có, 30% rỗng** → ẩn block "Giải thích" khi rỗng, chỉ hiện block "Đáp án đúng".
- Speaking review: chỉ band tổng + nhận xét ngắn (CEFR breakdown để Step 5 sau).

---

## 1. Vấn đề hiện tại

1. **2 thanh nav đè nhau**: Pager bar (sticky top tím) + BottomNavBar nội bộ của engine (fixed bottom) cùng có Previous/Next → user dễ bấm nhầm.
2. **Vẫn render timer + nút Submit** trong `reviewMode` (Reading/Listening/Grammar) — thừa và gây hiểu nhầm.
3. **Không hiện đáp án đúng + giải thích ngay tại câu** — `exam_questions.explanation` đã có nhưng không truyền vào engine; user phải scroll xuống danh sách rời ở dưới.
4. **HistoryDetail summary**: nút "Làm lại" và "Xem lại" cùng cấp; bảng "Các lần làm" không click được.
5. **Speaking review**: ghi âm render trùng (cả trong nhánh `reviewing` của HistoryDetail lẫn SpeakingReviewPage).
6. **Micro**: 2 thanh tím chồng top, không có transition khi đổi page, không có phím tắt ←/→.

---

## 2. Giải pháp

### A. Thống nhất nav trong review
- Thêm prop `reviewMode` cho `BottomNavBar` → khi true: ẩn nút Submit, ẩn Previous/Next câu (chỉ giữ Question List + Info + Accessibility + Thoát).
- `HistoryReviewPager` là nơi DUY NHẤT có Prev/Next giữa các part.
- Render hết câu trong 1 part trên 1 trang dài (bỏ `currentIndex` loop khi reviewMode trong Reading Part 1/3/4, Listening, Grammar). Writing đã 1 trang.

### B. ReviewAnswerPanel (component dùng chung)
Tạo `src/components/history/ReviewAnswerPanel.tsx`. Gắn dưới mỗi câu/clip:
- Chip ✓/✗ + "Đáp án của bạn: X" + "Đáp án đúng: Y".
- Block "Giải thích" — **chỉ render khi có `explanation` không rỗng** (xử lý 30% null).
- Style nhẹ: bg `muted/40`, border-left primary 3px, padding 12px.

### C. Truyền explanation vào engine
- `HistoryReviewPager` fetch thêm `exam_questions.explanation` cùng lúc với qResults → build `explanationMap: Record<questionId, string>`.
- Truyền `explanationMap` xuống `HistoryReviewRenderer` → từng engine → render `ReviewAnswerPanel`.

### D. Ẩn nhiễu khi reviewMode
Trong mỗi engine khi `reviewMode=true`:
- Ẩn `TimerDisplay` (thay bằng badge "Đã nộp · {ngày}").
- Không gọi `handleSubmit` cho nút Next câu cuối.
- ExamHeader: ẩn nút "Thoát", chỉ giữ "Quay lại kết quả".

### E. HistoryDetail summary
- `Làm lại` = primary đỏ; `Xem lại từng câu` = outline secondary → phân cấp rõ.
- Thêm 3 chip dưới điểm số: **Đúng X · Sai Y · Bỏ trống Z**.
- Bảng "Các lần làm bộ đề này" → mỗi dòng wrap `<Link to="/history/{id}">`, hover bg muted.
- **Xoá** block per-question list cũ ở dưới (đã thay bằng panel trong engine).
- **Xoá** block render recordings trùng ở nhánh `reviewing` (SpeakingReviewPage đã xử lý).

### F. SpeakingReviewPage — thêm grading ngắn
- Query `exam_gradings` cho exam_set + user + cùng cửa sổ 2h.
- Trên cùng: card "Band tổng: B2" + 2-3 dòng nhận xét rút gọn (`overall_feedback` cắt 200 ký tự).
- Audio list giữ nguyên.

### G. Micro-UX
- Pager bar đổi từ nền tím `#24085a` → `bg-background border-b border-border` với chữ tím (tránh 2 thanh tím chồng).
- Thêm fade 150ms khi đổi page.
- Hook `useReviewKeyboard`: ←/→ chuyển part, Esc thoát.
- Scroll-to-top smooth thay vì instant.

---

## 3. Files

### Tạo mới
- `src/components/history/ReviewAnswerPanel.tsx`
- `src/hooks/useReviewKeyboard.ts`

### Sửa
- `src/components/history/HistoryReviewPager.tsx` — bar mới, fetch explanation, transition, keyboard.
- `src/components/history/HistoryReviewRenderer.tsx` — nhận + forward `explanationMap`.
- `src/components/history/SpeakingReviewPage.tsx` — thêm grading card.
- `src/components/reading/BottomNavBar.tsx` — prop `reviewMode` (ẩn nav câu + Submit).
- `src/components/exam/ExamHeader.tsx` — prop `reviewMode` (ẩn Thoát).
- `src/components/reading/ReadingExamEngine.tsx` — `reviewMode` render all-in-one + ReviewAnswerPanel.
- `src/components/listening/ListeningExamEngine.tsx` — tương tự.
- `src/components/grammar/GrammarExamEngine.tsx` — tương tự.
- `src/components/writing/WritingExamEngine.tsx` — gắn ReviewAnswerPanel (1 panel/part).
- `src/pages/HistoryDetail.tsx` — phân cấp nút, chip Đ/S/Bỏ trống, bảng clickable, xoá block trùng.

### KHÔNG đụng
- Phối màu thi gốc, logic chấm, DB schema, các Engine ngoài reviewMode, FullTestEngine khi đang thi.

---

## 4. Thứ tự build (chạy từng bước, test ở `/history/:id` trước khi qua bước sau)

1. `ReviewAnswerPanel` + fetch explanationMap.
2. Reading Engine: render all-in-one + gắn panel + ẩn timer/submit.
3. Listening Engine: tương tự (chú ý audio player vẫn play được).
4. Grammar + Writing Engine: tương tự.
5. Pager bar mới (style, transition, keyboard).
6. HistoryDetail summary cleanup.
7. SpeakingReviewPage grading card.

---

## 5. Rủi ro & lưu ý

- **Reading Part 2** dùng drag-and-drop sentence → ở review mode chỉ cần render kết quả tĩnh, không cần DnD active. Sẽ check `submitted=true` để disable DnD.
- **Listening audio**: trong review mode bỏ giới hạn 2 lần play (user cần nghe lại tự do).
- **Grammar 50 câu**: render 1 trang dài có thể nặng → dùng `content-visibility: auto` cho từng câu để giảm tải scroll.
- **Writing Part 4** (2 emails) — panel sẽ render 2 lần (informal + formal), mỗi block có sample answer riêng.

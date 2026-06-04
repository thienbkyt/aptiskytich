## Mục tiêu

Bổ sung phần review chi tiết (câu hỏi, đáp án user chọn, đáp án đúng, giải thích, audio) vào tất cả màn hình kết quả hiện có. Không tạo trang mới — mở rộng trực tiếp trên các component đã có.

## Phạm vi từng bước

### Bước 1 — Grammar
- Verify `GrammarResults.tsx` đã render review (đã có sẵn) và `GrammarExamEngine` truyền đủ `questions[]` + `userAnswers[]`.
- Không thay đổi UI, chỉ đảm bảo prop chain đúng.

### Bước 2 — Reading
- Thêm component con `ReadingReview` trong `ReadingResults.tsx` xử lý 4 part:
  - Part 1 (gap fill): render text với từng ô điền được tô xanh (đúng) / đỏ (sai) + đáp án đúng dưới mỗi ô sai.
  - Part 2 (cohesion/ordering): hiển thị thứ tự user vs đúng.
  - Part 3 (opinion matching): bảng 2 cột — câu | người được ghép (user/đúng).
  - Part 4 (long reading MCQ): list câu + option chọn (đỏ nếu sai) + option đúng (xanh) + giải thích.
- Cập nhật `ReadingExamEngine` truyền `questions`, `userAnswers`, `partType` xuống `ReadingResults`.

### Bước 3 — Listening
- Thêm review list trong `ListeningResults.tsx`: mỗi câu hiển thị mini audio player (nếu có `audio_url`), câu hỏi, đáp án user (đỏ sai/xanh đúng), đáp án đúng, giải thích.
- Cập nhật `ListeningExamEngine` truyền đủ data.

### Bước 4 — Writing
- Trong `WritingResults.tsx`, thêm block phía trên phần AI grading: render lại từng đề (prompt) + bài viết user nộp (dạng card có scroll khi dài).
- Cập nhật `WritingExamEngine` truyền `parts[]` (prompt + submission text).

### Bước 5 — Speaking
- Trong `SpeakingResults.tsx`, thêm list bên dưới AI grading: từng câu hỏi (text + part label) + audio player phát file recording (signed URL từ bucket `speaking-recordings` qua helper hiện có).
- Cập nhật `SpeakingExamEngine` truyền `prompts[]` + `recordings[]` (blob URL local hoặc storage path).

### Bước 6 — Full Test
- Trong `FullTestEngine` màn finish: 
  - Đầu trang: grid 5 card tóm tắt (Speaking/Listening/Grammar/Reading/Writing) — score + level + anchor link `#skill-xxx`.
  - Dưới: 5 section liên tiếp theo thứ tự Speaking → Listening → Grammar → Reading → Writing. Mỗi section reuse đúng component review của từng kỹ năng (compact mode, ẩn nút action).
  - Smooth scroll khi click card.

### Bước 7 — Lịch sử
- Thêm util `loadHistoricalResult(testResultId)` trong `src/lib/testResults.ts`: fetch `test_results` + `exam_question_results` + `exam_questions` để dựng lại dataset review.
- `HistoryDetail.tsx` (hoặc nút "Xem lại" trong `History.tsx`): mount đúng component result tương ứng với skill, truyền prop `mode="history"` để ẩn nút "Làm lại ngay", chỉ giữ nút "Quay lại".
- Tất cả result component nhận thêm prop optional `mode?: "fresh" | "history"` (default "fresh").

## Lưu ý kỹ thuật

- Tóm tắt điểm giữ nguyên ở trên, phần review nằm dưới — scroll bình thường.
- Dùng semantic tokens: `bg-green-500/10 text-green-600`, `bg-red-500/10 text-red-600`, `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground`.
- Responsive: grid `grid-cols-1 md:grid-cols-2` cho card kỹ năng, full-test card grid `grid-cols-2 md:grid-cols-5`.
- Toàn bộ label tiếng Việt.
- Speaking recordings: nếu là blob URL local (vừa nộp) → dùng trực tiếp; nếu storage path (từ history) → resolve qua signed URL bucket `speaking-recordings`.
- Writing/Speaking từ history: nội dung bài viết và recording URL hiện chưa được lưu vào `exam_question_results`. Sẽ lưu thêm vào `user_answer` field (text/JSON) khi submit để có thể replay từ history. Audio recording sẽ resolve từ bảng `speaking_recordings` đã có.

## Phạm vi không bao gồm

- Không tạo route mới, không sửa schema database (dùng cột `user_answer` hiện có).
- Không đổi logic chấm điểm.
- Không thay đổi visual identity / màu sắc theme.

Bạn xác nhận để mình bắt đầu triển khai cả 7 bước nhé?
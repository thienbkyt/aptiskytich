Mục tiêu

1. Mọi bài thi (Grammar / Reading / Listening / Writing / Speaking) đều lưu chi tiết từng câu vào `exam_question_results` để xem lại sau.
2. Trang `/history/:id` có thêm nút "Xem lại từng câu" → render lại UI làm bài (submitted=true) với câu trả lời đã lưu.

---

## Phần 1 — Lưu kết quả vào tất cả engine

### 1.1 Grammar

- Đã có sẵn `onComplete(correct, total, perQuestion)` + `SkillFullPracticeEngine` đã gọi `saveExamResult` kèm `perQuestion`. **Không cần đổi.**

### 1.2 Reading

- Mở rộng `ReadingExamEngine.onComplete` thành `(correct, total, perQuestion)`.
- Trong `handleSubmit`, build `perQuestion` theo từng part:
  - Part 1 (gap fill): 1 DB question → nhiều gaps. Lưu 1 row với `user_answer = JSON.stringify(p1Answers)`, `is_correct = tất cả đúng`. Dùng `part1Question.id` (cần thêm `id` vào type — đã có ở transformer).
  - Part 2: tương tự, 1 row tổng hợp cho cả part2Question.
  - Part 3: 1 row gộp toàn bộ statements.
  - Part 4: 1 row gộp toàn bộ.
  - Lưu ý: cấu trúc reading được transform mất 1:1 với từng exam_question DB row, nên dùng cách "1 row tổng cho cả part" + lưu mảng đáp án trong `user_answer` (JSON string). Trang HistoryDetail sẽ parse lại JSON.
- Cập nhật `Reading.tsx` và `SkillFullPracticeEngine` để forward `perQuestion`.

### 1.3 Listening

- Tương tự Reading: mở rộng signature, build `perQuestion` từ `answers` state, push lên wrapper.
- Listening dễ hơn vì mỗi câu hỏi có DB id 1:1 (qua transformer).

### 1.4 Writing

- Mở rộng `onComplete` thành `(perQuestion)` — không có đúng/sai.
- Mỗi part: 1 row với `user_answer = bài viết của user`, `is_correct = false`, dùng DB id của câu hỏi đầu tiên trong part.
- `Writing.tsx` forward lên `saveExamResult`.

### 1.5 Speaking

- Đã có `saveSpeakingRecording` từng câu. Thêm `saveExamResult` với `perQuestion` ghi `user_answer = "(recorded)"` để có row để hiện trong HistoryDetail.
- Wrapper `Speaking.tsx` thêm import + gọi `saveExamResult` từ onComplete.

### 1.6 FullTestEngine

- Forward `perQuestion` lên từng `saveExamResult` call cho phần con.

---

## Phần 2 — "Xem lại từng câu" ở HistoryDetail

### 2.1 Thêm nút

- Bên cạnh "Làm lại": nút "👁 Xem lại từng câu" với style outline đỏ (`border-primary text-primary`), giống nút trong `/history`.
- Hiển thị khi có `questions.length > 0` (Grammar/Reading/Listening/Writing) hoặc recordings (Speaking).

### 2.2 Chế độ review

Khi click:

- State `mode = "review"` trong HistoryDetail.
- Fetch `exam_questions` theo `exam_set_id` (đã fetch sẵn).
- Dựa vào `setInfo.skill` + `setInfo.part`, dùng transformer `examTransformers.ts` (đã có) chuyển DB rows → cấu trúc engine cần.
- Render đúng engine với props:
  - `submitted={true}` (cần thêm prop `initialSubmitted` + `initialAnswers` vào mỗi engine, HOẶC tạo wrapper `ReviewMode` riêng).
  - **Phương án nhẹ hơn**: dùng lại engine với `skipIntro`, set state qua prop mới `initialAnswers` + `initialPhase="review"`.
- Trong header (`ExamHeader`), nút "Thoát" được thay bằng "← Quay lại lịch sử" qua prop mới (hoặc tận dụng `onBackToResults` đã có → đổi label sang "Quay lại lịch sử").

### 2.3 Speaking review

- Speaking đã có sẵn UI list recordings trong HistoryDetail → giữ nguyên, không cần render lại engine.
- Nút "Xem lại từng câu" cho speaking sẽ scroll xuống phần recordings (hoặc ẩn nút này cho speaking).

---

## Files sẽ chạm

**Engines (5):**

- `src/components/grammar/GrammarExamEngine.tsx` — thêm props `initialAnswers`, `initialPhase`
- `src/components/reading/ReadingExamEngine.tsx` — mở rộng `onComplete`, thêm initial state props
- `src/components/listening/ListeningExamEngine.tsx` — tương tự
- `src/components/writing/WritingExamEngine.tsx` — mở rộng `onComplete`, initial state
- `src/components/speaking/SpeakingExamEngine.tsx` — thêm `saveExamResult` call

**Wrappers (5):**

- `src/pages/Reading.tsx`, `Listening.tsx`, `Writing.tsx`, `Speaking.tsx`
- `src/components/practice/SkillFullPracticeEngine.tsx`
- `src/components/fulltest/FullTestEngine.tsx`

**History:**

- `src/pages/HistoryDetail.tsx` — thêm mode review, render engine với initial state

---

## Cảnh báo & câu hỏi cho bạn

1. **Reading Part 1–4 không 1:1 với DB rows.** Cách lưu sẽ là "1 row gộp / part" với `user_answer = JSON`. OK chứ?
2. **Engine initial state**: thêm prop `initialAnswers` + `initialPhase="review"` vào từng engine. Đơn giản hơn nhiều so với tạo component review riêng.
3. **Speaking review**: chỉ hiện list recordings (đã có), không render lại SpeakingExamEngine. OK chứ?
4. Quy mô: ~10 file, ~600 dòng đổi. Tôi sẽ làm trong 1 lượt nếu bạn duyệt plan.

Bạn duyệt plan này hay muốn điều chỉnh điểm nào trước khi tôi code?
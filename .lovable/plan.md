# Sửa navigation chế độ "Xem lại từng câu"

## Bối cảnh & vấn đề

Hiện tại mỗi engine (Grammar/Reading/Listening/Writing) khi mở ở `reviewMode` vẫn dùng đúng UI thi bình thường: render **một câu / một sub-question / một clip tại một thời điểm**, có nav prev/next ở thanh dưới để nhảy giữa các sub-question.

User yêu cầu chia 3 chế độ rõ ràng, đơn vị "trang" là **PART**, không phải sub-question.

## 3 chế độ cần hỗ trợ

### 1) Đề đơn lẻ (single part)
- Mở từ `/history/:id` cho một test_result thuộc 1 exam_set 1 part.
- Render **toàn bộ part trên 1 trang dài cuộn được**, mọi câu hỏi/đáp án highlight đúng/sai hiện hết.
- **Không có** nút prev/next ở thanh dưới (chỉ còn nút Thoát + Question Review Modal nếu cần).

### 2) Full Part (1 kỹ năng nhiều part)
- Mở từ `/history/:id` khi test_result thuộc exam_set có `full_test_id` (single-skill merge).
- Phải gom tất cả test_result của cùng `full_test_id` + cùng user thành các trang.
- Mỗi part = 1 trang dài (như chế độ 1).
- Prev/Next ở thanh dưới chuyển **giữa các part**.
- Part đầu: ẩn Previous. Part cuối: Next thay bằng "Hoàn tất" (thoát).
- Không có intro/instructions screen.

### 3) Full Test (5 kỹ năng)
- Mở từ `/history-fulltest/:sessionId` (đã có `FullTestHistoryDetail`).
- Khi user bấm "Xem lại" trên 1 skill card → vào chế độ review xuyên suốt toàn bộ 5 kỹ năng (không chỉ skill đó).
- Thứ tự: Speaking → Listening → Grammar → Reading → Writing (theo SKILL_ORDER hiện tại). Trong mỗi skill, theo part order.
- Mỗi part = 1 trang dài.
- Prev/Next xuyên suốt mọi part của mọi kỹ năng.
- Trang đầu Speaking (= trang đầu tiên cả Full Test): ẩn Previous.
- Trang đầu của các kỹ năng sau (Listening, Grammar, Reading, Writing): Previous quay về trang cuối kỹ năng trước.
- Trang cuối Writing: Next thay bằng "Hoàn tất".
- Không có intro giữa các kỹ năng.
- Speaking trong review: hiện audio recordings + transcript/grading của part đó trên 1 trang (vì Speaking không có UI làm bài kiểu chọn đáp án).

## Kỹ thuật

### Engine: thêm `reviewAllInOne` prop
Mỗi engine (Grammar/Reading/Listening/Writing) nhận prop mới `reviewAllInOne?: boolean`. Khi true + `reviewMode`:
- Bỏ vòng lặp `currentIndex`, render toàn bộ questions/clips/parts trong 1 view dài.
- Bỏ `BottomNavBar` nội bộ (hoặc chỉ giữ thanh trống/Thoát) — nav được quản lý bởi parent.
- Vẫn áp dụng `submitted=true` để highlight xanh/đỏ.

Cụ thể:
- **Grammar**: map qua `questions[]`, render mỗi câu inline với option highlight.
- **Reading**: Part 1/3/4 hiện đang loop `currentIndex` → đổi sang render hết các gap/statement/paragraph trên 1 trang. Part 2 vốn đã single-page.
- **Listening**: render hết các clip/exercise, mỗi clip có audio player + câu hỏi đã chấm.
- **Writing**: vốn đã single-page mỗi task — chỉ cần đảm bảo `submitted=true` để hiện full bài viết user.

### Wrapper mới: `HistoryReviewPager`
Component bao ngoài engine, quản lý nav giữa các "page" (mỗi page = 1 part).

```ts
interface PageDef {
  examSetId: string;
  skill: "grammar" | "reading" | "listening" | "writing" | "speaking";
  part: string;
  testTitle: string;
  qResults: QResult[];
}

interface Props {
  pages: PageDef[];   // length 1, hoặc nhiều
  onExit: () => void;
}
```
- Giữ state `pageIdx`.
- Render engine tương ứng với `pages[pageIdx]` ở `reviewMode + reviewAllInOne`.
- Render footer Prev/Next chung:
  - `pageIdx === 0` → ẩn Previous.
  - `pageIdx === pages.length - 1` → Next đổi thành "Hoàn tất" gọi `onExit`.
- Speaking page → render component riêng (audio list + grading) thay vì engine.

### Tích hợp `HistoryDetail.tsx`
Thay vì gọi `HistoryReviewRenderer` cho 1 row, build danh sách pages:
1. Query exam_set của result hiện tại. Nếu có `full_test_id` (single-skill merge) → load tất cả test_results cùng `full_test_id` cùng user → tạo `pages[]` theo part order.
2. Nếu không có `full_test_id` → 1 page duy nhất.
3. Truyền vào `HistoryReviewPager`.

### Tích hợp `FullTestHistoryDetail.tsx`
Khi click "Xem lại" trên bất kỳ skill card nào:
- Build `pages[]` từ TẤT CẢ rows của session (đã có trong `skillAgg`), order = SKILL_ORDER × part order.
- Load `exam_question_results` cho tất cả rows một lượt (parallel queries).
- Set `pageIdx` ban đầu = trang đầu tiên của skill được click (UX: user click Listening card → mở thẳng trang Listening part 1, nhưng vẫn có Prev để về Speaking).
- Render `HistoryReviewPager`.

### Xoá `HistoryReviewRenderer`
Logic gộp vào `HistoryReviewPager` + giữ các transformer/parse-answer helpers tách riêng (`buildEngineProps(page)`).

## Phạm vi file
- Mới: `src/components/history/HistoryReviewPager.tsx`
- Mới: `src/components/history/buildReviewEngineProps.ts` (tách logic parse từ HistoryReviewRenderer)
- Mới: `src/components/history/SpeakingReviewPage.tsx` (audio + grading view)
- Sửa: `GrammarExamEngine.tsx`, `ReadingExamEngine.tsx`, `ListeningExamEngine.tsx`, `WritingExamEngine.tsx` — thêm `reviewAllInOne` mode (render all + ẩn bottom nav).
- Sửa: `HistoryDetail.tsx` — build pages theo full_test_id.
- Sửa: `FullTestHistoryDetail.tsx` — review mode dùng pager xuyên suốt 5 kỹ năng.
- Xoá: `HistoryReviewRenderer.tsx`.

## Câu hỏi xác nhận

1. **Single-part "1 trang dài"**: confirm là render TẤT CẢ câu hỏi của part đó cuộn dọc, không còn click-through từng câu? (Reading Part 1 có 4 gap, Part 4 có 7 đoạn — sẽ thành 1 trang dài hết.)
2. **Speaking trong Full Test review**: hiển thị gì trên "trang Speaking"? Audio recordings + AI grading của từng part? (4 audio cho 4 part Speaking, mỗi part 1 trang riêng — hay gộp 4 part Speaking vào 1 trang?)
3. **Writing 4 part trong Full Test**: 4 trang riêng (Task1/2/3/4) hay 1 trang gộp?

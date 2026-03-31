

# Tối ưu Fetch dữ liệu: Pagination + On-demand Loading

## Vấn đề hiện tại

1. **`ExamSetList` (Admin)**: Tải toàn bộ exam_sets không giới hạn — nếu có hàng trăm đề sẽ tải hết một lúc
2. **`useExamSets` (User-facing)**: Tải tất cả published exam_sets cho mỗi skill — không phân trang
3. **`fetchExamQuestions`**: Tải toàn bộ câu hỏi của một exam_set — hợp lý vì user cần tất cả câu để làm bài, KHÔNG cần thay đổi
4. **`fetchAllQuestions` (MockTest)**: Tải toàn bộ bảng `questions` cũ — lãng phí nhất

## Giải pháp

### 1. Thêm pagination cho `ExamSetList` (Admin)
**File: `src/components/admin/import/ExamSetList.tsx`**
- Thêm state `page` (mặc định 0), `pageSize` = 10, `totalCount`
- Query dùng `.range(page * pageSize, (page + 1) * pageSize - 1)` và `{ count: "exact" }`
- Hiển thị UI phân trang (Previous / Next / số trang) dùng component `Pagination` có sẵn
- Mỗi lần đổi trang chỉ tải 10 đề

### 2. Thêm pagination cho `useExamSets` hook (User-facing)
**File: `src/hooks/useExamSets.ts`**
- Thêm tham số `page` và `pageSize` (mặc định 10)
- Query dùng `.range()` + `{ count: "exact" }`
- Return thêm `totalCount`, `page`, `setPage`

### 3. Cập nhật các trang skill hiển thị pagination
**Files: `src/pages/Reading.tsx`, `Writing.tsx`, `Listening.tsx`, `Speaking.tsx`, `GrammarVocabulary.tsx`**
- Sử dụng `page`/`setPage`/`totalCount` từ hook
- Thêm UI Pagination khi có nhiều hơn 1 trang

### 4. Tối ưu MockTest — lazy load
**File: `src/pages/MockTest.tsx`**
- Thay `fetchAllQuestions()` bằng fetch theo skill khi cần (chỉ fetch khi user bắt đầu phần thi đó)
- Hoặc giới hạn `.limit(50)` nếu vẫn cần tải trước

### 5. Giữ nguyên `fetchExamQuestions`
- Khi user chọn 1 đề để làm bài, cần tải tất cả câu hỏi của đề đó — đây là on-demand đúng nghĩa, KHÔNG thay đổi

## Chi tiết kỹ thuật

```text
Trước:  useExamSets("reading") → SELECT * FROM exam_sets WHERE skill='reading' (tất cả)
Sau:    useExamSets("reading") → SELECT * FROM exam_sets WHERE skill='reading' LIMIT 10 OFFSET 0

Trước:  ExamSetList → SELECT * FROM exam_sets WHERE ... (tất cả)  
Sau:    ExamSetList → SELECT * FROM exam_sets WHERE ... LIMIT 10 OFFSET 0 + count

Trước:  MockTest → fetchAllQuestions() → SELECT * FROM questions (toàn bộ)
Sau:    MockTest → fetchQuestionsBySkill("grammar") khi cần
```

## Files thay đổi
1. `src/hooks/useExamSets.ts` — thêm pagination params + return totalCount
2. `src/components/admin/import/ExamSetList.tsx` — thêm pagination UI + range query
3. `src/pages/Reading.tsx` — dùng pagination từ hook
4. `src/pages/Writing.tsx` — dùng pagination từ hook
5. `src/pages/Listening.tsx` — dùng pagination từ hook
6. `src/pages/Speaking.tsx` — dùng pagination từ hook
7. `src/pages/GrammarVocabulary.tsx` — dùng pagination từ hook
8. `src/pages/MockTest.tsx` — lazy load questions theo skill thay vì tải hết


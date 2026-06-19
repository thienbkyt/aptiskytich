## Vấn đề (gốc rễ)

Trong `src/lib/examTransformers.ts`, hàm `toGrammarQuestions` ghi đè `id` của câu hỏi thành `i + 1` (số thứ tự). Khi `GrammarExamEngine.handleSubmit` lưu `perQuestion`, nó dùng `(q as any).id` — tức `"1"`, `"2"`, ... — đưa vào cột `exam_question_id` (UUID) của bảng `exam_question_results`.

Kết quả: insert per-question fail. Kiểm tra DB xác nhận 21 `test_results` skill grammar_vocab nhưng **0 row** trong `exam_question_results` skill grammar/grammar_vocab. Vì vậy ở History:
- không có `qResults` → không hiển thị đáp án user
- `ansMap[(q as any).id]` luôn miss → không có đáp án đúng/sai highlight
- "mất thông tin bài làm"

Reading/Listening hoạt động vì transformer giữ nguyên UUID (`r.id`) khi map answers.

## Phạm vi sửa

3 file, chỉ frontend. Không đụng schema/edge function/AI grading. Dữ liệu grammar lịch sử cũ vẫn rỗng (chấp nhận — không có gì để khôi phục), từ giờ trở đi mọi lần làm bài sẽ lưu đúng và review chính xác.

### 1. `src/lib/examTransformers.ts` — `toGrammarQuestions`

Vẫn set `id: i + 1` cho UI, nhưng nhồi UUID thật vào `extra_data._eqId`:

```ts
extra_data: { ...(r.extra_data || {}), _eqId: r.id }
```

### 2. `src/components/grammar/GrammarExamEngine.tsx` — `handleSubmit`

Thay `exam_question_id: (q as any).id` bằng `_eqId` nếu có, fallback về `id` string:

```ts
const eqId = (q.extra_data as any)?._eqId ?? String((q as any).id);
return { exam_question_id: eqId, user_answer: userAnswer, is_correct: ok };
```

`user_answer` giữ logic hiện tại:
- `fill-in-blank` → text user nhập (`fillAnswers[i]`)
- mọi loại MCQ/`vocab_matching` (synonym, gap_fill, definition_matching, collocation) → `String(answers[i])` (chỉ số option)

Logic này đã đủ vì engine nhóm các câu vocab_matching nhưng vẫn lưu **từng câu** (mỗi index trong `currentGroup.indices` là một `Question` riêng với `answers[idx]` riêng).

### 3. `src/components/history/HistoryReviewRenderer.tsx` — nhánh `skill === "grammar"`

Build `ansMap` theo `_eqId` thay vì `id` cục bộ:

```ts
const grammarAnsMap: Record<string, string | null> = {};
qResults.forEach((r) => { grammarAnsMap[r.exam_question_id] = r.user_answer; });

const questions = toGrammarQuestions(rows);
const initialAnswers: (number | null)[] = [];
const initialFill: string[] = [];
questions.forEach((q) => {
  const eqId = (q.extra_data as any)?._eqId as string | undefined;
  const raw = eqId ? grammarAnsMap[eqId] : null;
  if (q.question_type === "fill-in-blank") {
    initialAnswers.push(null);
    initialFill.push(typeof raw === "string" ? raw : "");
  } else {
    // raw có thể là "2" hoặc JSON {answer: 2} (defensive)
    let n: number = NaN;
    if (raw != null) {
      const trimmed = raw.trim();
      if (/^\d+$/.test(trimmed)) n = parseInt(trimmed, 10);
      else {
        try {
          const p = JSON.parse(trimmed);
          if (typeof p === "number") n = p;
          else if (p && typeof p.answer === "number") n = p.answer;
        } catch { /* not json */ }
      }
    }
    initialAnswers.push(Number.isFinite(n) ? n : null);
    initialFill.push("");
  }
});
```

Pass vào `GrammarExamEngine` như cũ với `reviewMode initialAnswers initialFill showResultsOnSubmit={false} initialGroup onGroupCount`. Engine đã có sẵn:
- `submitted = true` khi `reviewMode` → render highlight đúng/sai
- dropdown `value={userAns}` cho vocab_matching, MCQ buttons highlight emerald cho correct, destructive cho user-wrong
- Hiển thị `✓ {correct option}` bên cạnh khi sai
- Block explanation cuối câu (cần `qIsCorrect`/`qIsWrong`, đã dựa trên `isAnswered` + `isCorrect`)

## Kiểm thử

1. Làm 1 attempt skill Grammar Full (đủ Sentence Gap Fill + Collocation Matching + Synonym + Definition + MCQ + fill-in-blank).
2. Vào History → "Xem lại chi tiết":
   - Mỗi dropdown vocab_matching hiện lựa chọn của user, viền xanh/đỏ đúng/sai.
   - Câu sai có "✓ <đáp án đúng>" hiện kế bên dropdown.
   - MCQ: option user chọn (nếu sai) đỏ + X, option đúng xanh + ✓.
   - Fill-in-blank: input đóng băng giá trị user, dưới hiện "Đáp án đúng: ...".
   - Explanation hiện cho mọi câu đã trả lời.
3. SQL check: `select count(*) from exam_question_results where skill = 'grammar_vocab'` > 0 sau lần làm mới.

## Out of scope

- Lịch sử grammar cũ (trước fix) vẫn không có per-question — không tái tạo được.
- Không đụng AI grading speaking/writing, không đổi schema.

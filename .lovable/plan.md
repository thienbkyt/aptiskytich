

# Full Aptis Exam Import - Kế hoạch cải tiến

## Vấn đề hiện tại

1. **Excel template sai format**: Template hiện tại dùng cùng 1 format MCQ (option_a/b/c/d) cho tất cả kỹ năng, nhưng thực tế mỗi skill/part cần cấu trúc dữ liệu khác nhau (Reading Part 2 cần passage + gaps, Part 3 cần people + statements, Writing cần scenario/email, Speaking cần prepTime/speakTime...)

2. **Không hỗ trợ import đề full**: Mỗi sheet Excel chỉ tạo 1 exam_set với 1 part duy nhất. Không có cơ chế import 1 đề đầy đủ (5 skills x 4 parts = 20 exam_sets).

3. **SmartForm chỉ hỗ trợ MCQ**: Form tạo/sửa đề chỉ có giao diện nhập câu hỏi trắc nghiệm, không có form phù hợp cho Reading Part 2/3, Writing Part 2/4, Speaking...

## Giải pháp

### Bước 1: Redesign Excel Template (file `ExcelImport.tsx`)

Thay vì 5 sheet theo skill, tạo template với **sheet cho mỗi skill-part** (tổng ~20 sheets), mỗi sheet có cột phù hợp:

| Sheet | Cột chính |
|-------|-----------|
| GV_Part1-4 | question_text, option_a/b/c/d, correct_answer, explanation |
| R_Part1 | sentence, question, option_a/b/c/d, correct_answer, explanation |
| R_Part2 | passage (row 1 only), sentence_option, gap_index, correct (1 row = 1 sentence option) |
| R_Part3 | person_name, person_text, statement, correct_person |
| R_Part4 | passage (row 1), question_text, option_a/b/c/d, correct_answer |
| L_Part1-4 | question_text, option_a/b/c/d, correct_answer, audio_filename |
| S_Part1 | question_text, prep_time, speak_time |
| S_Part2 | prompt, image_url, prep_time, speak_time |
| S_Part3 | prompt, image_url_1, image_url_2, prep_time, speak_time |
| S_Part4 | topic (row 1), question_text, prep_time, speak_time |
| W_Part1 | question_text, sample_answer |
| W_Part2 | social_post_author, social_post_content, prompt_question, word_limit, sample_answer |
| W_Part3 | question_text, sample_answer, word_limit |
| W_Part4 | email_type, scenario, bullet_points, word_limit, sample_answer |

### Bước 2: Parser cho mỗi sheet type (file `ExcelImport.tsx`)

Viết hàm parse riêng cho từng loại sheet, chuyển dữ liệu Excel thành đúng cấu trúc `exam_questions` row với `extra_data` phù hợp (giống như examTransformers đang đọc).

### Bước 3: Import flow "Full Exam" (file `ExcelImport.tsx`)

- Khi upload file, tự động detect tất cả sheet có tên hợp lệ
- Hiển thị preview tổng hợp: "Đề này có 15/20 parts đã điền"
- Nhập tên đề (VD: "Aptis Mock Test #5"), hệ thống tự tạo **nhiều exam_sets** (1 per skill-part) với title format: `"{Tên đề} - {Skill} - {Part}"`
- Validate từng sheet theo format riêng trước khi import

### Bước 4: SmartForm hỗ trợ đa dạng part (file `SmartForm.tsx`)

Thêm form UI phù hợp cho các part đặc biệt:
- **Reading Part 2**: textarea cho passage + danh sách sentence options + gap mapping
- **Reading Part 3**: danh sách people (name + text) + statements
- **Writing Part 2**: social post fields + prompt questions
- **Writing Part 4**: 2 email sections (informal + formal) với scenario, bullet points
- **Speaking Part 2/3**: image upload + prompt + prep/speak time

## Các file cần thay đổi

1. **`src/components/admin/import/ExcelImport.tsx`** — Redesign template generator + multi-sheet parser + full exam import flow
2. **`src/components/admin/import/SmartForm.tsx`** — Thêm conditional form sections cho từng skill-part
3. **`src/components/admin/import/types.ts`** — Thêm interface cho các loại import row mới

## Thứ tự thực hiện

1. Cập nhật types cho import rows mới
2. Redesign Excel template download với đúng format
3. Viết parser/validator cho từng sheet type
4. Update import flow tự tạo nhiều exam_sets
5. Nâng cấp SmartForm với form phù hợp cho từng part


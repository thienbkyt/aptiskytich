

# Plan: Chuyển Vocabulary sang Database + Admin Import

## Tình trạng hiện tại
- Dữ liệu từ vựng đang hardcode trong `src/data/vocabSets.ts` (9 bộ APTIS)
- 3 file sử dụng: `SkillPractice.tsx`, `VocabStudy.tsx`, `vocabSets.ts`
- Chưa có chức năng import từ vựng qua Admin

## Kế hoạch

### 1. Tạo bảng `vocab_sets` trong database
Lưu các bộ từ vựng hệ thống (thay thế hardcode):
- `id`, `group` (ví dụ: "TOEIC"), `title`, `is_published`, `created_at`
- RLS: anyone can read, admin can CRUD

### 2. Tạo bảng `vocab_set_words` 
Lưu từng từ trong bộ:
- `id`, `vocab_set_id` (FK), `word`, `phonetic`, `meaning`, `example`, `example_vi`, `word_family` (jsonb), `order_index`
- RLS: anyone can read, admin can CRUD

### 3. Cập nhật Frontend
- Thay `VOCAB_SETS` hardcode bằng query từ database trong `SkillPractice.tsx` và `VocabStudy.tsx`
- Tạo hook `useVocabSets()` để fetch + cache

### 4. Thêm Admin Import cho Vocabulary
Trong trang Admin, thêm tab/section "Quản lý Từ vựng":
- **Form thủ công**: Tạo bộ từ vựng mới, thêm từng từ
- **Import Excel/CSV**: Upload file với format chuẩn (columns: word, phonetic, meaning, example, example_vi, word_family)
- Hiển thị danh sách bộ từ vựng đã tạo, cho phép sửa/xóa

### 5. Cập nhật chủ đề từ APTIS sang nội dung thực tế
- Xóa dữ liệu hardcode trong `vocabSets.ts`
- Admin tự import bộ từ vựng mới qua giao diện (TOEIC hoặc APTIS tùy ý)

## Kết quả
- Quản lý từ vựng hoàn toàn qua Admin, không cần sửa code
- Hỗ trợ import Excel/CSV để thêm hàng loạt
- Giao diện người dùng tự động cập nhật từ database


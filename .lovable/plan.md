

# Thiết kế lại trang Học Từ Vựng

## Tổng quan
Xây dựng lại trang `/vocabulary` (SkillPractice) thành một trang học từ vựng hoàn chỉnh với 2 tab chính, lấy cảm hứng từ hình ảnh tham khảo.

## Cấu trúc

### Layout chính
- Header với tiêu đề "Học từ vựng Aptis"
- 2 tab lớn: **"Từ vựng bài thi Aptis"** | **"Kho từ vựng của tôi"**

### Tab 1: Từ vựng bài thi Aptis
- Grid 3 cột hiển thị các card bộ từ vựng theo đề thi
- Mỗi card gồm: Badge nhóm (VD: "APTIS GENERAL"), tên bộ từ (VD: "Test 1 - Animals & Nature"), số lượng từ, 2 nút "Xem nhanh" và "Luyện tập"
- Dữ liệu tĩnh ban đầu (mock data) với ~9 bộ từ vựng theo chủ đề Aptis
- Search bar để tìm kiếm bộ từ

### Tab 2: Kho từ vựng của tôi
- Dashboard cá nhân với 3 stat cards: "Từ đã thuộc", "Từ cần ôn", "Tổng từ đã học"
- 2 nút game lớn dẫn đến: **Flashcards** và **Matching** (hiện tại hiển thị "Sắp ra mắt")
- Danh sách từ vựng đã lưu (placeholder)

## Files cần thay đổi

1. **`src/pages/SkillPractice.tsx`** — Viết lại hoàn toàn thành trang Vocabulary với 2 tab, header, search, grid cards, và dashboard cá nhân

## Chi tiết kỹ thuật
- Sử dụng Tabs component có sẵn từ Radix UI
- Mock data tĩnh cho các bộ từ vựng (có thể kết nối DB sau)
- Stat cards dùng giá trị placeholder (0) vì chưa có bảng vocabulary trong DB
- Màu chủ đạo: teal/green cho vocabulary (phân biệt với các skill khác)
- Responsive: 3 cột desktop, 2 cột tablet, 1 cột mobile


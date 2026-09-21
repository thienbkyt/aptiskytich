# Thu gọn thanh điều hướng trên điện thoại

## Thay đổi
- Xóa hàng nút phụ “Thi thử / Luyện tập” trên thanh điều hướng mobile, giữ nguyên menu ba gạch và giao diện desktop.
- Tăng vùng bấm của nút đổi giao diện và nút ba gạch lên tối thiểu 44×44 px dưới 768 px.
- Thay toàn bộ `pt-[112px] md:pt-16` còn có trong `src` thành `pt-16`, gồm cả màn tải dùng chung.

## Kiểm tra
- Kiểm tra ở 375 px: thanh điều hướng chỉ một hàng khoảng 64 px, vẫn cố định khi cuộn, nội dung bắt đầu đúng bên dưới.
- Mở menu ba gạch và xác nhận vẫn có “Thi thử miễn phí” cùng “Luyện tập từng kỹ năng”.
- Kiểm tra ở 1440 px để xác nhận giao diện desktop không thay đổi.
- Kiểm tra trạng thái build sau chỉnh sửa.

## Mục tiêu

Trang giá hiện tại có 4 card gần giống hệt nhau (10 dòng quyền lợi lặp lại), giá/ngày bị chôn trong danh sách, và bảng so sánh 12 dòng chiếm nhiều diện tích. Người dùng phải đọc nhiều mới chọn được. Sửa để: nhìn 3 giây là chọn được, gói 3 tháng là lựa chọn mặc định.

## Việc sẽ làm (chỉ trong `src/pages/PricingPage.tsx`)

### 1. Rút còn 3 lựa chọn hiển thị
- Cột 1 — **Ngắn hạn** (giữ toggle 1 ngày / 1 tuần như hiện tại).
- Cột 2 — **1 tháng**.
- Cột 3 — **3 tháng** (hero, to hơn, viền đỏ, nhãn "Được chọn nhiều nhất").
- Gói **6 tháng** không còn là card riêng: đưa xuống một dòng gọn ngay dưới hàng card — "Ôn dài hơn? Gói 6 tháng 599.000đ — chỉ 3.328đ/ngày → Chọn" (vẫn gọi cùng `onPick`, không mất đường mua).

### 2. Giá/ngày trở thành thông tin chính
Trong mỗi card, thứ tự đọc mới:
```text
Tên gói                     [-30%]
3.878đ /ngày        <- dòng to nhất, 32px
599.000đ cho 90 ngày (gạch giá lẻ 2.250.000đ)
[ Nút chọn ]
─────────────────
3 điểm khác biệt của gói
"Và đầy đủ 12 tính năng" (một dòng, mở ra khi bấm)
```
Nút nằm **trên** danh sách quyền lợi để không phải cuộn.

### 3. Chỉ giữ điểm khác biệt trong card
Mỗi card chỉ 3 dòng riêng: số lượt chấm AI/ngày, thời hạn, mức tiết kiệm. 7 dòng quyền lợi chung lặp lại ở cả 4 card được gỡ khỏi card, chuyển thành một dải chung duy nhất bên dưới hàng card ("Mọi gói đều có: ..." dạng lưới 6 mục, icon + chữ ngắn).

### 4. Card 3 tháng nổi bật hơn
- Chiếm cột rộng hơn (1.25fr), nền trắng trên khay đỏ nhạt, viền 2px đỏ #CC1C01, nút đỏ đặc — 3 card kia nút outline xám.
- Giữ dòng nhấn "Lượt chấm AI cao nhất — gấp 3 gói 1 tháng".
- Thêm dòng so sánh trực tiếp: "Rẻ hơn ~X%/ngày so với gói 1 tháng" (tính từ dữ liệu `pricing_plans`, không hardcode).

### 5. Bảng so sánh thu gọn
Bảng 12 dòng Free vs Trả phí chuyển thành khối đóng mặc định: nút "So sánh chi tiết Miễn phí vs Trả phí" → mở ra bảng như hiện tại. Không xoá nội dung, chỉ không chiếm chỗ khi chưa cần.

### 6. Nhịp và căn chỉnh
Một container `max-w-6xl` duy nhất; hero → chip số liệu → hàng card → dòng gói 6 tháng → dải tính năng chung → bảng so sánh (thu gọn) → chân tư vấn. Mobile: card 3 tháng lên đầu bằng CSS order, các card xếp dọc.

## Giữ nguyên, không đụng
`onPick`, `create-payment`, redirect `checkoutUrl`, polling `?paid=1`, `?cancel=1`, Dialog chuyển khoản tay, `ContactAdminLinks`, query `pricing_plans`, RPC `public_stats` và dải 3 chip số liệu, nội dung 12 dòng bảng so sánh.

## Kỹ thuật
- Chỉ sửa `src/pages/PricingPage.tsx`. Không migration, không sửa edge function.
- Mọi con số (giá, giá/ngày, %, lượt AI, số đề) tính động từ `pricing_plans` + `public_stats`; không hardcode.
- Màu dùng token sẵn có + đỏ thương hiệu #CC1C01 như phần còn lại của trang.

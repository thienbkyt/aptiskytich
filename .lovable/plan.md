# Chưa được — và vấn đề còn lớn hơn email

## Tình trạng vừa kiểm tra (21:45, 05/09)

- `notify.aptiskytich.vn`: vẫn **chưa có 2 bản ghi NS** trỏ về `ns3.lovable.cloud` / `ns4.lovable.cloud`. Email xác thực vẫn bị chặn.
- Nghiêm trọng hơn: **toàn bộ tên miền `aptiskytich.vn` đang trả lỗi DNS**. Hai máy chủ tên miền đang khai báo tại nhà đăng ký là `laocai.vclouddns.com` và `sapa.vclouddns.com`, nhưng cả hai đều **từ chối trả lời** cho `aptiskytich.vn`, `www.aptiskytich.vn` và mọi tên con. Nghĩa là chúng chưa hề nhận quản lý vùng DNS của tên miền này.
- Hệ quả: web chạy được lúc này chỉ do bộ nhớ đệm DNS ở một số nơi; khi đệm hết hạn, khách truy cập sẽ không vào được web nữa. Đây là việc cần xử lý trước cả email.

## Việc cần làm — theo thứ tự

### 1. Khôi phục DNS cho tên miền gốc (ưu tiên số 1)
Liên hệ hỗ trợ inet.vn, nói đúng nội dung sau:

```text
Tên miền aptiskytich.vn đang khai báo nameserver laocai.vclouddns.com và
sapa.vclouddns.com, nhưng hai nameserver này trả về REFUSED cho mọi truy vấn
của aptiskytich.vn (lame delegation). Vùng DNS chưa được tạo trên hệ thống mới.
Nhờ tạo lại vùng DNS và khôi phục các bản ghi, hoặc đưa tên miền trở lại
ns1/ns2/ns3.inet.vn.
```

Các bản ghi tối thiểu cần có sau khi khôi phục:

```text
A     @              185.158.133.1
A     www            185.158.133.1
TXT   _lovable.www   lovable_verify=bb623d6668cebb781f5e4676b8a64732c426d53935754f170186bc3e4f22507c
NS    notify         ns3.lovable.cloud
NS    notify         ns4.lovable.cloud
```

### 2. Thêm 2 bản ghi NS cho `notify`
Làm ngay trong lần khôi phục ở bước 1 (đúng loại **NS**, không phải CNAME, không phải Child DNS). Nếu form của inet không có loại NS, nhờ hỗ trợ thêm hộ 2 dòng đó.

### 3. Phương án thay thế nếu inet không làm được
Chuyển quản lý DNS sang Cloudflare (miễn phí, giữ nguyên nhà đăng ký): tạo vùng cho `aptiskytich.vn`, nhập 5 bản ghi ở trên, rồi đổi nameserver tại inet sang cặp nameserver Cloudflare cung cấp. Cloudflare cho phép thêm bản ghi NS cho tên con nên `notify` sẽ chạy được chắc chắn.

### 4. Sau khi DNS đúng — phần em làm
- Kiểm tra lại DNS công khai (NS của `notify`, A của web, TXT xác minh).
- Chạy lại xác minh đường gửi email của `notify.aptiskytich.vn`.
- Gửi thử một email xác thực đăng ký và xác nhận đã tới.
- Xác thực thủ công các tài khoản đăng ký bị kẹt trong thời gian gián đoạn (hiện tại và cả các tài khoản mới phát sinh từ 04/09).
- Báo lại kết quả kèm nguyên nhân gốc cuối cùng.

## Ghi chú kỹ thuật

- Chẩn đoán: `dns.google` trả `Status: 2` (SERVFAIL) kèm `rcode=REFUSED` từ `103.166.182.6` và `103.72.96.118` cho `aptiskytich.vn/A`, `/NS`, `/TXT` và `notify.aptiskytich.vn/NS` → lame delegation ở cấp vùng gốc.
- Trạng thái phía Lovable: tên miền email `notify.aptiskytich.vn` báo `Verified` ở mức DNS-token nhưng đường gửi (send path) `Timed out waiting for email delivery path verification` vì không truy vấn được vùng con.
- Tên miền web `www.aptiskytich.vn` ở trạng thái `active`, A record khớp `185.158.133.1`, nhưng TXT xác minh `indeterminate` do nameserver không phản hồi.
- Không có thay đổi mã nguồn nào trong kế hoạch này; toàn bộ việc sửa nằm ở DNS.

## Mục tiêu

Mở rộng trang **Người dùng** (`/admin/students`) hiện có để admin có thể:
- Xem ai đang là admin (hiển thị badge "Admin" trong bảng)
- Cấp quyền admin / Gỡ quyền admin trực tiếp bằng một nút

Không tạo trang mới — tận dụng `AdminStudents.tsx` + `StudentManager.tsx` đã có.

## Các thay đổi

### 1. Edge function mới: `set-user-role`
- File: `supabase/functions/set-user-role/index.ts`
- Xác thực JWT, kiểm tra caller là admin (giống `list-students`)
- Nhận `{ user_id: string, action: 'grant' | 'revoke' }`
- Validate bằng Zod (user_id là UUID, action thuộc enum)
- Chặn caller tự gỡ quyền của chính mình (`callerId === user_id && action === 'revoke'` → 400)
- Dùng service role để `INSERT ... ON CONFLICT DO NOTHING` hoặc `DELETE FROM user_roles WHERE user_id = ? AND role = 'admin'`
- Trả về `{ ok: true, is_admin: boolean }`

### 2. Cập nhật `list-students` edge function
- Sau khi load users, query `user_roles` lấy tất cả `user_id` có `role = 'admin'`
- Gắn thêm `is_admin: boolean` vào mỗi record trả về

### 3. UI trong `StudentManager.tsx`
- Thêm field `is_admin` vào interface `Student`
- Trong bảng:
  - Thêm cột "Quyền" (hoặc badge cạnh tên) hiển thị "Admin" (variant primary) hoặc "User" (muted)
  - Thêm nút trong cột "Hành động": **"Cấp admin"** (mặc định) hoặc **"Gỡ admin"** (variant destructive nếu đang là admin)
  - Bấm nút → `AlertDialog` xác nhận → gọi `supabase.functions.invoke('set-user-role', ...)` → cập nhật state tại chỗ + toast
  - Disable nút cho chính tài khoản đang đăng nhập (không tự gỡ mình)
- Thêm ô tìm kiếm hoạt động sẵn có; thêm filter quick toggle "Chỉ hiển thị admin" (checkbox nhỏ) — optional, có thể bỏ nếu muốn gọn
- Loading state per-row khi đang gọi function

### 4. Bảo mật
- RLS của `user_roles` vẫn giữ nguyên (deny client write) — toàn bộ thay đổi đi qua edge function với service role
- Không cần migration

## Kỹ thuật

```text
[AdminStudents page]
   └── StudentManager
          ├── invoke('list-students')  → trả thêm is_admin
          └── invoke('set-user-role', { user_id, action })
                  → edge function (admin-guard + service role)
                      → INSERT/DELETE user_roles
```

Sau khi user xác nhận plan, switch sang build mode để triển khai.


## Mục tiêu
Nâng cấp UI toàn site theo phong cách **Tech Dark + Red Glow**: nền tối sâu (#0F0F10 → #1A1A2E), accent đỏ #CC1C01 phát sáng, cam #FEAD5F làm điểm nhấn phụ, font **Montserrat** xuyên suốt, animation mức vừa phải (không gây nặng).

**Loại trừ tuyệt đối**: Giao diện làm bài (Exam UI full-screen Navy) và trang Review/Preview bài (`/history/review/*`, các component trong `src/components/exam/*` và `src/components/history/*`).

---

## 1. Design System (nền tảng)

Cập nhật `src/index.css` và `tailwind.config.ts`:

**Tokens mới (HSL):**
- `--background`: #0F0F10 (dark mặc định), `--background-elevated`: #1A1A2E
- `--surface-glass`: hsl với alpha cho card kính mờ
- `--primary`: #CC1C01 (giữ), `--primary-glow`: lighter red cho shadow/glow
- `--accent`: #FEAD5F
- `--border-glow`: viền đỏ mờ phát sáng
- Gradients: `--gradient-hero` (đỏ → cam → tím navy), `--gradient-card` (radial glow), `--gradient-text` (đỏ → cam cho heading)
- Shadows: `--shadow-glow-red`, `--shadow-glow-soft`, `--shadow-elevated`

**Font:**
- Import Montserrat (300, 400, 500, 600, 700, 800) qua `<link>` ở `index.html`
- `font-sans` = Montserrat; heading dùng weight 700/800 + letter-spacing chặt

**Light mode**: vẫn giữ, nhưng dark là mặc định và được tối ưu kỹ nhất.

---

## 2. Component dùng chung mới

Tạo trong `src/components/ui/`:
- `GlowCard.tsx` — card nền tối + border gradient + hover glow đỏ
- `GradientText.tsx` — heading gradient đỏ→cam
- `AnimatedGridBg.tsx` — nền grid pattern mờ (MagicUI animated-grid-pattern), dùng cho Hero/Dashboard
- `GlowButton` variant bổ sung trong `button.tsx` (shimmer khi hover)
- `StatPill.tsx` — pill số liệu có icon + glow

Animation mức 3: dùng `fade-in`, `scale-in`, `hover-scale` có sẵn + thêm `glow-pulse` (keyframe nhẹ cho CTA chính). Không dùng particles/meteors (tiết kiệm hiệu năng).

---

## 3. Phạm vi & thay đổi cụ thể

### 3.1 Landing + Navbar + Footer
- **Navbar** (`src/components/layout/Navbar.tsx`): nền `bg-background/80 backdrop-blur-xl`, viền dưới đỏ glow thay vì 3px solid, logo + nav item hover underline gradient, CTA "Đăng ký" dùng GlowButton.
- **Hero** (`src/pages/Index.tsx`): nền AnimatedGridBg + radial glow đỏ ở góc, heading GradientText cỡ lớn, sub-CTA dạng pill. Thêm hàng "trust badges" (AI chấm / 1000+ học viên / Sát đề thật).
- **Sections**: features dạng bento-grid 3-2 với GlowCard + icon Lucide trong vòng tròn đỏ glow.
- **Footer**: nền tối elevated, layout 4 cột, social icon dạng glow, copyright + Zalo CTA.

### 3.2 Dashboard + Practice/Skill pages
- **Dashboard** (`src/pages/Dashboard.tsx`): hero greeting gradient text, streak widget biến thành "command center" — card lớn có ring progress + flame icon glow. Stat row dùng StatPill 3 ô (streak, từ đã học, bài đã làm). Lưới Quick Action 5 skill dạng GlowCard với icon riêng.
- **Practice index** (`src/pages/Practice.tsx`) + 5 trang skill (`Grammar.tsx`, `Reading.tsx`, `Listening.tsx`, `Writing.tsx`, `Speaking.tsx`): header sticky + breadcrumb glow, danh sách bài luyện convert sang GlowCard grid, badge "Mới / Đã làm / Điểm cao nhất".

### 3.3 Vocabulary + History
- **Vocabulary** (`src/pages/Vocabulary.tsx`, các trang con `/vocab/*`): vẫn giữ accent teal cho riêng vocab (theo mem://style/vocabulary-theme) nhưng nâng cấp về cấu trúc card glow + nền dark đồng bộ. Trang flashcard/3R: card lớn có border gradient teal→đỏ nhẹ.
- **History list** (`src/pages/History.tsx`): bảng kết quả thành danh sách card có sparkline điểm, badge band CEFR màu, nút "Xem lại" dùng GlowButton. **KHÔNG đụng** `HistoryReviewPager`, `ReviewAnswerPanel`, `SpeakingReviewPage`, `WritingFeedbackCard`, `AIGradingCard`.

### 3.4 Auth + Admin
- **Auth** (`src/pages/Auth.tsx` hoặc Login/Signup): layout split — nửa trái panel gradient đỏ→navy với tagline + logo lớn; nửa phải form trên nền dark, input dạng glow border khi focus, nút Google Auth icon rõ.
- **Admin** (`src/pages/admin/*`, `src/components/admin/*`): sidebar tối elevated + active state glow đỏ, header có search + breadcrumb, các card thống kê dạng GlowCard, table dùng zebra `bg-background-elevated/50`, button hành động dùng variant mới. Áp dụng cho: Dashboard admin, Import Center, Reports, Quản lý exam_sets, User management. **KHÔNG đụng** form preview câu hỏi của admin nếu nó hiển thị y hệt giao diện làm bài.

---

## 4. Các khu vực KHÔNG sửa
- `src/components/exam/*` (toàn bộ UI làm bài, ExamHeader Navy)
- `src/components/history/HistoryReviewPager.tsx`, `ReviewAnswerPanel.tsx`, `SpeakingReviewPage.tsx`, `WritingFeedbackCard.tsx`, `AIGradingCard.tsx`
- Các route exam (`/exam/*`, `/practice/*/take`, `/full-test/*/take`) và route review (`/history/review/*`)
- Logic nghiệp vụ, query, edge functions — chỉ thay UI/CSS/component presentation

---

## 5. Thứ tự triển khai (chia sprint nhỏ)
1. **Foundation**: Cập nhật `index.css`, `tailwind.config.ts`, import Montserrat, tạo components dùng chung (GlowCard, GradientText, AnimatedGridBg, GlowButton variant).
2. **Landing + Navbar + Footer**: redesign theo design system mới.
3. **Dashboard + Practice/Skill pages**.
4. **Vocabulary + History list**.
5. **Auth + Admin panel**.
6. **QA**: kiểm tra dark/light, mobile (375/414), kiểm xem có vô tình ảnh hưởng exam/review không.

---

## 6. Chi tiết kỹ thuật
- Giữ shadcn components, chỉ mở rộng `variants` qua `cva` — không viết class màu cứng trong component.
- Animation: chỉ dùng Tailwind animations có sẵn + 1 keyframe `glow-pulse` mới (2s ease-in-out infinite, box-shadow đỏ).
- Không thêm thư viện nặng: chỉ cài MagicUI's `animated-grid-pattern` (single component copy-paste, không phải package).
- Performance: backdrop-blur chỉ dùng ở navbar + dialog, tránh dùng tràn lan trên list dài.
- Đảm bảo body class `exam-mode` (đã có) tiếp tục ẩn ZaloFab và không bị design mới override.
- Cập nhật `mem://style/visual-identity` và `mem://style/style-guidelines` sau khi build xong để phản ánh design system mới.

Bấm **Implement plan** để bắt đầu Sprint 1 (Foundation + Landing).

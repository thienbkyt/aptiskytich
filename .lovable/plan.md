
## Mục tiêu

Nâng cấp cảm giác "công nghệ" cho toàn bộ web Aptis Kỳ Tích bằng:
- **Particle / network background** ở các trang chính
- **Interactive effects**: mouse spotlight trên card, border beam quanh CTA, cursor glow nhẹ
- **Micro-interactions**: hover lift, scale, shimmer cho button, fade-in stagger khi cuộn

Mức độ: 6/10 — đủ "wow" nhưng không gây phân tâm hay nặng máy.

**Loại trừ:** Toàn bộ giao diện làm bài thi (ExamEngine, ExamHeader, các route khi đang trong trạng thái exam) — giữ nguyên sạch sẽ, không thêm hiệu ứng nào.

---

## Phạm vi áp dụng

Áp dụng (thêm animation):
- Landing (`/`)
- Dashboard (`/dashboard`)
- Course (`/course`)
- Auth, ResetPassword (`/auth`, `/reset-password`)
- SkillPractice + các trang chọn part (`/grammar`, `/reading`, `/listening`, `/speaking`, `/writing`, `/vocabulary`, `/thi-thu`) — **chỉ phần chọn đề / part**, không vào ExamEngine
- History, HistoryDetail, Progress
- Admin (`/admin/*`)
- NotFound

Loại trừ (giữ nguyên):
- Toàn bộ component `*ExamEngine`, `ExamHeader`, `ExamFooter`, `QuestionReviewModal`
- Trang kết quả ngay sau khi nộp bài (giữ tối giản)

---

## Các component animation mới sẽ tạo

Tạo trong `src/components/ui/`:

1. **`particles-background.tsx`** — Canvas particles (~40 hạt) trôi nhẹ + nối line khi gần nhau (network effect). Theo theme (light/dark), dùng màu primary với opacity thấp. `pointer-events-none`, `absolute inset-0`.
2. **`spotlight-card.tsx`** — Card với radial gradient theo vị trí chuột (mouse-tracked spotlight). Wrap quanh `GlowCard` hiện có.
3. **`border-beam.tsx`** — Border ánh sáng chạy quanh viền (CSS conic-gradient + animation). Dùng cho CTA chính, badge "Hot".
4. **`magnetic-button.tsx`** — Button hơi "hút" theo chuột khi hover (translate nhẹ theo cursor). Optional wrapper.
5. **`scroll-reveal.tsx`** — Wrapper dùng `useInView` của framer-motion để fade-up khi xuất hiện trong viewport, hỗ trợ stagger.
6. **`gradient-orb.tsx`** — Orb gradient có animation "breathing" (scale + opacity). Đặt làm background section.

Cập nhật `src/index.css` + `tailwind.config.ts`:
- Keyframes mới: `border-beam`, `gradient-shift`, `breathing`, `aurora-drift`, `scan-line`
- Utility: `.animate-border-beam`, `.animate-breathing`, `.animate-aurora`, `.bg-aurora` (gradient động)
- Class `.tech-card` áp dụng spotlight + hover glow nhất quán

---

## Áp dụng vào từng trang

### Landing (`src/pages/Index.tsx`)
- Hero: thêm `<ParticlesBackground />` chồng lên `<AnimatedGrid />`, headline gradient có `gradient-shift` animation, badge dùng `<BorderBeam />`, CTA chính dùng `<MagneticButton />`
- Stats: number đếm lên (count-up) khi vào viewport
- Exam Structure & Features: card dùng `<SpotlightCard />` thay `GlowCard`, icon có hover rotate/scale
- Testimonials: card hover tilt nhẹ 3D
- CTA cuối: thêm gradient orb "breathing"

### Dashboard (`src/pages/Dashboard.tsx`)
- Hero block: thêm particles + aurora gradient nhẹ
- StatPill: hover scale + glow đậm hơn, value có count-up khi load
- QuickActionCard: spotlight follow chuột, icon glow khi hover
- Skill progress bars: shimmer chạy qua bar (đã có animate-shimmer, áp dụng vào)
- StreakRing: animation rotate nhẹ liên tục cho ring outline

### Course / SkillPractice / FullTest selection
- Card chọn part/đề: spotlight + border beam khi hover
- Page header: scroll-reveal stagger

### Auth
- Background particles + aurora orb
- Card form: subtle border glow

### Admin
- Stat cards & tables: hover row glow nhẹ, card spotlight
- Không thêm particles (giữ nhanh, gọn cho admin)

### Navbar / Footer
- Navbar logo: subtle glow pulse
- Nav link active: underline animation đã có, thêm hover scale
- Footer: gradient line trên cùng với animation drift

---

## Đảm bảo không ảnh hưởng exam UI

Cơ chế chặn:
- Các animation mới **chỉ thêm trong các page component liệt kê ở trên**, không đụng đến bất kỳ file `*ExamEngine.tsx`, `ExamHeader.tsx`, `ExamFooter.tsx`, `ExamLayout.tsx`.
- Trang results sau exam: chỉ giữ fade-in đơn giản, không particles.
- Body class `exam-mode` (nếu có) sẽ disable particles globally qua CSS guard `body.exam-mode .particles-bg { display: none }`.

---

## Performance & Accessibility

- Particles: throttle theo `requestAnimationFrame`, pause khi tab inactive, giảm số hạt trên mobile (<768px chỉ 20 hạt)
- Respect `prefers-reduced-motion`: tắt particles, border beam, breathing — chỉ giữ fade nhẹ
- Tất cả component decorative đều `pointer-events-none` và `aria-hidden`
- Không import framer-motion thêm (đã có sẵn)

---

## Technical Details

- **Files mới** (6): `src/components/ui/particles-background.tsx`, `spotlight-card.tsx`, `border-beam.tsx`, `magnetic-button.tsx`, `scroll-reveal.tsx`, `gradient-orb.tsx`
- **Files sửa**:
  - `src/index.css` — thêm keyframes & utilities
  - `tailwind.config.ts` — đăng ký animation
  - `src/pages/Index.tsx`, `Dashboard.tsx`, `Course.tsx`, `Auth.tsx`, `SkillPractice.tsx`, `FullTest.tsx`, `History.tsx`, `Progress.tsx`, `NotFound.tsx`
  - `src/components/layout/Navbar.tsx`, `Footer.tsx`
  - Admin pages (light touch)

Không thêm dependency mới — dùng framer-motion (đã có), Canvas API, CSS thuần.

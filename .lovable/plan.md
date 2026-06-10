## Mục tiêu
Làm lại trang Dashboard cho mang tính **công nghệ, mượt, thân thiện** hơn — đồng bộ với design system "Tech Dark + Red Glow" đã build ở Sprint 1. Không đổi data/logic, chỉ thay UI/layout.

## Vấn đề hiện tại (theo screenshot)
- Hero "Xin chào" lạnh, thiếu điểm nhấn.
- 4 stat cards đơn điệu, icon nhỏ, không có glow.
- Khối streak + skill progress + chart + recent results xếp dọc 1 cột → trang dài lê thê, scroll mệt.
- Không có **Quick Actions** rõ ràng — user vào dashboard không biết bấm gì tiếp theo.
- Chart "Tiến bộ theo thời gian" nền sáng, lệch tone với phần còn lại.
- Card "Kết quả gần đây" dạng list xám, thiếu sinh động.

---

## Layout mới

```text
┌─────────────────────────────────────────────────────────────┐
│  HERO BANNER (AnimatedGrid bg)                              │
│  Xin chào, {name} 👋                                         │
│  Gradient subtitle + 4 stat pills inline (streak/Qs/acc/lvl)│
└─────────────────────────────────────────────────────────────┘

┌──────────────── QUICK ACTIONS (5 cards lưới) ───────────────┐
│  [Thi thử] [Luyện kỹ năng] [Học từ vựng] [Lịch sử] [Khóa h]│
└─────────────────────────────────────────────────────────────┘

┌──────────────── 2-COLUMN GRID (lg:grid-cols-3) ─────────────┐
│  LEFT (col-span-2)              │  RIGHT (col-span-1)       │
│  • Streak command center        │  • Recent results card    │
│  • Skill progress (ring/bar)    │  • CTA "Tiếp tục học"     │
│  • Progress chart (dark theme)  │  • Tip nhỏ / mẹo học      │
└─────────────────────────────────────────────────────────────┘
```

---

## Thay đổi cụ thể

### 1. Hero banner mới
- Wrap trong `relative overflow-hidden rounded-3xl border border-border bg-card/60`, bên trong đặt `<AnimatedGrid />` làm background.
- Heading: `GradientText` cỡ 3xl–4xl, weight 800.
- Sub: nói rõ trạng thái hôm nay ("Bạn đang ở band {level} • streak {n} ngày").
- Inline **StatPill row** (4 ô): Streak 🔥, Câu đã làm, Chính xác %, Trình độ. Mỗi pill có icon trong tròn glow nhỏ.

### 2. Quick Actions (mới — phần thân thiện nhất)
- 5 `GlowCard` ngang nhau (grid 2/3/5 cột responsive):
  - **Thi thử Aptis** → `/thi-thu` (icon Zap, gradient đỏ-cam)
  - **Luyện kỹ năng** → `/practice` (icon Target)
  - **Học từ vựng** → `/vocab` (icon BookOpen, accent teal giữ theme vocab)
  - **Lịch sử bài làm** → `/history` (icon History)
  - **Khóa học 7 ngày** → `/course` (icon GraduationCap)
- Hover: lift + glow đỏ + icon scale, có mô tả 1 dòng dưới label.

### 3. Streak Command Center (cải tiến)
- Card lớn 2 phần:
  - **Trái**: Flame icon to + số streak khổng lồ + thanh tuần T2–CN với dot glow (hôm nay nhấp nháy `animate-glow-pulse`).
  - **Phải**: Mini progress ring SVG hiển thị accuracy hoặc % goal tuần. CTA "Luyện ngay".
- Atrisk state: viền đỏ glow đậm hơn + nút glow-pulse.

### 4. Skill Progress
- Đổi 5 progress bar dọc thành **2 cột grid** với mini bar có gradient theo skill + số % to.
- Highlight skill yếu nhất bằng badge cảnh báo có icon Zap glow.

### 5. ProgressChart (dark theme)
- Edit `src/components/dashboard/ProgressChart.tsx`:
  - Bỏ `glass-card`, thay bằng container đồng bộ với GlowCard.
  - CartesianGrid: `stroke="hsl(var(--border) / 0.3)"`.
  - Tooltip: `background: hsl(var(--background-elevated))`, border glow đỏ.
  - Line stroke giữ màu skill, thêm `strokeWidth={2.5}`, dot lớn hơn + glow.
  - Nền card có radial gradient nhẹ ở góc.

### 6. Recent Results (column phải)
- Mỗi item: avatar tròn gradient theo level (A1/A2/B1/B2/C1) + date + score + level badge glow.
- Hover row → border-l-2 đỏ + slide nhẹ.
- Empty state giữ nguyên nhưng dùng `GlowCard` + CTA `glow` variant.

### 7. Sidekick cards (column phải, dưới Recent)
- **CTA card** "Tiếp tục từ chỗ bạn dừng" với gradient bg + nút glow.
- **Tip card** xoay vòng mẹo học (tĩnh, hardcode 3-4 tip, random 1 cái mỗi reload — chỉ frontend).

### 8. Animation & micro-interactions
- Stagger fade-in cho từng section (`framer-motion`, đã có sẵn).
- Stat pills count-up khi mount (dùng tween đơn giản, không thêm lib).
- Tất cả card có `transition-all duration-300`, hover `-translate-y-0.5 shadow-glow-red`.

---

## Files dự kiến chỉnh sửa
- `src/pages/Dashboard.tsx` — rewrite layout (chính)
- `src/components/dashboard/ProgressChart.tsx` — dark theme + GlowCard
- (Mới) `src/components/dashboard/StatPill.tsx` — pill stat dùng chung
- (Mới) `src/components/dashboard/QuickActionCard.tsx` — card action với glow
- (Mới) `src/components/dashboard/StreakRing.tsx` — SVG ring nhỏ
- Có thể thêm 1 keyframe `count-up-fade` vào `tailwind.config.ts` nếu cần

## KHÔNG đụng
- Logic fetch data, supabase queries, hooks.
- Exam UI, Review pages.
- `Navbar`, `Footer` (đã làm Sprint 1).

Bấm **Implement plan** để mình bắt tay vào Dashboard.

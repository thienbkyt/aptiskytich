## Audit tổng thể — Aptis Kỳ Tích

Mình đã quét toàn bộ codebase. Site hiện đã ổn về visual và đúng chuẩn Aptis 2023, nhưng còn nhiều điểm có thể nâng cấp đáng kể. Dưới đây là báo cáo chi tiết theo 4 mảng + lộ trình triển khai 3 sprint.

---

### Mảng 1 — UX & Performance (frontend)

| # | Vấn đề | File |
|---|---|---|
| 1.1 | Trang `Index` (landing) là route DUY NHẤT không lazy-load → bundle initial bị phình | `src/App.tsx:10` |
| 1.2 | `vite.config.ts` chưa tách chunk cho `@supabase/supabase-js` (~200KB) và `lucide-react` | `vite.config.ts:19-27` |
| 1.3 | `resolveImageUrl` ký URL mới mỗi lần render — không cache (Speaking Part 2/3/4 ký lại liên tục) | `src/lib/imageUrl.ts` |
| 1.4 | Dashboard bắn **17 query song song** mỗi lần mount, không dùng React Query | `src/pages/Dashboard.tsx:102-117` |
| 1.5 | Question renderer (Reading/Listening/Grammar) không `React.memo` → timer tick mỗi giây làm re-render toàn bộ list câu hỏi | các `*ExamEngine.tsx` |
| 1.6 | Ảnh trong Speaking thiếu `loading="lazy"`, `width/height` → CLS | `SpeakingPart2/3/4*.tsx` |
| 1.7 | Suspense fallback là `<div>` trắng — slow connection thấy flash trắng | `src/App.tsx:61` |
| 1.8 | `DictionaryProvider` parse lại localStorage mỗi lần lookup dù đã có Map in-memory | `DictionaryProvider.tsx:180` |

---

### Mảng 2 — Luồng làm bài & xem lại

| # | Vấn đề | File |
|---|---|---|
| 2.1 | **Writing review chưa có UI hiển thị AI feedback** — chỉ Speaking có `SpeakingReviewPage` | thiếu `WritingReviewPage.tsx` |
| 2.2 | `ReviewAnswerPanel` có thể hiển thị raw JSON khi parse fail (Listening/Grammar envelope) | `ReviewAnswerPanel.tsx:256-274` |
| 2.3 | `SpeakingReviewPage` ký lại URL recording mỗi lần mở (không cache sessionStorage) | `SpeakingReviewPage.tsx:47-53` |
| 2.4 | Speaking review chỉ show 3 suggestions, **bỏ phí toàn bộ `criteria` CEFR + `mistakes`** đã có sẵn trong DB | `SpeakingReviewPage.tsx:77-86` |
| 2.5 | Timer state nằm chung với answer state → re-render mỗi giây | `ReadingExamEngine.tsx`, `ListeningExamEngine.tsx` |
| 2.6 | Không có keyboard nav cho MCQ (A/B/C/D), thiếu `role="radio"` + focus ring | tất cả exam engines |
| 2.7 | Không chống double-submit → có thể tạo trùng `test_results` | `src/lib/saveExamResult.ts` |

---

### Mảng 3 — Conversion & Retention

| # | Vấn đề | File |
|---|---|---|
| 3.1 | Streak card không cảnh báo khi user **sắp mất chuỗi** (chưa học hôm nay) | `Dashboard.tsx:261-283` |
| 3.2 | **Không có CTA Zalo/Messenger ở bất kỳ đâu** — trái với chiến lược conversion sub-B2 đã ghi nhớ | toàn site |
| 3.3 | Empty state user mới chỉ là 1 dòng text, không có CTA onboarding | `Dashboard.tsx:341-345` |
| 3.4 | Không có gamification milestone (streak 7/30, 100 câu, badge) dù `longest_streak` đã lưu DB | thiếu logic milestone |
| 3.5 | SEO meta hardcoded, không có per-page title/OG, không JSON-LD `Course` schema | `index.html:9-29` |
| 3.6 | Không có widget "Bài học hôm nay" + chưa wire email reminder vào queue đã có sẵn | Dashboard |

---

### Mảng 4 — Backend cost & performance

| # | Vấn đề | File |
|---|---|---|
| 4.1 | `SELECT *` trên `exam_sets` / `exam_questions` (kéo cả `extra_data` JSONB lớn ở list view) | `useExamSets.ts:53,85`; `questions.ts:27,40` |
| 4.2 | `practice_history` thiếu composite index `(user_id, skill, is_correct)` — Dashboard quét full table 10 lần | DB |
| 4.3 | Edge function `tts` gọi `fetch HEAD` cache check qua HTTP mỗi lần (chậm hơn DB query) | `supabase/functions/tts/index.ts:71-79` |
| 4.4 | `grade-exam` không check grading đã tồn tại trước khi gọi Gemini → user bấm lại = tốn AI quota | `supabase/functions/grade-exam/index.ts` |
| 4.5 | `dictionary-lookup` tạo Supabase client mới mỗi request (lãng phí ~50ms cold path) | `supabase/functions/dictionary-lookup/index.ts:35` |
| 4.6 | `SpeakingReviewPage` query 20 gradings rồi filter JS theo timestamp ±2h — không bền vững | thiếu cột `test_result_id` |
| 4.7 | `has_role()` được gọi 67+ lần trong RLS, không cache → N+1 trên list lớn | DB policies |

---

### Lộ trình đề xuất — 3 sprint

**Sprint 1 — Quick wins user thấy ngay (1-2 ngày)**
1. Writing Review UI hiển thị AI feedback đầy đủ (mirror Speaking) — **#2.1**
2. Speaking Review hiển thị band CEFR + mistakes/criteria — **#2.4**
3. Cache signed URL (image + speaking recording) bằng Map/sessionStorage — **#1.3, #2.3**
4. Chống double-submit — **#2.7**
5. Streak "at-risk" warning + empty state CTA Dashboard — **#3.1, #3.3**
6. Sticky Zalo CTA (Dashboard + sau khi xem kết quả, conditional theo level) — **#3.2**
7. Replace Suspense fallback bằng skeleton — **#1.7**

**Sprint 2 — Performance & cost (2-3 ngày)**
8. Lazy-load `Index`, tách chunk supabase/lucide — **#1.1, #1.2**
9. `React.memo` question renderers + tách Timer state — **#1.5, #2.5**
10. Convert Dashboard query → 1 RPC `get_dashboard_stats` hoặc React Query — **#1.4**
11. Add composite index `practice_history` — **#4.2**
12. Replace `SELECT *` bằng cột cụ thể ở list views — **#4.1**
13. Edge functions: client scope module-level + cache check qua DB row — **#4.3, #4.5**
14. Idempotency guard cho `grade-exam` — **#4.4**

**Sprint 3 — Retention & polish (2-3 ngày)**
15. Gamification milestones + confetti — **#3.4**
16. Widget "Bài học hôm nay" + email reminder streak-break — **#3.6**
17. SEO per-page meta + JSON-LD — **#3.5**
18. Keyboard nav A/B/C/D + ARIA roles — **#2.6**
19. Lazy + width/height cho ảnh exam — **#1.6**
20. Fix `ReviewAnswerPanel` parse guard — **#2.2**
21. Add `test_result_id` column + index cho `exam_gradings`, migrate query — **#4.6**

**Có thể hoãn (cần thảo luận):**
- **#4.7** RLS `has_role` JWT custom claim — chạm auth flow, rủi ro cao, chỉ làm khi có dấu hiệu DB chậm thật.

---

### Đề xuất bắt đầu

Mình recommend **bắt đầu từ Sprint 1** vì 7 mục này:
- User feel được ngay (Writing review, Zalo CTA, streak warning)
- Không đụng schema DB
- Risk thấp, ROI cao

Sau khi Sprint 1 xong và bạn confirm, mình sẽ tiếp Sprint 2 (perf) và Sprint 3 (retention).

**Bạn muốn mình triển khai theo thứ tự này, hay đảo ưu tiên?** Ví dụ nếu bạn muốn Sprint 2 trước (vì lo cost AI/DB) thì mình swap.

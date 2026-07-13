
# Phase 1b — Chấm bài hoàn toàn bất đồng bộ

Mục tiêu: sau khi học viên bấm Nộp, mọi thứ chạy nền qua `grading_jobs`. Đóng tab, mất mạng, refresh → không bao giờ mất bài, không bao giờ 0 điểm oan.

Chia làm 3 lượt nhỏ để giảm rủi ro. Mỗi lượt đều build & test được độc lập.

---

## Lượt 1b-A — Upload audio Speaking lên storage + worker đọc từ storage

**Mục tiêu:** Payload trong `grading_jobs` không còn chứa audio base64 (nặng, dễ vỡ jsonb, tốn băng thông upload/download).

Thay đổi:

1. Bucket `speaking-recordings` (đã có, private) — thêm RLS: user chỉ đọc/ghi file của chính mình theo prefix `<user_id>/…`.
2. `src/lib/speakingUpload.ts` (mới): `uploadSpeakingBlob(blob, sessionId, part, idx)` → trả về `path`.
3. `src/components/speaking/speakingGradingV2.ts` (`gradeSpeakingPartV2`) — thêm chế độ enqueue:
   - Upload từng blob → thu path[]
   - Gọi `grade-exam` như hiện tại nhưng nếu fail → enqueue `grading_jobs` với payload `{ type: "speaking_v2", partType, questions, audioPaths }` (không phải base64).
4. `process-grading-jobs` (worker): khi payload có `audioPaths`, dùng service-role tải file từ bucket → convert base64 → thay vào payload `audios` → gọi `grade-exam`.

Không đổi UX. Chỉ đổi kênh dữ liệu cho audio.

---

## Lượt 1b-B — Chuyển submit sang enqueue-only + UI polling

**Mục tiêu:** Client không đợi `grade-exam` nữa. Nộp = tạo job → hiển thị "Đang chấm…" → poll job.status → khi `done` mới render kết quả.

Thay đổi:

1. `src/hooks/useGradingJob.ts` (mới): tạo job, poll `grading_jobs` mỗi 3s (dùng Realtime nếu có; fallback setInterval), trả về `{ status, rawResponse, error }`.
2. `SkillFullPracticeEngine.tsx` + `FullTestEngine.tsx` (writing & speaking path):
   - Bỏ chờ `gradeXxxPartV2` trả về; thay bằng tạo N job (1 mỗi part) rồi chuyển sang màn "Đang chấm 3/4 part…".
   - Khi tất cả job `done`, lấy `raw_response` của từng job → chạy y hệt logic hiện tại (upsert `*_question_gradings`, finalize `*_skill_results`, update `test_results`).
3. Màn kết quả có nút **"Chấm lại"** khi 1 part `failed` — set job về `pending`, `attempts=0` (chỉ owner).

**Không** finalize server-side ở lượt này để giảm rủi ro — server chỉ trả `raw_response`, client vẫn là nơi ráp kết quả cuối. Điều đó có nghĩa: nếu học viên đóng tab trước khi tất cả part xong, các bản ghi phần đã xong vẫn có (worker đã chấm), nhưng skill_result cuối cùng sẽ được ráp lần tiếp theo họ mở lại History → tự động finalize.

---

## Lượt 1b-C — Finalize server-side (worker tự ráp khi đủ 4 part)

**Mục tiêu:** Không cần học viên mở lại History để `test_results` được cập nhật.

Thay đổi:

1. Trong `process-grading-jobs`, sau khi mark job `done`, kiểm tra: cùng `test_result_id` + skill có đủ 4 part `done` chưa. Nếu đủ:
   - Upsert `*_question_gradings` (partial unique index đã có → an toàn với retry).
   - Gọi `grade-exam` (`writing_finalize` / `speaking_finalize`) với `rawParts`.
   - Upsert `*_skill_results` (unique theo `full_test_session_id` đã có).
   - Update `test_results.score / total / level`.
2. Client `useGradingJob` không còn cần tự ráp; chỉ đọc `*_skill_results` khi thấy job cuối `done`.
3. Bỏ hoàn toàn code ráp client trong `SkillFullPracticeEngine` / `FullTestEngine` (cleanup).

---

## Ngoài phạm vi 1b (giữ cho Phase 2/3 sau)

- Admin dashboard "Sức khoẻ chấm bài" (fail rate, danh sách failed, retry hàng loạt).
- Auto-alert email admin khi fail>10%/24h hoặc pending>30 phút.
- End-to-end test 5 bài + tắt mạng test.

---

## Kỹ thuật ngắn gọn

- **Bucket path:** `speaking-recordings/<user_id>/<session_id>/<partType>/<idx>.webm` — khớp với `<user_id>/…` để RLS đơn giản.
- **Worker fetch audio:** `admin.storage.from("speaking-recordings").download(path)` → arrayBuffer → base64.
- **Realtime polling:** kênh `postgres_changes` trên `grading_jobs` filter `user_id=eq.<uid>`; fallback `setInterval(3000)` nếu không kết nối được.
- **Idempotency:** mọi upsert dựa vào unique index đã tạo ở migration trước. Retry không nhân đôi điểm.
- **Rollback:** mỗi lượt là 1 migration + 1 flag `VITE_GRADING_ASYNC` (mặc định false ở 1b-A, bật true ở 1b-B). Có thể tắt nhanh nếu vỡ.

Cho tôi biết duyệt lượt nào trước (đề xuất **1b-A** để giảm ngay áp lực payload jsonb) hay chỉnh scope.

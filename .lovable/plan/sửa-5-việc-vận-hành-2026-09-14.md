# Sửa 5 việc vận hành

## 1. Bài chấm lỗi không còn mất trắng

- Bước tách lời nói (transcribe) được cho thêm thời gian: 120 giây thay vì 60 giây.
- Khi lỗi là hết thời gian / mất mạng / lỗi tạm của máy chủ: bài **không** bị đánh dấu thất bại nữa. Bài quay lại hàng đợi và được thử lại sau 10 phút × số lần đã thử (thêm cột `next_run_at`), số lần thử tối đa nâng từ 3 lên 6.
- Chỉ khi lỗi là lỗi vĩnh viễn (hết hạn mức, dữ liệu sai) hoặc đã quá 6 lần thì mới ghi thất bại; lúc đó lưu lý do vào `test_results.grade_payload` dạng `{"status":"failed","reason":...,"part":...}`.
- Hàm nhận việc `claim_grading_jobs` chỉ lấy bài có `next_run_at <= now()`.
- Hàm mới `requeue_grading_jobs(_test_result_id)`: chủ bài hoặc admin gọi được, đưa mọi bài lỗi của lượt đó về hàng đợi (đếm số lần đã đưa lại, tối đa 3 lần/bài qua cột `requeue_count`), trả về số bài đã reset.
- Màn xem lại Speaking và Writing: nếu bài có việc chấm lỗi mà chưa có kết quả kỹ năng thì hiện hộp "Chấm bài bị lỗi, bấm để chấm lại" + nút gọi hàm trên, rồi chuyển sang trạng thái "đang chấm". Không bao giờ hiện điểm 0.

## 2. Mở đề trống → báo nâng cấp đúng chỗ

Trong `fetchExamQuestions`: khi đề không trả câu nào, đọc thêm hạng của đề và hạng của người dùng.
- Đề Pro + người dùng chưa Pro/admin → lỗi `NEED_UPGRADE`, các trang mở đúng hộp nâng cấp Pro đang có.
- Lỗi mạng/quá thời gian → thông báo "Mất kết nối, thử lại" kèm nút thử lại.
- Còn lại mới hiện "đề chưa sẵn sàng".
Không đổi quyền truy cập dữ liệu, không đổi cách ghi log.

## 3. Dọn ghi âm thật sự chạy

- Lịch chạy hằng giờ, gọi bằng khóa máy chủ lấy từ vault, thời gian chờ 300 giây (thay vì 5 giây).
- Hàm dọn: mỗi lần xóa tối đa 2.000 tệp cũ hơn 45 ngày qua storage API, xóa cả dòng dữ liệu tương ứng, trả về `{scanned, deleted, remaining}`.
- Thêm nhánh cho tệp luồng chấm mới (`<user>/<session>/<part>/<idx>.webm`): xóa khi quá 7 ngày và người dùng đó không còn việc chấm đang chờ/đang chạy trong 7 ngày gần nhất.

## 4. Tự dọn log

Lịch 03:30 hằng ngày: xóa `usage_events` cũ hơn 90 ngày (theo lô 20.000, tối đa 10 lô/lần) và `client_error_logs` cũ hơn 60 ngày. Không đụng kết quả bài làm.

## 5. Đơn chưa thanh toán quá hạn

Lịch 04:00 hằng ngày: đơn `pending` chưa trả tiền và quá 3 ngày → chuyển `expired`.
Đã kiểm tra: mọi báo cáo doanh thu và việc cấp gói chỉ đếm đơn `paid`, nên trạng thái mới không ảnh hưởng. Bảng đơn không có ràng buộc giá trị nên thêm `expired` an toàn.

## Chi tiết kỹ thuật

- Migration: cột `grading_jobs.next_run_at`, `requeue_count`; `max_attempts` default 6; sửa `claim_grading_jobs` (bỏ nhánh tự đánh thất bại khi hết attempts nếu chưa quá 6, lọc `next_run_at`); RPC mới `requeue_grading_jobs` (SECURITY DEFINER, grant authenticated); 2 job pg_cron mới (03:30, 04:00) + cập nhật job 201.
- Edge functions: `process-grading-jobs/index.ts` (timeout 120s bước 1, logic lùi giờ thay vì failed, ghi `grade_payload` khi thất bại thật), `cleanup-old-recordings/index.ts` (giới hạn 2.000/lần, xóa dòng DB, nhánh V2).
- Frontend: `src/hooks/useExamSets.ts`, `src/lib/examLoadError.ts`, 4 trang kỹ năng + `FullTestEngine`/`SkillFullPracticeEngine` cho nhánh NEED_UPGRADE/fetch_failed; `src/hooks/useWritingGradingStatus.ts` (nút requeue), `src/components/history/HistoryReviewRenderer.tsx`, `src/components/history/SpeakingReviewPage.tsx`, `WritingGradingStatusBanner`.
- Kiểm chứng cuối: gọi `requeue_grading_jobs` với 1 lượt của admin và báo lại số job về `pending`.

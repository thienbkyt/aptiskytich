

## Cải thiện UX ghi âm Speaking

### Vấn đề hiện tại
- Nút "Bắt đầu ghi âm" có hiển thị nhưng thiếu hướng dẫn rõ ràng cho user
- Khi mic bị chặn hoặc lỗi, không có thông báo nào cho user biết
- Không có bước kiểm tra mic trước khi bắt đầu bài thi
- Trong preview iframe, microphone có thể bị chặn mà user không biết

### Plan

**1. Thêm trạng thái lỗi microphone trong `useAudioRecording`**
- Thêm state `micError` để track khi `getUserMedia` thất bại
- Return `micError` từ hook để component có thể hiển thị thông báo

**2. Cải thiện `AudioRecorder` UI**
- Hiển thị thông báo lỗi khi mic bị từ chối (alert đỏ với hướng dẫn cách bật lại)
- Thêm text hướng dẫn nhỏ bên dưới nút ghi âm: "Nhấn nút và cho phép truy cập microphone khi trình duyệt yêu cầu"
- Hiển thị trạng thái "Đang yêu cầu quyền mic..." khi đang chờ permission

**3. Thêm bước kiểm tra mic trong `ExamInstructions` cho Speaking**
- Thêm nút "Kiểm tra microphone" trên trang hướng dẫn trước khi bắt đầu
- Nếu mic hoạt động: hiển thị checkmark xanh "Microphone sẵn sàng"
- Nếu mic lỗi: hiển thị cảnh báo đỏ với hướng dẫn

### Files cần chỉnh sửa
- `src/hooks/useAudioRecording.tsx` — thêm `micError` state và `micPermissionStatus`
- `src/components/speaking/AudioRecorder.tsx` — thêm error UI và hướng dẫn
- `src/components/speaking/SpeakingExamEngine.tsx` — thêm mic check ở trang instructions


## AI Coach – Trợ lý hỏi đáp Aptis

Floating chatbot ở góc phải toàn site (tương tự ZaloFab hiện có), trả lời mọi câu hỏi về Aptis: cấu trúc đề, mẹo làm bài, giải thích câu hỏi cụ thể, gợi ý lộ trình học. AI tự nhận ngữ cảnh trang user đang xem để trả lời chính xác mà không cần share màn hình.

### 1. UI – Floating Coach (toàn site)

- **`AICoachFab.tsx`**: nút tròn glow đỏ ở góc phải-dưới (nằm trên ZaloFab), icon Bot/Sparkles, badge "AI".
- **`AICoachPanel.tsx`**: panel chat trượt từ phải (width ~420px desktop, full-screen mobile), header có tên "Coach Kỳ Tích" + nút đóng + nút "Cuộc trò chuyện mới".
- **Message list**: render `message.parts` qua `react-markdown` (hỗ trợ code block, list, bold).
- **Composer**: textarea auto-resize + nút gửi, disable khi đang streaming, Enter để gửi (Shift+Enter xuống dòng).
- **Empty state**: 4 suggested prompts theo trang hiện tại (vd ở `/grammar`: "Giải thích thì hiện tại hoàn thành", "Mẹo làm Grammar Part 1"...).
- **Tone**: theo "Tech Dark + Red Glow" – nền `background-elevated`, viền glow đỏ, font Montserrat, animation slide-in mượt.
- Mount trong `App.tsx` cạnh `ZaloFab` để hiện ở mọi route (ẩn trong exam full-screen để không phá tập trung).

### 2. Context Awareness (auto, không cần share màn hình)

Tạo `useCoachContext()` hook gom thông tin trang hiện tại và đính kèm vào mỗi request:

- **Route info**: pathname, tên skill (grammar/reading/...), part đang luyện.
- **Question context** (khi đang ở exam/practice): question ID, đề bài, các đáp án, đáp án user chọn, đáp án đúng, explanation – đọc từ React context của exam engine hiện có.
- **Dashboard context** (khi ở `/dashboard`): điểm yếu nhất, accuracy theo skill (đã có sẵn trong Dashboard).
- **User profile nhẹ**: level mục tiêu (nếu có trong profile).

Context được serialize thành JSON gọn và gửi kèm trong body request (không nhét vào messages để tránh phình history).

### 3. Backend – Edge Function streaming

- **`supabase/functions/ai-coach/index.ts`**: dùng AI SDK + Lovable AI Gateway helper (`createLovableAiGatewayProvider`), model mặc định `google/gemini-3-flash-preview`.
- **System prompt** (tiếng Việt) định nghĩa: chuyên gia Aptis General, trả lời ngắn gọn dễ hiểu cho học viên VN trình độ A2–B2, ưu tiên ví dụ thực tế, format markdown, đính kèm tips học và CTA Zalo khi phù hợp.
- Nhận `{ messages: UIMessage[], context: CoachContext }`, chèn context vào system message động.
- Stream về client qua `toUIMessageStreamResponse()`. CORS headers chuẩn.
- Rate limit nhẹ: max 30 req/phút/user (in-memory map theo user id từ JWT) để tránh đốt credit; trả 429 với message rõ ràng.
- Verify JWT (yêu cầu đăng nhập). User chưa login → FAB hiện modal mời đăng nhập.

### 4. Client transport

- `useChat` từ `@ai-sdk/react` với `DefaultChatTransport`:
  - `api`: `${VITE_SUPABASE_URL}/functions/v1/ai-coach`
  - Header `Authorization: Bearer <session token>` (lấy từ supabase session, không dùng publishable key vì cần user identity).
  - Truyền `body: () => ({ context: currentContext })` để mỗi lượt gửi đính kèm snapshot context mới nhất.
- Status `submitted`/`streaming` → show shimmer "Đang suy nghĩ...".
- Lưu messages ở React state (session-only, mất khi reload theo lựa chọn của bạn). Nút "Cuộc trò chuyện mới" clear state.

### 5. Lộ trình học cá nhân hóa

Khi user hỏi "lộ trình học cho tôi" và context dashboard có sẵn → AI dùng dữ liệu accuracy/điểm yếu để gợi ý cụ thể (vd "Bạn yếu Listening Part 3, làm 3 bài/ngày trong 2 tuần..."). Không cần tool calling phức tạp; chỉ inject dữ liệu vào context.

### 6. Files

**New**
- `src/components/ai-coach/AICoachFab.tsx`
- `src/components/ai-coach/AICoachPanel.tsx`
- `src/components/ai-coach/MessageBubble.tsx`
- `src/components/ai-coach/SuggestedPrompts.tsx`
- `src/hooks/useCoachContext.ts`
- `supabase/functions/ai-coach/index.ts`

**Edit**
- `src/App.tsx` – mount FAB toàn cục, ẩn trên route exam full-screen.
- `package.json` – thêm `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `react-markdown` nếu chưa có.

### 7. Không làm trong MVP này

- Live screen share / WebRTC.
- Lưu lịch sử chat vào DB (theo lựa chọn session-only).
- Tool calling (web search, tra từ điển) – có thể thêm v2.
- Voice input/output.

### Chi phí & rủi ro

- Gemini Flash rất rẻ; rate limit 30/phút/user + giới hạn 20 message gần nhất gửi lên model để khống chế token.
- Context exam có thể chứa đáp án đúng → AI sẽ giải thích đúng/sai chính xác (đây là mong muốn).
- AI chỉ trigger khi user mở chat & gửi tin nhắn (tuân thủ rule "AI strictly user-triggered").

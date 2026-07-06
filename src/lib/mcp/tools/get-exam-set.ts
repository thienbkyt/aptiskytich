import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_exam_set",
  title: "Chi tiết đề Aptis",
  description:
    "Lấy chi tiết một đề Aptis đã công bố kèm danh sách câu hỏi. Chỉ trả kết quả cho đề is_published = true.",
  inputSchema: {
    exam_set_id: z.string().uuid().describe("UUID của exam_set (lấy từ list_exam_sets)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ exam_set_id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: examSet, error: setErr } = await supabase
      .from("exam_sets")
      .select("id, title, skill, part, exam_type, time_limit, description, is_published")
      .eq("id", exam_set_id)
      .eq("is_published", true)
      .maybeSingle();
    if (setErr) {
      return { content: [{ type: "text", text: `Lỗi: ${setErr.message}` }], isError: true };
    }
    if (!examSet) {
      return {
        content: [{ type: "text", text: "Không tìm thấy đề, hoặc đề chưa được công bố." }],
        isError: true,
      };
    }
    const { data: questions, error: qErr } = await supabase
      .from("exam_questions")
      .select("id, order_index, question_text, question_type, options, correct_answer")
      .eq("exam_set_id", exam_set_id)
      .order("order_index", { ascending: true });
    if (qErr) {
      return { content: [{ type: "text", text: `Lỗi: ${qErr.message}` }], isError: true };
    }
    const payload = { exam_set: examSet, questions: questions ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

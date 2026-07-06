import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_exam_sets",
  title: "Danh sách đề Aptis đã công bố",
  description:
    "Liệt kê các đề luyện thi Aptis đã được công bố (is_published = true) trên Aptis Kỳ Tích. Có thể lọc theo kỹ năng (reading, listening, writing, speaking, grammar) và part.",
  inputSchema: {
    skill: z
      .enum(["reading", "listening", "writing", "speaking", "grammar"])
      .nullable()
      .describe("Lọc theo kỹ năng. Truyền null để lấy tất cả."),
    part: z.string().nullable().describe("Lọc theo part (ví dụ '1'). Truyền null để lấy tất cả."),
    limit: z.number().int().min(1).max(50).describe("Số lượng đề tối đa trả về (1–50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ skill, part, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("exam_sets")
      .select("id, title, skill, part, exam_type, time_limit, description, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (skill) q = q.eq("skill", skill);
    if (part) q = q.eq("part", part);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Lỗi: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { exam_sets: data ?? [] },
    };
  },
});

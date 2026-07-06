import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_vocabulary",
  title: "Tra từ vựng Aptis",
  description:
    "Tìm một từ tiếng Anh trong bộ từ vựng Aptis Kỳ Tích. Trả về phiên âm, nghĩa tiếng Việt, ví dụ và họ từ.",
  inputSchema: {
    word: z.string().min(1).describe("Từ tiếng Anh cần tra (ví dụ: 'reliable')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ word }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("system_vocab_words")
      .select("word, phonetic, meaning, example_en, example_vi, word_family")
      .ilike("word", word.trim())
      .limit(5);
    if (error) {
      return { content: [{ type: "text", text: `Lỗi: ${error.message}` }], isError: true };
    }
    if (!data?.length) {
      return {
        content: [{ type: "text", text: `Không tìm thấy "${word}" trong bộ từ vựng Aptis Kỳ Tích.` }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { results: data },
    };
  },
});

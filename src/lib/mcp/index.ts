import { defineMcp } from "@lovable.dev/mcp-js";
import searchVocabulary from "./tools/search-vocabulary";
import listExamSets from "./tools/list-exam-sets";
import getExamSet from "./tools/get-exam-set";

export default defineMcp({
  name: "aptis-ky-tich-mcp",
  title: "Aptis Kỳ Tích MCP",
  version: "0.1.0",
  instructions:
    "Công cụ truy cập nội dung công khai của Aptis Kỳ Tích — nền tảng luyện thi Aptis General cho người Việt. " +
    "Dùng `search_vocabulary` để tra từ vựng, `list_exam_sets` để duyệt các đề đã công bố theo kỹ năng/part, " +
    "và `get_exam_set` để lấy chi tiết câu hỏi của một đề. Chỉ dữ liệu is_published = true được trả về.",
  tools: [searchVocabulary, listExamSets, getExamSet],
});

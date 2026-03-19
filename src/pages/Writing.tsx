import SkillPageLayout from "@/components/SkillPageLayout";
import { PenLine } from "lucide-react";

const Writing = () => (
  <SkillPageLayout
    skill="writing"
    title="Phần thi Writing"
    description="Luyện viết theo format bài thi Aptis Writing. Làm quen với các dạng bài viết và luyện tập viết với thời gian giống bài thi thật."
    timeLimit="50 phút"
    icon={PenLine}
    accentColor="pink"
    parts={[
      { id: "part1", label: "Part 1", subtitle: "Short answers", dbPart: "Part 1 – Short messages" },
      { id: "part2", label: "Part 2", subtitle: "Social media response", dbPart: "Part 2 – Fill form" },
      { id: "part3", label: "Part 3", subtitle: "Informal email", dbPart: "Part 3 – Informal email" },
      { id: "part4", label: "Part 4", subtitle: "Formal email", dbPart: "Part 4 – Formal letter" },
    ]}
    questionEmoji="✍️"
    questionLabel="câu hỏi"
    searchPlaceholder="Tìm kiếm bộ đề Writing..."
  />
);

export default Writing;

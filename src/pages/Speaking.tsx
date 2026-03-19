import SkillPageLayout from "@/components/SkillPageLayout";
import { Mic } from "lucide-react";

const Speaking = () => (
  <SkillPageLayout
    skill="speaking"
    title="Phần thi Speaking"
    description="Luyện nói qua các đề thi với format Aptis Speaking. Làm quen với 4 phần của bài thi nói và luyện tập trả lời với thời gian giống bài thi thật."
    timeLimit="12 phút"
    icon={Mic}
    accentColor="orange"
    parts={[
      { id: "part1", label: "Part 1", subtitle: "Personal Questions", dbPart: "Part 1 – Personal Questions" },
      { id: "part2", label: "Part 2", subtitle: "Describe a Picture", dbPart: "Part 2 – Describe a Picture" },
      { id: "part3", label: "Part 3", subtitle: "Compare Pictures", dbPart: "Part 3 – Compare Pictures" },
      { id: "part4", label: "Part 4", subtitle: "Opinion Questions", dbPart: "Part 4 – Opinion Questions" },
    ]}
    questionEmoji="🎤"
    questionLabel="câu hỏi"
    searchPlaceholder="Tìm kiếm bộ đề Speaking..."
  />
);

export default Speaking;

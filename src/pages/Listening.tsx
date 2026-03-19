import SkillPageLayout from "@/components/SkillPageLayout";
import { Headphones } from "lucide-react";

const Listening = () => (
  <SkillPageLayout
    skill="listening"
    title="Phần thi Listening"
    description="Luyện nghe theo format bài thi Aptis Listening. Làm quen với các dạng câu hỏi và luyện tập với audio giống bài thi thật."
    timeLimit="35 phút"
    icon={Headphones}
    accentColor="violet"
    parts={[
      { id: "part1", label: "Part 1", subtitle: "Word recognition", dbPart: "Part 1 – Word recognition" },
      { id: "part2", label: "Part 2", subtitle: "Matching information", dbPart: "Part 2 – Matching information" },
      { id: "part3", label: "Part 3", subtitle: "Short conversations", dbPart: "Part 3 – Short conversations" },
      { id: "part4", label: "Part 4", subtitle: "Monologues", dbPart: "Part 4 – Monologues" },
    ]}
    questionEmoji="🎧"
    questionLabel="câu hỏi"
    searchPlaceholder="Tìm kiếm bộ đề Listening..."
  />
);

export default Listening;

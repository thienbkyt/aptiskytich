import SkillPageLayout from "@/components/SkillPageLayout";
import { BookOpen } from "lucide-react";

const Reading = () => (
  <SkillPageLayout
    skill="reading"
    title="Phần thi Reading"
    description="Luyện đọc hiểu theo format bài thi Aptis Reading. Làm quen với các dạng câu hỏi và nâng cao kỹ năng đọc nhanh."
    timeLimit="30 phút"
    icon={BookOpen}
    accentColor="blue"
    parts={[
      { id: "part1", label: "Part 1", subtitle: "Sentence comprehension", dbPart: "Part 1 – Sentence comprehension" },
      { id: "part2", label: "Part 2", subtitle: "Text cohesion", dbPart: "Part 2 – Text cohesion" },
      { id: "part3", label: "Part 3", subtitle: "Opinion matching", dbPart: "Part 3 – Opinion matching" },
      { id: "part4", label: "Part 4", subtitle: "Long reading", dbPart: "Part 4 – Long reading" },
    ]}
    questionEmoji="📖"
    questionLabel="câu hỏi"
    searchPlaceholder="Tìm kiếm bộ đề Reading..."
  />
);

export default Reading;

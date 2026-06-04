import type { QuestionItem } from "@/components/reading/BottomNavBar";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface ExamInstructionsProps {
  skillName: string;
  timeLeft?: number;
  totalTime?: number;
  totalParts: number;
  totalMinutes: number;
  onStart: () => void;
  sections?: QuestionSection[];
  testTitle?: string;
  description?: string;
}

const ExamInstructions = ({
  skillName,
  totalParts,
  totalMinutes,
  onStart,
  testTitle,
  description,
}: ExamInstructionsProps) => {
  return (
    <div className="min-h-screen bg-white pl-[60px] pt-[40px] font-sans text-black">
      <p className="text-sm text-gray-500 mb-2">Aptis General Practice Test</p>
      <h1 className="text-xl font-bold text-black">
        {skillName} Practice Test
      </h1>
      {description ? (
        <p className="text-sm text-gray-500 mt-1 mb-6">{description}</p>
      ) : (
        <div className="mb-6" />
      )}
      <div className="flex gap-16 mb-6">
        <div>
          <p className="text-xs text-gray-500 mb-1">Number of Questions</p>
          <p className="text-sm font-bold text-black">{totalParts}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Time Allowed</p>
          <p className="text-sm font-bold text-black">{totalMinutes} min</p>
        </div>
      </div>
      <button
        onClick={onStart}
        className="bg-[#2D1B69] text-white text-sm rounded-md px-6 py-2.5 hover:bg-[#1f1149] transition-colors"
      >
        Start Assessment
      </button>
    </div>
  );
};

export default ExamInstructions;

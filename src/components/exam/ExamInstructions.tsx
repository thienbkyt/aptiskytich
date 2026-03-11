import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
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
  description?: string;
}

const ExamInstructions = ({
  skillName,
  timeLeft,
  totalTime = 600,
  totalParts,
  totalMinutes,
  onStart,
  sections = [],
  description,
}: ExamInstructionsProps) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {timeLeft !== undefined && (
        <div className="flex justify-end mb-8">
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-start max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">
          Aptis General {skillName} Instructions
        </h1>
        <h2 className="text-base font-heading font-bold text-foreground mb-4">{skillName}</h2>
        <p className="text-sm text-foreground mb-2">
          The test has {totalParts} parts.
        </p>
        <p className="text-sm text-foreground mb-6">
          You have {totalMinutes} minutes to complete the test.
        </p>
        {description && (
          <p className="text-sm text-muted-foreground mb-6">{description}</p>
        )}
        <p className="text-sm text-foreground">
          When you click on the 'Next' button, the test will begin.
        </p>
      </div>

      <BottomNavBar
        isFirst={true}
        isLast={false}
        onNext={onStart}
        sections={sections}
      />
    </div>
  );
};

export default ExamInstructions;

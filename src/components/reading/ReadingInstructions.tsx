import { ArrowRight } from "lucide-react";
import TimerDisplay from "./TimerDisplay";
import BottomNavBar from "./BottomNavBar";

interface ReadingInstructionsProps {
  timeLeft?: number;
  totalTime?: number;
  totalParts: number;
  totalMinutes: number;
  onStart: () => void;
}

const ReadingInstructions = ({ timeLeft, totalTime = 600, totalParts, totalMinutes, onStart, sections = [] }: ReadingInstructionsProps) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {/* Timer top-right */}
      {timeLeft !== undefined && (
        <div className="flex justify-end mb-8">
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
        </div>
      )}

      {/* Instructions */}
      <div className="flex-1 flex flex-col justify-start max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">
          Aptis General Reading Instructions
        </h1>
        <h2 className="text-base font-heading font-bold text-foreground mb-4">Reading</h2>
        <p className="text-sm text-foreground mb-2">
          The test has {totalParts} parts.
        </p>
        <p className="text-sm text-foreground mb-6">
          You have {totalMinutes} minutes to complete the test.
        </p>
        <p className="text-sm text-foreground">
          When you click on the 'Next' button, the test will begin.
        </p>
      </div>

      {/* Fixed bottom bar */}
      <BottomNavBar
        isFirst={true}
        isLast={false}
        onNext={onStart}
        sections={sections}
      />
    </div>
  );
};

export default ReadingInstructions;

import { Button } from "@/components/ui/button";
import { ArrowRight, Clock } from "lucide-react";

interface ReadingInstructionsProps {
  timeLeft?: number;
  totalParts: number;
  totalMinutes: number;
  onStart: () => void;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const ReadingInstructions = ({ timeLeft, totalParts, totalMinutes, onStart }: ReadingInstructionsProps) => {
  return (
    <div className="min-h-[70vh] flex flex-col">
      {/* Timer */}
      {timeLeft !== undefined && (
        <div className="flex justify-end mb-6">
          <div className="text-right">
            <div className="font-mono text-2xl font-bold text-foreground tracking-wider">
              {formatTime(timeLeft)}
            </div>
            <div className="text-xs text-muted-foreground border-t-2 border-primary pt-1">
              Time remaining
            </div>
          </div>
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

      {/* Bottom bar */}
      <div className="border-t border-border bg-background py-4 flex items-center justify-end mt-auto">
        <Button
          onClick={onStart}
          className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
        >
          Next <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ReadingInstructions;

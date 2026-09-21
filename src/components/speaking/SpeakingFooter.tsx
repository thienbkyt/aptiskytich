import { List, Info, Accessibility, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpeakingFooterProps {
  onNext?: () => void;
  nextDisabled?: boolean;
  onExit?: () => void;
  showNext?: boolean;
}

const SpeakingFooter = ({ onNext, nextDisabled = true, onExit, showNext = true }: SpeakingFooterProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-exam-surface border-t border-exam-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Left tools */}
        <div className="flex items-center gap-1">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-exam-border hover:bg-exam-border/30 transition-colors">
            <List className="w-4 h-4 text-exam-text-muted" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-exam-border hover:bg-exam-border/30 transition-colors">
            <Info className="w-4 h-4 text-exam-text-muted" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-exam-border hover:bg-exam-border/30 transition-colors">
            <Accessibility className="w-4 h-4 text-exam-text-muted" />
          </button>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-exam-border hover:bg-exam-border/30 transition-colors"
            >
              <LogOut className="w-4 h-4 text-exam-text-muted" />
            </button>
          )}
          {showNext && onNext && (
            <Button
              onClick={onNext}
              disabled={nextDisabled}
              className="bg-exam-accent hover:bg-exam-accent/90 text-white px-6 gap-2 disabled:opacity-40"
            >
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingFooter;

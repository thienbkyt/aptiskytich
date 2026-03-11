import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, List, Info, PersonStanding, LogOut } from "lucide-react";

interface BottomNavBarProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  submitLabel?: string;
}

const BottomNavBar = ({ onPrevious, onNext, onSubmit, isFirst, isLast, submitLabel = "Submit" }: BottomNavBarProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] border-primary bg-background/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: icon buttons */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <List className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <Info className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <PersonStanding className="w-4 h-4" />
          </button>
        </div>

        {/* Right: navigation */}
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
          {!isFirst && onPrevious && (
            <Button
              variant="outline"
              onClick={onPrevious}
              className="gap-2 border-foreground text-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </Button>
          )}
          {isLast && onSubmit ? (
            <Button
              onClick={onSubmit}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
            >
              {submitLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          ) : onNext ? (
            <Button
              onClick={onNext}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BottomNavBar;

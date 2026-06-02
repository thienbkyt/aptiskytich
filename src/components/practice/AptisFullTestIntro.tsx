import { LogOut, User, List, Info, Accessibility, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AptisFullTestIntroProps {
  skillLabel: string;
  testTitle: string;
  numberOfQuestions: number;
  timeAllowedMinutes: number;
  description?: string;
  onStart: () => void;
  onExit?: () => void;
}

const AptisFullTestIntro = ({
  skillLabel,
  testTitle,
  numberOfQuestions,
  timeAllowedMinutes,
  description,
  onStart,
  onExit,
}: AptisFullTestIntroProps) => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <header className="w-full border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="grid grid-cols-2 gap-1">
          <span className="w-3 h-3 rounded-full bg-[#24085a]" />
          <span className="w-3 h-3 rounded-full bg-[#24085a]" />
          <span className="w-3 h-3 rounded-full bg-[#24085a]" />
          <span className="w-3 h-3 rounded-full bg-[#24085a]" />
        </div>
        <div className="w-7 h-7 rounded-full border border-[#24085a] flex items-center justify-center text-[#24085a]">
          <User className="w-4 h-4" />
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-neutral-800 mb-1">Aptis General Practice Test</p>
          <h1 className="text-2xl font-bold text-neutral-900 mb-8">
            {testTitle}
          </h1>

          <div className="grid grid-cols-2 gap-8 mb-8 max-w-md">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Number of Questions</p>
              <p className="text-base font-bold text-neutral-900">{numberOfQuestions}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Time Allowed</p>
              <p className="text-base font-bold text-neutral-900">{timeAllowedMinutes} min</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-sm font-bold text-neutral-900 mb-2">Assessment Description</p>
            {description && (
              <p className="text-sm text-neutral-700 whitespace-pre-line">{description}</p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom bar — matches instructions page */}
      <footer className="border-t border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-md border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-50" aria-label="Sections">
            <List className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-md border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-50" aria-label="Info">
            <Info className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-md border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-50" aria-label="Accessibility">
            <Accessibility className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="w-10 h-10 rounded-md border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-50"
              aria-label="Exit"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <Button
            onClick={onStart}
            className="bg-[#24085a] hover:bg-[#1a0644] text-white rounded-md px-5 py-5 text-sm font-semibold gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default AptisFullTestIntro;

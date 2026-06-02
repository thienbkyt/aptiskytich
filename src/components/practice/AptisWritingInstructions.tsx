import { LogOut, User, List, Info, Accessibility, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AptisWritingInstructionsProps {
  totalMinutes: number;
  recommendedTimes?: { label: string; minutes: number }[];
  onNext: () => void;
  onExit?: () => void;
}

const DEFAULT_TIMES = [
  { label: "Part One", minutes: 3 },
  { label: "Part Two", minutes: 7 },
  { label: "Part Three", minutes: 10 },
  { label: "Part Four", minutes: 30 },
];

const AptisWritingInstructions = ({
  totalMinutes,
  recommendedTimes = DEFAULT_TIMES,
  onNext,
  onExit,
}: AptisWritingInstructionsProps) => {
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
        <div className="max-w-2xl mx-auto text-neutral-900 text-sm leading-relaxed">
          <h1 className="text-base font-bold mb-4">Aptis General Writing Instructions</h1>
          <p className="font-bold mb-3">Writing</p>
          <p className="mb-3">The test has four parts and takes up to {totalMinutes} minutes.</p>
          <p className="mb-3">Recommended times:</p>
          {recommendedTimes.map((t) => (
            <p key={t.label} className="mb-3">
              {t.label}: {t.minutes} minutes
            </p>
          ))}
          <p className="mt-6">When you click on the 'Next' button, the test will begin.</p>
        </div>
      </main>

      {/* Bottom bar */}
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
            onClick={onNext}
            className="bg-[#24085a] hover:bg-[#1a0644] text-white rounded-md px-5 py-5 text-sm font-semibold gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default AptisWritingInstructions;

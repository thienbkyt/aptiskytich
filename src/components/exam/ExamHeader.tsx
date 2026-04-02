import { LogOut } from "lucide-react";

interface ExamHeaderProps {
  skillLabel: string;
  partLabel: string;
  onExit?: () => void;
}

const ExamHeader = ({ skillLabel, partLabel, onExit }: ExamHeaderProps) => {
  return (
    <div className="w-full bg-[#24085a] text-white px-6 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-white/70">{skillLabel}</p>
        <p className="text-sm font-bold">{partLabel}</p>
      </div>
      {onExit && (
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Thoát
        </button>
      )}
    </div>
  );
};

export default ExamHeader;

import { User } from "lucide-react";

interface SpeakingHeaderProps {
  partLabel: string;
  partNumber: number;
  totalParts: number;
}

const SpeakingHeader = ({ partLabel, partNumber, totalParts }: SpeakingHeaderProps) => {
  return (
    <div className="w-full bg-[#24085a] text-white px-6 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-white/70">Speaking</p>
        <p className="text-sm font-bold">Part {partNumber} of {totalParts}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
};

export default SpeakingHeader;

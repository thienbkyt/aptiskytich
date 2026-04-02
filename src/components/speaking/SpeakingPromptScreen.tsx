import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";

interface SpeakingPromptScreenProps {
  partNumber: number;
  totalParts: number;
  title: string;
  instructions: string;
  onNext: () => void;
  onExit?: () => void;
}

const SpeakingPromptScreen = ({ partNumber, totalParts, title, instructions, onNext, onExit }: SpeakingPromptScreenProps) => {
  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <SpeakingHeader partLabel={title} partNumber={partNumber} totalParts={totalParts} onExit={onExit} />

      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-20">
        <div className="bg-white rounded-xl shadow-sm max-w-3xl w-full p-8 md:p-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Prompt</h2>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {instructions}
          </div>
        </div>
      </div>

      <BottomNavBar onNext={onNext} isFirst={true} isLast={false} />
    </div>
  );
};

export default SpeakingPromptScreen;

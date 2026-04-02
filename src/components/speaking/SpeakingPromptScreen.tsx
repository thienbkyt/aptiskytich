import { useEffect, useRef } from "react";
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

/** Play a short beep using Web Audio API */
function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.5;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => { ctx.close(); resolve(); };
    } catch {
      resolve();
    }
  });
}

/** Speak text using Web Speech API and return a promise */
function speakAsync(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

const SpeakingPromptScreen = ({ partNumber, totalParts, title, instructions, onNext, onExit }: SpeakingPromptScreenProps) => {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const run = async () => {
      await speakAsync(instructions);
      await playBeep();
      await new Promise((r) => setTimeout(r, 1000));
      onNext();
    };
    run();

    return () => { window.speechSynthesis.cancel(); };
  }, []);

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

      <BottomNavBar isFirst={true} isLast={false} />
    </div>
  );
};

export default SpeakingPromptScreen;

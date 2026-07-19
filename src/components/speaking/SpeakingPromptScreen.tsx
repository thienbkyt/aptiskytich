import { useEffect, useRef } from "react";
import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import { playBeep } from "@/lib/beep";
import { speakAsync as ttsSpeakAsync } from "@/lib/tts";

interface SpeakingPromptScreenProps {
  partNumber: number;
  totalParts: number;
  title: string;
  instructions: string;
  onNext: () => void;
  onExit?: () => void;
}

/** Speak text using Google Cloud TTS (from src/lib/tts.ts) */
function speakAsync(text: string): Promise<void> {
  return ttsSpeakAsync(text, "en");
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

// Module-level guard: if the same intro text was already spoken in the last 60s
// (e.g. parent re-rendered and remounted this screen because a tier/auth hook
// finally resolved), skip the TTS sequence and go straight to onNext so we
// don't bump the TTS play token and kill the upcoming question audio.
const SPOKEN_AT: Map<string, number> = new Map();
const SPOKEN_TTL_MS = 60_000;

const SpeakingPromptScreen = ({ partNumber, totalParts, title, instructions, onNext, onExit }: SpeakingPromptScreenProps) => {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const key = instructions || "";
    const last = SPOKEN_AT.get(key) || 0;
    const recentlySpoken = Date.now() - last < SPOKEN_TTL_MS;

    const run = async () => {
      try {
        if (!recentlySpoken) {
          SPOKEN_AT.set(key, Date.now());
          await withTimeout(speakAsync(instructions), 15000);
          await withTimeout(playBeep(), 1000);
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch {
        /* Always advance, even if mobile audio is blocked. */
      }
      onNext();
    };
    run();
    // NOTE: do NOT call stopTTS() on unmount — onNext() triggers parent to
    // start the question TTS immediately; cleanup would bump the play token
    // and silently cancel that new audio.
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

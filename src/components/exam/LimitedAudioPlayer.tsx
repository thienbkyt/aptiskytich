import { useState, useRef, useEffect } from "react";
import { CircleDot, CirclePlay } from "lucide-react";
import { resolveAudioUrl } from "@/lib/audioUrl";

interface LimitedAudioPlayerProps {
  src: string;
  maxPlays?: number;
  questionKey?: string | number;
}

const LimitedAudioPlayer = ({ src, maxPlays = 2, questionKey }: LimitedAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const disabled = playCount >= maxPlays && !isPlaying;

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc("");
    if (src) {
      resolveAudioUrl(src).then((url) => {
        if (!cancelled && url) setResolvedSrc(url);
      });
    }
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    setPlayCount(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [questionKey, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // Stop: pause only, keep current position
      audio.pause();
      setIsPlaying(false);
    } else {
      // Play: always reset to beginning and count as a new play
      if (disabled) return;
      audio.currentTime = 0;
      setPlayCount((prev) => prev + 1);
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="my-3">
      <audio
        ref={audioRef}
        src={resolvedSrc}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 text-sm underline underline-offset-2 transition-colors ${
          disabled
            ? "text-muted-foreground cursor-not-allowed no-underline"
            : "text-foreground hover:text-primary cursor-pointer"
        }`}
      >
        {isPlaying ? (
          <CircleDot className="w-4 h-4 animate-pulse" />
        ) : (
          <CirclePlay className="w-4 h-4" />
        )}
        <span>Play/Stop</span>
      </button>
    </div>
  );
};

export default LimitedAudioPlayer;

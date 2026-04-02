import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const disabled = playCount >= maxPlays && !isPlaying;

  // Resolve audio URL (raw path → signed URL)
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

  // Reset state when question changes
  useEffect(() => {
    setPlayCount(0);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [questionKey, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (disabled) return;
      // If at end, reset to start and count as new play
      if (audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      // Count play when starting from beginning
      if (audio.currentTime === 0) {
        setPlayCount(prev => prev + 1);
      }
      audio.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mb-6 bg-muted/30 rounded-xl p-4">
      <audio
        ref={audioRef}
        src={resolvedSrc}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setCurrentTime(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={disabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            disabled
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "text-primary-foreground bg-[#230859]"
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>

        <div className={`flex items-center gap-1 shrink-0 text-xs font-medium px-2 py-1 rounded-md ${
          disabled ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}>
          {disabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {playCount}/{maxPlays}
        </div>
      </div>
    </div>
  );
};

export default LimitedAudioPlayer;

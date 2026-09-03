import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { resolveAudioBlobUrl } from "@/lib/audioUrl";
import { cn } from "@/lib/utils";

export type SegmentPlayerHandle = {
  play: () => void;
  stop: () => void;
};

type Props = {
  path: string;
  startSec: number;
  endSec: number;
  speed?: number;
  autoPlay?: boolean;
  onEnded?: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

const SegmentPlayer = forwardRef<SegmentPlayerHandle, Props>(function SegmentPlayer(
  { path, startSec, endSec, speed = 1, autoPlay = false, onEnded, label, disabled, className },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);

  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  const duration = Math.max(0.01, endSec - startSec);

  // Resolve the private-bucket path into a playable blob URL.
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setLoading(true);
    setPct(0);
    setPlaying(false);
    (async () => {
      const url = path ? await resolveAudioBlobUrl(path, { timeoutMs: 15000 }) : null;
      if (cancelled) return;
      setSrc(url);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  const startPlay = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    try {
      a.playbackRate = speed;
      a.currentTime = startSec;
      setPct(0);
      void a.play();
    } catch {
      /* ignore */
    }
  };

  const stopPlay = () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = startSec;
    } catch {
      /* ignore */
    }
    setPlaying(false);
    setPct(0);
  };

  useImperativeHandle(ref, () => ({ play: startPlay, stop: stopPlay }));

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = speed;
  }, [speed, src]);

  const handleLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.playbackRate = speed;
      a.currentTime = startSec;
    } catch {
      /* ignore */
    }
    if (autoPlayRef.current) startPlay();
  };

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.currentTime >= endSec) {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      setPlaying(false);
      setPct(100);
      onEndedRef.current?.();
      return;
    }
    setPct(Math.max(0, Math.min(100, ((a.currentTime - startSec) / duration) * 100)));
  };

  const toggle = () => {
    if (disabled) return;
    if (playing) {
      const a = audioRef.current;
      try {
        a?.pause();
      } catch {
        /* ignore */
      }
      setPlaying(false);
    } else {
      startPlay();
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            onEndedRef.current?.();
          }}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || loading || !src}
        aria-label={playing ? "Tạm dừng" : "Phát đoạn"}
        className={cn(
          "w-16 h-16 shrink-0 rounded-full flex items-center justify-center transition",
          disabled || loading || !src
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : playing ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {label && <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        {!loading && !src && (
          <p className="text-xs text-destructive mt-1">Không tải được audio cho câu này.</p>
        )}
      </div>
    </div>
  );
});

export default SegmentPlayer;

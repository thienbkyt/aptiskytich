import { useEffect, useRef, useState } from "react";

interface VolumeIndicatorProps {
  stream: MediaStream | null;
  className?: string;
}

const VolumeIndicator = ({ stream, className = "" }: VolumeIndicatorProps) => {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>();
  const ctxRef = useRef<AudioContext>();

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setLevel(avg / 255);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx.close().catch(() => {});
    };
  }, [stream]);

  const bars = 8;

  return (
    <div className={`flex items-end justify-center gap-[3px] h-8 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => {
        const barHeight = ((i + 1) / bars);
        const active = level >= barHeight * 0.4;
        return (
          <div
            key={i}
            className={`w-[4px] rounded-full transition-all duration-75 ${
              active ? "bg-green-500" : "bg-muted-foreground/20"
            }`}
            style={{
              height: active
                ? `${Math.max(barHeight * 100, 20)}%`
                : `${barHeight * 60}%`,
            }}
          />
        );
      })}
    </div>
  );
};

export default VolumeIndicator;

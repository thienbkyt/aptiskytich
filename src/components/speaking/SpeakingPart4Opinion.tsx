import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { SpeakingPart4Data } from "@/data/speakingQuestions";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import PrepTimer from "@/components/speaking/PrepTimer";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { resolveImageUrl } from "@/lib/imageUrl";

interface Props {
  data: SpeakingPart4Data;
  recording: string | null;
  onRecordingComplete: (url: string) => void;
}

const SpeakingPart4Opinion = ({ data, recording, onRecordingComplete }: Props) => {
  const [phase, setPhase] = useState<"prep" | "speak">(data.prepTime > 0 ? "prep" : "speak");
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (data.imageUrl) {
      resolveImageUrl(data.imageUrl).then(setResolvedImageUrl);
    }
  }, [data.imageUrl]);

  const { isRecording, audioUrl, timeLeft, micError, isRequestingMic, startRecording, stopRecording } = useAudioRecording({
    maxDuration: data.speakTime,
    onComplete: onRecordingComplete,
    questionKey: "part4",
    autoStart: phase === "speak" && !recording,
  });

  const content = (
    <div className="bg-background rounded-xl p-6 mb-6">
      {data.topic && (
        <h2 className="text-base font-heading font-bold text-foreground mb-4">
          Topic: {data.topic}
        </h2>
      )}

      {data.imageUrl && (
        <div className="rounded-xl overflow-hidden border border-border mb-6 max-w-md">
          <img src={resolvedImageUrl || data.imageUrl} alt="Part 4 topic" className="w-full h-64 object-cover" />
        </div>
      )}

      <ul className="space-y-2 mb-4">
        {data.questions.map((q, i) => (
          <li key={i} className="text-sm text-foreground">{q}</li>
        ))}
      </ul>

      <p className="text-sm font-bold text-foreground mb-6">
        You now have one minute to think about your answers. You can make notes if you wish.
      </p>

      {phase === "speak" && (
        <AudioRecorder
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          disabled={!!recording}
          audioUrl={recording || audioUrl}
          timeLeft={timeLeft}
          totalTime={data.speakTime}
          label="Your Opinion"
          micError={micError}
          isRequestingMic={isRequestingMic}
        />
      )}
    </div>
  );

  if (phase === "prep") {
    return (
      <PrepTimer prepTime={data.prepTime} onPrepEnd={() => setPhase("speak")}>
        {content}
      </PrepTimer>
    );
  }

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{content}</motion.div>;
};

export default SpeakingPart4Opinion;

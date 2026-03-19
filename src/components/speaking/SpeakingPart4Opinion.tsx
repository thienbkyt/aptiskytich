import { useState } from "react";
import { motion } from "framer-motion";
import type { SpeakingPart4Data } from "@/data/speakingQuestions";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import PrepTimer from "@/components/speaking/PrepTimer";
import { useAudioRecording } from "@/hooks/useAudioRecording";

interface Props {
  data: SpeakingPart4Data;
  recording: string | null;
  onRecordingComplete: (url: string) => void;
}

const SpeakingPart4Opinion = ({ data, recording, onRecordingComplete }: Props) => {
  const [phase, setPhase] = useState<"prep" | "speak">(data.prepTime > 0 ? "prep" : "speak");

  const { isRecording, audioUrl, timeLeft, startRecording, stopRecording } = useAudioRecording({
    maxDuration: data.speakTime,
    onComplete: onRecordingComplete,
    questionKey: "part4",
    autoStart: phase === "speak" && !recording,
  });

  const content = (
    <div className="bg-background rounded-xl p-6 mb-6">
      <div className="bg-muted/50 rounded-xl p-5 mb-6">
        <h2 className="text-base font-heading font-bold text-foreground mb-3">
          Topic: {data.topic}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Consider the following questions in your answer:
        </p>
        <ul className="space-y-2">
          {data.questions.map((q, i) => (
            <li key={i} className="text-sm text-foreground flex gap-2">
              <span className="text-muted-foreground font-bold shrink-0">{i + 1}.</span>
              {q}
            </li>
          ))}
        </ul>
      </div>

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

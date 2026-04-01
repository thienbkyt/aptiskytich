import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { SpeakingPart2Data } from "@/data/speakingQuestions";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import PrepTimer from "@/components/speaking/PrepTimer";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { resolveImageUrl } from "@/lib/imageUrl";

interface Props {
  data: SpeakingPart2Data;
  recording: string | null;
  onRecordingComplete: (url: string) => void;
}

const SpeakingPart2Describe = ({ data, recording, onRecordingComplete }: Props) => {
  const [phase, setPhase] = useState<"prep" | "speak">(data.prepTime > 0 ? "prep" : "speak");
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (data.imageUrl) {
      resolveImageUrl(data.imageUrl).then(setResolvedImageUrl);
    }
  }, [data.imageUrl]);

  const { isRecording, audioUrl, timeLeft, micError, isRequestingMic, recordingElapsed, stream, startRecording, stopRecording } = useAudioRecording({
    maxDuration: data.speakTime,
    onComplete: onRecordingComplete,
    questionKey: "part2",
    autoStart: phase === "speak" && !recording,
  });

  const content = (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-800 mb-4">
        {data.prompt}
      </h2>
      <div className="rounded-xl overflow-hidden border border-gray-200 mb-6">
        <img src={resolvedImageUrl || data.imageUrl} alt="Describe this picture" className="w-full h-72 object-cover" />
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
          label="Your Description"
          micError={micError}
          isRequestingMic={isRequestingMic}
          recordingElapsed={recordingElapsed}
          stream={stream}
          minRecordingTime={10}
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

export default SpeakingPart2Describe;

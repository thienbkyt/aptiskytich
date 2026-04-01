import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { SpeakingPart3Data } from "@/data/speakingQuestions";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import PrepTimer from "@/components/speaking/PrepTimer";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { resolveImageUrl } from "@/lib/imageUrl";

interface Props {
  data: SpeakingPart3Data;
  recording: string | null;
  onRecordingComplete: (url: string) => void;
}

const SpeakingPart3Compare = ({ data, recording, onRecordingComplete }: Props) => {
  const [phase, setPhase] = useState<"prep" | "speak">(data.prepTime > 0 ? "prep" : "speak");
  const [resolvedImg1, setResolvedImg1] = useState<string | null>(null);
  const [resolvedImg2, setResolvedImg2] = useState<string | null>(null);

  useEffect(() => {
    if (data.imageUrl1) resolveImageUrl(data.imageUrl1).then(setResolvedImg1);
    if (data.imageUrl2) resolveImageUrl(data.imageUrl2).then(setResolvedImg2);
  }, [data.imageUrl1, data.imageUrl2]);

  const { isRecording, audioUrl, timeLeft, micError, isRequestingMic, recordingElapsed, stream, startRecording, stopRecording } = useAudioRecording({
    maxDuration: data.speakTime,
    onComplete: onRecordingComplete,
    questionKey: "part3",
    autoStart: phase === "speak" && !recording,
  });

  const content = (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-sm font-bold text-gray-800 mb-4">
        {data.prompt}
      </h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <img src={resolvedImg1 || data.imageUrl1} alt="Picture 1" className="w-full h-52 object-cover" />
          <p className="text-xs text-center py-2 text-gray-500 font-medium bg-gray-50">Picture 1</p>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <img src={resolvedImg2 || data.imageUrl2} alt="Picture 2" className="w-full h-52 object-cover" />
          <p className="text-xs text-center py-2 text-gray-500 font-medium bg-gray-50">Picture 2</p>
        </div>
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
          label="Your Comparison"
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

export default SpeakingPart3Compare;

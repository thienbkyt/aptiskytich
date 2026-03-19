import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { SpeakingPart1Data } from "@/data/speakingQuestions";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import { useAudioRecording } from "@/hooks/useAudioRecording";

interface Props {
  data: SpeakingPart1Data;
  currentIndex: number;
  recordings: (string | null)[];
  onRecordingComplete: (qi: number, url: string) => void;
}

const SpeakingPart1Personal = ({ data, currentIndex, recordings, onRecordingComplete }: Props) => {
  const question = data.questions[currentIndex];
  const { isRecording, audioUrl, timeLeft, startRecording, stopRecording } = useAudioRecording({
    maxDuration: data.speakTime,
    onComplete: (url) => onRecordingComplete(currentIndex, url),
    questionKey: currentIndex,
  });

  const existingRecording = recordings[currentIndex];

  return (
    <motion.div
      key={currentIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="bg-background rounded-xl p-6 mb-6">
        <p className="text-xs text-muted-foreground mb-2">
          Question {currentIndex + 1} of {data.questions.length}
        </p>
        <h2 className="text-lg font-heading font-bold text-foreground mb-6">
          {question}
        </h2>

        <AudioRecorder
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          disabled={!!existingRecording}
          audioUrl={existingRecording || audioUrl}
          timeLeft={timeLeft}
          totalTime={data.speakTime}
          label="Your Answer"
        />
      </div>
    </motion.div>
  );
};

export default SpeakingPart1Personal;

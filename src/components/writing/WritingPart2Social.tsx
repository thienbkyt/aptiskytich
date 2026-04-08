import { useState, useRef, useCallback } from "react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart2Data } from "@/data/writingQuestions";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";

interface Props {
  data: WritingPart2Data;
  answer: string;
  onAnswerChange: (value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  sections: any[];
}

const WritingPart2Social = ({
  data, answer, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, sections,
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  const execFormat = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    const text = editorRef.current?.innerText || "";
    onAnswerChange(text);
  }, [onAnswerChange]);

  const toolbarButtons = [
    { cmd: "bold", icon: Bold, label: "B" },
    { cmd: "italic", icon: Italic, label: "I" },
    { cmd: "underline", icon: Underline, label: "U" },
    { cmd: "strikeThrough", icon: Strikethrough, label: "S" },
  ];

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 2</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      {/* Instruction (bold) */}
      <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">
        {data.instruction}
      </p>

      {/* Question */}
      <p className="text-sm text-foreground mb-4">
        {data.question}
      </p>

      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-0">
        {toolbarButtons.map(({ cmd, icon: Icon }) => (
          <button
            key={cmd}
            type="button"
            onClick={() => execFormat(cmd)}
            disabled={submitted}
            className="w-8 h-8 flex items-center justify-center rounded border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Icon className="w-4 h-4 text-foreground" />
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative">
        <div
          ref={editorRef}
          contentEditable={!submitted}
          onInput={handleInput}
          data-placeholder="Type your answer here"
          className="min-h-[120px] w-full rounded-b-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          suppressContentEditableWarning
        />
        <div className="flex justify-end mt-1.5">
          <span className="text-xs text-muted-foreground">
            Words <span className="font-semibold text-foreground">{wordCount}</span> / {data.wordLimit}
          </span>
        </div>
      </div>

      {submitted && data.sampleAnswer && (
        <div className="bg-muted/50 rounded-xl p-4 mt-4 text-sm">
          <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
          <p className="text-muted-foreground whitespace-pre-line">{data.sampleAnswer}</p>
        </div>
      )}

      <BottomNavBar
        isFirst={true}
        isLast={true}
        onSubmit={!submitted ? onSubmit : undefined}
        submitLabel="Submit"
        sections={sections}
      />
    </div>
  );
};

export default WritingPart2Social;

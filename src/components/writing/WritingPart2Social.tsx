import { useRef, useCallback, useEffect } from "react";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart2Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart2Data;
  answer: string;
  onAnswerChange: (value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  onPrevious?: () => void;
  sections: any[];
}

const toolbarButtons = [
  { cmd: "bold", icon: Bold },
  { cmd: "italic", icon: Italic },
  { cmd: "underline", icon: Underline },
  { cmd: "strikeThrough", icon: Strikethrough },
];

const WritingPart2Social = ({
  data, answer, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, onPrevious, sections,
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  const execFormat = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    onAnswerChange(editorRef.current?.innerText || "");
  }, [onAnswerChange]);

  // Seed the editor with the initial saved answer (review mode).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !editorRef.current) return;
    if (answer && answer.length > 0) {
      editorRef.current.innerText = answer;
      seededRef.current = true;
    } else if (answer === "") {
      seededRef.current = true;
    }
  }, [answer]);

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 2</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{data.instruction}</p>
      <p className="text-sm text-foreground mb-4">{data.question}</p>

      <div className="flex items-center gap-1 mb-0">
        {toolbarButtons.map(({ cmd, icon: Icon }) => (
          <button key={cmd} type="button" onClick={() => execFormat(cmd)} disabled={submitted}
            className="w-8 h-8 flex items-center justify-center rounded border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50">
            <Icon className="w-4 h-4 text-foreground" />
          </button>
        ))}
      </div>

      <div className="flex-1 relative">
        <div ref={editorRef} contentEditable={!submitted} onInput={handleInput}
          data-placeholder="Type your answer here"
          className="min-h-[120px] w-full rounded-b-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          suppressContentEditableWarning />
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

      <BottomNavBar isFirst={!onPrevious} isLast={false} onNext={!submitted ? onSubmit : undefined} onPrevious={onPrevious} sections={sections} />
    </div>
  );
};

export default WritingPart2Social;

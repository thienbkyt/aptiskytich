import { clampWords, countWords } from "@/lib/writingWordLimits";

interface Props {
  onTextChange: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  wordLimit?: number;
  /** Current text shown in the editor (e.g. when reviewing saved answers). */
  value?: string;
}

const RichTextEditor = ({ onTextChange, disabled, placeholder = "Type your answer here", minHeight = "120px", wordLimit, value = "" }: Props) => {
  const wordCount = countWords(value);
  const atLimit = wordLimit != null && wordCount >= wordLimit;

  return (
    <div>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        onChange={(e) => {
          const next = clampWords(e.target.value, wordLimit);
          onTextChange(next);
        }}
        style={{ minHeight }}
        className="w-full rounded-md border border-exam-border bg-exam-surface p-3 text-sm text-exam-text caret-exam-accent selection:bg-exam-accent/30 selection:text-exam-text focus:outline-none focus:ring-2 focus:ring-exam-accent focus:ring-offset-1 placeholder:text-exam-text-muted whitespace-pre-wrap resize-y disabled:opacity-70 disabled:cursor-not-allowed"
      />
      {wordLimit != null && (
        <div className="flex justify-end mt-1.5">
          <span className="text-xs text-muted-foreground">
            Words <span className={`font-semibold ${atLimit ? "text-destructive" : "text-foreground"}`}>{wordCount}</span> / {wordLimit}
          </span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;

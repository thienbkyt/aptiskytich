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
        className="w-full rounded-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground whitespace-pre-wrap resize-y disabled:opacity-70 disabled:cursor-not-allowed"
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

import { useState } from "react";

interface Props {
  onTextChange: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  wordLimit?: number;
  /** Initial text shown in the editor (e.g. when reviewing saved answers). */
  initialValue?: string;
}

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const RichTextEditor = ({ onTextChange, disabled, placeholder = "Type your answer here", minHeight = "120px", wordLimit, initialValue = "" }: Props) => {
  const [wordCount, setWordCount] = useState(countWords(initialValue));

  return (
    <div>
      <textarea
        defaultValue={initialValue}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          const text = e.target.value;
          onTextChange(text);
          setWordCount(countWords(text));
        }}
        style={{ minHeight }}
        className="w-full rounded-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground whitespace-pre-wrap resize-y disabled:opacity-70 disabled:cursor-not-allowed"
      />
      {wordLimit != null && (
        <div className="flex justify-end mt-1.5">
          <span className="text-xs text-muted-foreground">
            Words <span className="font-semibold text-foreground">{wordCount}</span> / {wordLimit}
          </span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;

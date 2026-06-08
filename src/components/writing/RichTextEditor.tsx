import { useRef, useCallback, useState, useEffect } from "react";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";

interface Props {
  onTextChange: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  wordLimit?: number;
  /** Initial text shown in the editor (e.g. when reviewing saved answers). */
  initialValue?: string;
}

const toolbarButtons = [
  { cmd: "bold", icon: Bold },
  { cmd: "italic", icon: Italic },
  { cmd: "underline", icon: Underline },
  { cmd: "strikeThrough", icon: Strikethrough },
];

const RichTextEditor = ({ onTextChange, disabled, placeholder = "Type your answer here", minHeight = "120px", wordLimit, initialValue }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const seededRef = useRef(false);

  // Seed initial content once (avoid clobbering user typing on re-renders).
  useEffect(() => {
    if (seededRef.current) return;
    if (!editorRef.current) return;
    if (initialValue && initialValue.length > 0) {
      editorRef.current.innerText = initialValue;
      const wc = initialValue.trim() ? initialValue.trim().split(/\s+/).length : 0;
      setWordCount(wc);
      seededRef.current = true;
    } else if (initialValue === "" || initialValue === undefined) {
      // Mark as seeded once we get a definitive empty value to avoid re-seeding.
      seededRef.current = true;
    }
  }, [initialValue]);

  const execFormat = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    const text = editorRef.current?.innerText || "";
    onTextChange(text);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  }, [onTextChange]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-0">
        {toolbarButtons.map(({ cmd, icon: Icon }) => (
          <button
            key={cmd}
            type="button"
            onClick={() => execFormat(cmd)}
            disabled={disabled}
            className="w-8 h-8 flex items-center justify-center rounded border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Icon className="w-4 h-4 text-foreground" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="w-full rounded-b-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground whitespace-pre-wrap"
        suppressContentEditableWarning
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

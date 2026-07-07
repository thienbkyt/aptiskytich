import { RefObject } from "react";
import { Bold, Heading2, Heading3, List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (v: string) => void;
}

const wrapSelection = (
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
  onChange: (v: string) => void,
) => {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const value = ta.value;
  const sel = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + sel + after + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + sel.length);
  });
};

const prefixLines = (
  ta: HTMLTextAreaElement,
  prefix: string,
  onChange: (v: string) => void,
) => {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const value = ta.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const before = value.slice(0, lineStart);
  const middle = value.slice(lineStart, end) || "Nội dung";
  const after = value.slice(end);
  const withPrefix = middle
    .split("\n")
    .map((l) => (l.trim() ? prefix + l : l))
    .join("\n");
  onChange(before + withPrefix + after);
  requestAnimationFrame(() => ta.focus());
};

const MarkdownToolbar = ({ textareaRef, onChange }: Props) => {
  const ta = () => textareaRef.current;
  const btn = "h-8 w-8 p-0";
  return (
    <div className="flex items-center gap-1 flex-wrap border-b border-border bg-muted/40 px-2 py-1.5 rounded-t-md">
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) prefixLines(t, "## ", onChange); }} title="Tiêu đề H2">
        <Heading2 className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) prefixLines(t, "### ", onChange); }} title="Tiêu đề H3">
        <Heading3 className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) wrapSelection(t, "**", "**", "chữ đậm", onChange); }} title="In đậm">
        <Bold className="w-4 h-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) prefixLines(t, "- ", onChange); }} title="Danh sách">
        <List className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) prefixLines(t, "1. ", onChange); }} title="Danh sách số">
        <ListOrdered className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) prefixLines(t, "> ", onChange); }} title="Trích dẫn">
        <Quote className="w-4 h-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) wrapSelection(t, "[", "](https://)", "văn bản liên kết", onChange); }} title="Chèn liên kết">
        <LinkIcon className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className={btn} onClick={() => { const t = ta(); if (t) wrapSelection(t, "![", "](https://)", "mô tả ảnh", onChange); }} title="Chèn ảnh">
        <ImageIcon className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default MarkdownToolbar;

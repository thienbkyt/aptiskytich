interface WordCounterProps {
  text: string;
  limit?: number;
}

const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const WordCounter = ({ text, limit }: WordCounterProps) => {
  const count = countWords(text);
  const isOver = limit ? count > limit : false;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-medium ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
        {count} {limit ? `/ ~${limit}` : ""} từ
      </span>
      {isOver && <span className="text-destructive">(vượt giới hạn)</span>}
    </div>
  );
};

export { WordCounter, countWords };

const LINKERS = ["and", "but", "so", "because", "however", "moreover", "furthermore", "in addition", "therefore", "although", "firstly", "secondly", "finally", "for example", "for instance", "on the other hand", "in my opinion", "as a result", "besides", "also", "then", "overall", "in conclusion"];

const has = (s: string, phrase: string) => new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "i").test(s);

const TextStats = ({ text }: { text: string }) => {
  const t = String(text || "").trim();
  const sentences = t ? t.replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s)) : [];
  const words = t.match(/[A-Za-z']+/g) || [];
  const avg = sentences.length ? words.length / sentences.length : 0;
  const used = LINKERS.filter((l) => has(t, l));

  const stats = [
    { label: "Số câu", value: sentences.length },
    { label: "Số từ", value: words.length },
    { label: "TB từ/câu", value: avg.toFixed(1) },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">🧮 Thống kê bài</h3>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/40 p-2.5 text-center">
            <p className="text-lg font-extrabold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-foreground mt-3 mb-1.5">Từ nối đã dùng</p>
      {used.length ? (
        <div className="flex flex-wrap gap-1.5">
          {used.map((l) => (
            <span key={l} className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">{l}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Chưa dùng từ nối nào.</p>
      )}
      {used.length < 3 && (
        <p className="text-xs text-primary mt-2">💡 Thêm từ nối như However, Moreover, For example để bài mạch lạc hơn</p>
      )}
    </div>
  );
};

export default TextStats;

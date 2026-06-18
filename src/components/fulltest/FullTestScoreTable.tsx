import { getSkillBand, getLevelColor, toScaledScore } from "@/data/questions";

type SkillKey = "speaking" | "listening" | "grammar" | "reading" | "writing";
type Scores = Record<SkillKey, { correct: number; total: number }>;

interface Props {
  scores: Scores;
}

const BAND_TO_NUM: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };
const NUM_TO_BAND = ["A0", "A1", "A2", "B1", "B2", "C"];

const FullTestScoreTable = ({ scores }: Props) => {
  const score50 = (sk: SkillKey) => toScaledScore(scores[sk].correct, scores[sk].total);

  const gv = score50("grammar");
  const listening = score50("listening");
  const reading = score50("reading");
  const speaking = score50("speaking");
  const writing = score50("writing");

  const total200 = listening + reading + speaking + writing;

  const bandFor = (sk: "listening" | "reading" | "speaking" | "writing") =>
    scores[sk].total > 0 ? getSkillBand(score50(sk), sk) : null;

  const bands = (["listening", "reading", "speaking", "writing"] as const)
    .map((sk) => bandFor(sk))
    .filter((b): b is string => !!b);

  let overall: string = "—";
  if (bands.length > 0) {
    const avg = Math.round(
      bands.reduce((s, b) => s + (BAND_TO_NUM[b] ?? 0), 0) / bands.length
    );
    overall = NUM_TO_BAND[Math.max(0, Math.min(5, avg))];
  }

  const rowsLeft: Array<{ label: string; value: string }> = [
    { label: "G/V", value: `${gv}` },
    { label: "Listening", value: `${listening}/50` },
    { label: "Reading", value: `${reading}/50` },
    { label: "Speaking", value: `${speaking}/50` },
    { label: "Writing", value: `${writing}/50` },
    { label: "Total", value: `${total200}/200` },
  ];

  const rowsRight: Array<{ label: string; band: string | null }> = [
    { label: "", band: null },
    { label: "Listening", band: bandFor("listening") },
    { label: "Reading", band: bandFor("reading") },
    { label: "Speaking", band: bandFor("speaking") },
    { label: "Writing", band: bandFor("writing") },
    { label: "Overall", band: bands.length > 0 ? overall : null },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Left column — scores */}
        <div>
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Điểm số</p>
          </div>
          <ul>
            {rowsLeft.map((r, i) => {
              const isTotal = r.label === "Total";
              return (
                <li
                  key={r.label}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < rowsLeft.length - 1 ? "border-b border-border" : ""
                  } ${isTotal ? "bg-muted/30 font-bold" : ""}`}
                >
                  <span className="text-sm text-foreground">{r.label}</span>
                  <span className={`text-sm font-heading ${isTotal ? "text-base font-extrabold text-primary" : "font-bold text-foreground"}`}>
                    {r.value}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right column — bands */}
        <div>
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CEFR Band</p>
          </div>
          <ul>
            {rowsRight.map((r, i) => {
              const isOverall = r.label === "Overall";
              return (
                <li
                  key={r.label}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < rowsRight.length - 1 ? "border-b border-border" : ""
                  } ${isOverall ? "bg-muted/30 font-bold" : ""}`}
                >
                  <span className="text-sm text-foreground">{r.label}</span>
                  <span
                    className={`text-sm font-heading font-bold ${
                      r.band ? getLevelColor(r.band) : "text-muted-foreground"
                    } ${isOverall ? "text-base font-extrabold" : ""}`}
                  >
                    {r.band ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FullTestScoreTable;

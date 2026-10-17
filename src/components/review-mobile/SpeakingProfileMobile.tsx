import { Target } from "lucide-react";
import { safeText } from "@/lib/safeText";
import InlineErrorText from "@/components/insights/InlineErrorText";
import PronunciationPractice from "@/components/insights/PronunciationPractice";
import ErrorTrendsCard from "@/components/insights/ErrorTrendsCard";
import { asArray, type InsightError } from "@/components/insights/errorCategories";
import { normPron } from "@/components/insights/SpeakingInsights";
import SpeakingSampleAnswerBlock from "@/components/speaking/SpeakingSampleAnswerBlock";
import type { SampleAnswerPair } from "@/data/speakingQuestions";
import { MBetter, MCard, MEyebrow, MFixList, MPronChips, MScoreCard, MTag } from "./parts";

interface Item {
  questionText?: string;
  transcript?: string;
  onTopic?: boolean;
  improvedVersion?: string;
  upgradeTips?: string;
  audioUrl?: string | null;
  grammarErrors?: unknown;
  pronunciationWords?: unknown;
}

interface Props {
  rows: Array<{ key: string; vi: string; value: number | null }>;
  criteriaAnalysis?: Record<string, unknown> | null;
  analysis?: string;
  items: Item[];
  scale50?: number | null;
  cefr?: string | null;
  partLabel?: string;
  fullTranscript?: string;
  sampleAnswers?: (SampleAnswerPair | undefined)[];
  sharedSample?: boolean;
}

/**
 * Hồ sơ Speaking (chấm 5 tiêu chí) — bản ĐIỆN THOẠI.
 * Thay biểu đồ radar cao 300px bằng 5 thanh ngang, thẻ từng câu gọn hơn,
 * thêm danh sách sửa lỗi + từ cần luyện phát âm ngay trong từng câu.
 */
const SpeakingProfileMobile = ({
  rows, criteriaAnalysis, analysis, items, scale50 = null, cefr = null, partLabel,
  fullTranscript, sampleAnswers, sharedSample = false,
}: Props) => {
  const analysisLines = rows
    .map((r) => {
      const t = safeText((criteriaAnalysis as any)?.[r.key]);
      return t ? `${r.vi} (${r.value != null ? Math.round(r.value) : "—"}/5): ${t}` : "";
    })
    .filter(Boolean);
  const note = analysisLines.length ? analysisLines.join("\n\n") : safeText(analysis);

  return (
    <div className="space-y-3">
      <MScoreCard
        label={partLabel ? `Kết quả · ${partLabel}` : "Kết quả Speaking"}
        score={scale50 != null ? Math.round(Number(scale50)) : null}
        max={scale50 != null ? 50 : null}
        badge={cefr ? <MTag>CEFR {cefr}</MTag> : <MTag>AI Kỳ Tích chấm</MTag>}
        criteria={rows.map((r) => ({ label: r.vi, value: r.value }))}
        note={note || undefined}
      />

      {!!safeText(fullTranscript).trim() && (
        <MCard>
          <MEyebrow>Toàn bộ bài nói</MEyebrow>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground">{safeText(fullTranscript)}</p>
        </MCard>
      )}

      {items.map((it, idx) => {
        const qt = safeText(it.questionText);
        const tr = safeText(it.transcript);
        const iv = safeText(it.improvedVersion);
        const ut = safeText(it.upgradeTips);
        const errs = asArray<InsightError>(it.grammarErrors);
        const pron = normPron(it.pronunciationWords);
        return (
          <div key={idx} className="space-y-3">
            <MCard>
              <MEyebrow
                right={typeof it.onTopic === "boolean" ? (
                  it.onTopic ? <MTag tone="green">Đúng chủ đề</MTag> : <MTag tone="rose">Lệch chủ đề</MTag>
                ) : null}
              >
                <span className="text-exam-accent">Câu {idx + 1}</span>
              </MEyebrow>
              {qt && <p className="mb-3 text-[15.5px] font-semibold leading-snug text-foreground">{qt}</p>}

              {it.audioUrl === "__EXPIRED__" ? (
                <p className="text-[13px] italic leading-relaxed text-muted-foreground">
                  Bản ghi âm đã hết hạn lưu trữ (7 ngày). Điểm, nhận xét và transcript vẫn được giữ đầy đủ.
                </p>
              ) : it.audioUrl ? (
                <audio controls src={it.audioUrl} preload="metadata" className="h-10 w-full" />
              ) : null}

              {tr ? (
                <div className="mt-3 text-[14px] leading-relaxed text-foreground">
                  {errs.length > 0 ? <InlineErrorText text={tr} errors={errs} /> : <p className="whitespace-pre-line">{tr}</p>}
                </div>
              ) : (
                <p className="mt-3 text-[13px] italic text-muted-foreground">(Không nghe được lời nói ở câu này)</p>
              )}

              {errs.length > 0 && (
                <div className="mt-4">
                  <MEyebrow right={<MTag tone="rose">{errs.length} lỗi</MTag>}>Sửa lỗi</MEyebrow>
                  <MFixList errors={errs} />
                </div>
              )}
              {pron.length > 0 && (
                <div className="mt-4">
                  <MEyebrow>Từ cần luyện phát âm</MEyebrow>
                  <MPronChips words={pron} />
                </div>
              )}
            </MCard>

            {iv && <MBetter label="Nói lại hay hơn" text={iv} />}
            {ut && (
              <div className="rounded-2xl border border-border bg-card px-3.5 py-3 text-[13.5px] leading-relaxed">
                <span className="inline-flex items-center gap-1 font-bold text-primary">
                  <Target className="h-3.5 w-3.5" /> Mẹo đạt điểm cao:
                </span>{" "}
                <span className="whitespace-pre-line text-foreground">{ut}</span>
              </div>
            )}
            {!sharedSample && <SpeakingSampleAnswerBlock compact pair={sampleAnswers?.[idx]} />}
          </div>
        );
      })}

      {sharedSample && <SpeakingSampleAnswerBlock compact pair={sampleAnswers?.[0]} note="cho cả phần này" />}

      <PronunciationPractice words={items.flatMap((it) => normPron(it.pronunciationWords))} />
      <ErrorTrendsCard skill="speaking" />
    </div>
  );
};

export default SpeakingProfileMobile;

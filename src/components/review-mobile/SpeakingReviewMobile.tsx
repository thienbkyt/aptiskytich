import { ChevronDown, Search } from "lucide-react";
import SignedImage from "@/components/exam/SignedImage";
import type {
  SpeakingPartType, SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data, SampleAnswerPair,
} from "@/data/speakingQuestions";
import type { SpeakingGradingResult } from "@/components/speaking/speakingGrading";
import { safeText } from "@/lib/safeText";
import InlineErrorText from "@/components/insights/InlineErrorText";
import SpeakingInsights, { normPron } from "@/components/insights/SpeakingInsights";
import SpeakingSampleAnswerBlock from "@/components/speaking/SpeakingSampleAnswerBlock";
import { asArray, type InsightError } from "@/components/insights/errorCategories";
import GradeNoticeCard from "./GradeNoticeCard";
import { MBetter, MCard, MEyebrow, MFixList, MPronChips, MScoreCard, MTag } from "./parts";

interface Props {
  partType: SpeakingPartType;
  part1Data?: SpeakingPart1Data;
  part2Data?: SpeakingPart2Data;
  part3Data?: SpeakingPart3Data;
  part4Data?: SpeakingPart4Data;
  recordings: (string | null)[];
  gradings: (SpeakingGradingResult | null)[];
  reviewIndex: number;
  onChangeIndex: (next: number) => void;
  hidePager?: boolean;
  regradingIdx: number | null;
  onRegradeClick?: (gIdx: number) => void;
  sampleAnswers?: (SampleAnswerPair | undefined)[];
}

/**
 * Xem lại Speaking (đường chấm từng câu) — bản ĐIỆN THOẠI, 1 cột:
 * đề → bài nói → điểm/trạng thái → sửa lỗi → phát âm → nói lại hay hơn → bài mẫu.
 * Máy tính vẫn dùng bố cục 2 cột cũ trong SpeakingReviewView.
 */
const SpeakingReviewMobile = ({
  partType, part1Data, part2Data, part3Data, part4Data,
  recordings, gradings, reviewIndex, onChangeIndex, hidePager = false,
  regradingIdx, onRegradeClick, sampleAnswers,
}: Props) => {
  const promptsList: string[] =
    partType === "part1" && part1Data ? part1Data.questions
    : partType === "part2" && part2Data ? (part2Data.questions || [part2Data.prompt])
    : partType === "part3" && part3Data ? (part3Data.questions || [part3Data.prompt])
    : partType === "part4" && part4Data ? [part4Data.topic]
    : [];

  const isPart4 = partType === "part4";
  const total = isPart4 ? 1 : promptsList.length;
  const rIdx = Math.min(reviewIndex, Math.max(0, total - 1));
  const prompt = safeText(promptsList[rIdx] ?? promptsList[0] ?? "");
  const gIdx = isPart4 ? 0 : rIdx;
  const g = gradings[gIdx];
  const audioUrl = recordings[rIdx];
  const speakTime =
    partType === "part1" ? part1Data?.speakTime
    : partType === "part2" ? part2Data?.speakTime
    : partType === "part3" ? part3Data?.speakTime
    : part4Data?.speakTime;

  const graded = g && !("error" in g) ? g : null;
  const errText = g && "error" in g ? String(g.error ?? "") : null;
  const transcript = graded ? safeText(graded.transcript) : "";
  const pron = graded ? normPron((graded as any).pronunciationErrors ?? (graded as any).pronunciationWords) : [];
  const fixes = graded ? asArray((graded as any).grammarErrors) : [];

  return (
    <div className="space-y-3 pb-2">
      {/* Đề */}
      <MCard>
        <MEyebrow right={speakTime ? <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nói {speakTime >= 60 ? `${Math.round(speakTime / 60)} phút` : `${speakTime} giây`}</span> : null}>
          <span className="text-exam-accent">{isPart4 ? "Part 4" : `Câu ${rIdx + 1} / ${total}`}</span>
        </MEyebrow>

        {partType === "part2" && part2Data?.imageUrl && (
          <SignedImage src={part2Data.imageUrl} alt="Ảnh đề bài" className="mb-3 max-h-60 w-full rounded-xl object-cover" />
        )}
        {partType === "part3" && part3Data && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <SignedImage src={part3Data.imageUrl1} alt="Ảnh 1" className="h-32 w-full rounded-xl object-cover" />
            <SignedImage src={part3Data.imageUrl2} alt="Ảnh 2" className="h-32 w-full rounded-xl object-cover" />
          </div>
        )}
        {isPart4 && part4Data ? (
          <>
            {part4Data.imageUrl && (
              <SignedImage src={part4Data.imageUrl} alt="Ảnh đề bài" className="mb-3 max-h-56 w-full rounded-xl object-cover" />
            )}
            <p className="text-[16px] font-semibold leading-snug text-foreground">{safeText(part4Data.topic)}</p>
            <ul className="mt-2 space-y-1.5">
              {part4Data.questions.map((q, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-snug text-foreground">
                  <span className="font-bold text-exam-accent">{i + 1}.</span>
                  <span>{safeText(q)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[16px] font-semibold leading-snug text-foreground">{prompt}</p>
        )}
      </MCard>

      {/* Bài nói */}
      <MCard>
        <MEyebrow
          right={graded && typeof (graded as any).onTopic === "boolean" && transcript ? (
            (graded as any).onTopic ? <MTag tone="green">Đúng trọng tâm</MTag> : <MTag tone="amber">Chưa đúng trọng tâm</MTag>
          ) : null}
        >
          Bài nói của bạn
        </MEyebrow>
        {audioUrl === "__EXPIRED__" ? (
          <p className="text-[13px] italic leading-relaxed text-muted-foreground">
            Bản ghi âm đã hết hạn lưu trữ (7 ngày). Điểm, nhận xét và transcript vẫn được giữ đầy đủ.
          </p>
        ) : audioUrl ? (
          <audio controls src={audioUrl} preload="metadata" className="h-10 w-full" />
        ) : (
          <p className="text-[13px] italic text-muted-foreground">Không có bài ghi âm cho câu này.</p>
        )}
        {transcript && (
          <div className="mt-3 text-[14px] leading-relaxed text-foreground">
            {fixes.length > 0 ? (
              <InlineErrorText text={transcript} errors={asArray<InsightError>(fixes)} />
            ) : (
              <p className="whitespace-pre-wrap">{transcript}</p>
            )}
          </div>
        )}
      </MCard>

      {/* Điểm hoặc trạng thái chưa chấm */}
      {graded ? (
        <MScoreCard
          label="Điểm câu này"
          score={Number(graded.partScore ?? 0).toFixed(1).replace(/\.0$/, "")}
          max={graded.maxPoints}
          badge={<MTag>AI Kỳ Tích chấm</MTag>}
          note={safeText((graded as any).analysis) || undefined}
        />
      ) : (
        <GradeNoticeCard
          error={errText}
          canRegrade={!!onRegradeClick && !!audioUrl && audioUrl !== "__EXPIRED__"}
          regrading={regradingIdx === gIdx}
          onRegrade={onRegradeClick ? () => onRegradeClick(gIdx) : undefined}
        />
      )}

      {graded && (fixes.length > 0 || pron.length > 0 || safeText(graded.feedback)) && (
        <MCard>
          {fixes.length > 0 && (
            <>
              <MEyebrow right={<MTag tone="rose">{fixes.length} lỗi</MTag>}>Sửa lỗi</MEyebrow>
              <MFixList errors={fixes} />
            </>
          )}
          {pron.length > 0 && (
            <div className={fixes.length > 0 ? "mt-4" : ""}>
              <MEyebrow>Từ cần luyện phát âm</MEyebrow>
              <MPronChips words={pron} />
            </div>
          )}
          {safeText(graded.feedback) && (
            <div className={fixes.length > 0 || pron.length > 0 ? "mt-4" : ""}>
              <MEyebrow>Nhận xét</MEyebrow>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{safeText(graded.feedback)}</p>
            </div>
          )}
        </MCard>
      )}

      {graded && safeText(graded.improvedVersion) && (
        <MBetter label="Nói lại hay hơn" text={safeText(graded.improvedVersion)} />
      )}

      <SpeakingSampleAnswerBlock
        compact
        pair={sampleAnswers?.[isPart4 ? 0 : rIdx]}
        note={isPart4 ? "cho cả phần này" : undefined}
      />

      {/* Phân tích chi tiết cả part: gấp lại cho gọn */}
      <details className="group rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13.5px] font-bold text-foreground">
          <span className="flex items-center gap-1.5"><Search className="h-4 w-4 text-exam-accent" /> Phân tích chi tiết cả phần</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 [&>div>h3]:hidden">
          <SpeakingInsights
            showPerQuestion={false}
            items={(gradings || []).map((gr: any) => (gr && !("error" in gr) ? {
              transcript: safeText(gr.transcript),
              onTopic: gr.onTopic,
              grammarErrors: gr.grammarErrors ?? gr.grammar_errors,
              pronunciationWords: gr.pronunciationErrors ?? gr.pronunciation_errors ?? gr.pronunciationWords,
            } : {}))}
          />
        </div>
      </details>

      {!hidePager && total > 1 && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChangeIndex(Math.max(0, rIdx - 1))}
            disabled={rIdx === 0}
            className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold disabled:opacity-40"
          >
            ‹ Câu trước
          </button>
          <span className="px-1 text-xs text-muted-foreground">{rIdx + 1}/{total}</span>
          <button
            type="button"
            onClick={() => onChangeIndex(Math.min(total - 1, rIdx + 1))}
            disabled={rIdx >= total - 1}
            className="h-11 flex-1 rounded-xl bg-exam-accent text-sm font-semibold text-exam-accent-foreground disabled:opacity-40"
          >
            Câu sau ›
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeakingReviewMobile;

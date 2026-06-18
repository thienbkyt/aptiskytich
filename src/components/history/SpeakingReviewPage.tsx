import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExamHeader from "@/components/exam/ExamHeader";
import SpeakingReviewView from "@/components/speaking/SpeakingReviewView";
import { fetchExamQuestions, normalizePart } from "@/hooks/useExamSets";
import {
  toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4,
} from "@/lib/examTransformers";
import type {
  SpeakingPartType,
  SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data,
} from "@/data/speakingQuestions";
import type { SpeakingGradingResult, SpeakingItemGrading } from "@/components/speaking/speakingGrading";

interface Props {
  userId: string;
  examSetId: string;
  attemptCreatedAt: string;
  testTitle: string;
  partLabel: string;
  onExit: () => void;
  /** When present, scope grading queries to this aggregate row. */
  testResultId?: string;
  questionIndex?: number;
  onQuestionCount?: (n: number) => void;
}

const SIGNED_TTL = 50 * 60 * 1000;
const cacheKey = (id: string) => `rec_signed:${id}`;
const getCached = (id: string): string | null => {
  try {
    const raw = sessionStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (Date.now() > exp) { sessionStorage.removeItem(cacheKey(id)); return null; }
    return url as string;
  } catch { return null; }
};
const setCached = (id: string, url: string) => {
  try { sessionStorage.setItem(cacheKey(id), JSON.stringify({ url, exp: Date.now() + SIGNED_TTL })); } catch {}
};

const SpeakingReviewPage = ({
  userId, examSetId, attemptCreatedAt, testTitle, partLabel, onExit, testResultId,
  questionIndex, onQuestionCount,
}: Props) => {
  const [partType, setPartType] = useState<SpeakingPartType | null>(null);
  const [part1Data, setPart1Data] = useState<SpeakingPart1Data | undefined>();
  const [part2Data, setPart2Data] = useState<SpeakingPart2Data | undefined>();
  const [part3Data, setPart3Data] = useState<SpeakingPart3Data | undefined>();
  const [part4Data, setPart4Data] = useState<SpeakingPart4Data | undefined>();
  const [recordings, setRecordings] = useState<(string | null)[]>([]);
  const [gradings, setGradings] = useState<(SpeakingGradingResult | null)[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [promptCount, setPromptCount] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) onQuestionCount?.(promptCount);
  }, [promptCount, loading, onQuestionCount]);

  const effectiveIndex = questionIndex ?? reviewIndex;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // 1. Resolve part type + data from the exam_set's questions.
      const { data: setRow } = await supabase
        .from("exam_sets").select("part").eq("id", examSetId).maybeSingle();
      const pt = normalizePart((setRow?.part as string) || partLabel) as SpeakingPartType;
      const rows = await fetchExamQuestions(examSetId);
      let promptCount = 0;
      if (pt === "part1") { const d = toSpeakingPart1(rows); setPart1Data(d); promptCount = d.questions.length; }
      else if (pt === "part2") { const d = toSpeakingPart2(rows); setPart2Data(d); promptCount = (d.questions || [d.prompt]).length; }
      else if (pt === "part3") { const d = toSpeakingPart3(rows); setPart3Data(d); promptCount = (d.questions || [d.prompt]).length; }
      else if (pt === "part4") { const d = toSpeakingPart4(rows); setPart4Data(d); promptCount = 1; }
      setPartType(pt);

      const windowMs = 2 * 60 * 60 * 1000;
      const target = new Date(attemptCreatedAt).getTime();

      // 2. Recordings — match by user+examSetId, within time window.
      const { data: recsRaw } = await supabase
        .from("speaking_recordings")
        .select("id,part,audio_url,duration_seconds,created_at")
        .eq("user_id", userId)
        .eq("exam_set_id", examSetId)
        .order("created_at", { ascending: true });
      const recs = ((recsRaw || []) as any[]).filter(
        (r) => Math.abs(new Date(r.created_at).getTime() - target) < windowMs,
      );
      // recordings.part is like "part1_q1"; index by question position
      const recByIdx: (any | null)[] = new Array(Math.max(promptCount, 1)).fill(null);
      for (const r of recs) {
        const m = (r.part as string).match(/_q(\d+)/);
        const idx = m ? parseInt(m[1], 10) - 1 : -1;
        if (idx >= 0 && idx < recByIdx.length) recByIdx[idx] = r;
      }
      const signed = await Promise.all(
        recByIdx.map(async (r) => {
          if (!r) return null;
          const cached = getCached(r.id);
          if (cached) return cached;
          const { data: s } = await supabase.storage
            .from("speaking-recordings").createSignedUrl(r.audio_url, 3600);
          if (s?.signedUrl) setCached(r.id, s.signedUrl);
          return s?.signedUrl ?? null;
        }),
      );

      // 3. Gradings — match by test_result_id (preferred) + part label; fallback time window.
      let q = supabase
        .from("speaking_question_gradings")
        .select("item_index,max_points,part_score,transcript,grammar_errors,pronunciation_errors,improved_version,feedback,part,created_at")
        .eq("user_id", userId);
      if (testResultId) q = q.eq("test_result_id", testResultId);
      const { data: gradingRows } = await q;
      const matching = ((gradingRows || []) as any[])
        .filter((g) =>
          // Allow partLabel match in either direction ("Part 1" vs "Part 1")
          (g.part || "").toLowerCase().replace(/\s+/g, "") ===
            (partLabel || "").toLowerCase().replace(/\s+/g, "")
          && (testResultId || Math.abs(new Date(g.created_at).getTime() - target) < windowMs),
        )
        .sort((a, b) => a.item_index - b.item_index);
      const gradeArr: (SpeakingGradingResult | null)[] = new Array(Math.max(promptCount, 1)).fill(null);
      for (const g of matching) {
        const item: SpeakingItemGrading = {
          transcript: g.transcript || "",
          addressPercent: 0,
          grammarErrors: (g.grammar_errors as any) || [],
          pronunciationErrors: (g.pronunciation_errors as any) || [],
          timePenalty: 0,
          errorPenalty: 0,
          partScore: g.part_score || 0,
          maxPoints: g.max_points || 0,
          feedback: g.feedback || "",
          improvedVersion: g.improved_version || undefined,
        };
        if (g.item_index >= 0 && g.item_index < gradeArr.length) gradeArr[g.item_index] = item;
      }

      if (cancelled) return;
      setRecordings(signed);
      setGradings(gradeArr);
      setReviewIndex(0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, examSetId, attemptCreatedAt, partLabel, testResultId]);

  const skillHeader = useMemo(() => (
    <ExamHeader skillLabel="Speaking" partLabel={partLabel} onExit={onExit} />
  ), [partLabel, onExit]);

  if (loading || !partType) {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        {skillHeader}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      {skillHeader}
      <div className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <SpeakingReviewView
          partType={partType}
          part1Data={part1Data}
          part2Data={part2Data}
          part3Data={part3Data}
          part4Data={part4Data}
          recordings={recordings}
          gradings={gradings}
          reviewIndex={reviewIndex}
          onChangeIndex={setReviewIndex}
          onBack={onExit}
        />
      </div>
    </div>
  );
};

export default SpeakingReviewPage;

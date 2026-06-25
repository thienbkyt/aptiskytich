import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExamHeader from "@/components/exam/ExamHeader";
import SpeakingReviewView from "@/components/speaking/SpeakingReviewView";
import SpeakingProfileView from "@/components/speaking/SpeakingProfileView";
import { fetchExamQuestions, normalizePart } from "@/hooks/useExamSets";
import {
  toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4,
} from "@/lib/examTransformers";
import type {
  SpeakingPartType,
  SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data,
} from "@/data/speakingQuestions";
import {
  buildSpeakingGradingSpecs, gradeSpeakingSpec, blobToBase64,
  encodeAnalysisFeedback, decodeAnalysisFeedback,
  type SpeakingGradingResult, type SpeakingItemGrading,
} from "@/components/speaking/speakingGrading";
import { safeSessionStorage } from "@/lib/safeStorage";
import { toTimeSafe } from "@/lib/safeDate";

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
    const raw = safeSessionStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (Date.now() > exp) { safeSessionStorage.removeItem(cacheKey(id)); return null; }
    return url as string;
  } catch { return null; }
};
const setCached = (id: string, url: string) => {
  safeSessionStorage.setItem(cacheKey(id), JSON.stringify({ url, exp: Date.now() + SIGNED_TTL }));
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
  const [v2Part, setV2Part] = useState<any | null>(null);
  const [v2Scale, setV2Scale] = useState<number | null>(null);
  const [v2Cefr, setV2Cefr] = useState<string | null>(null);
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

      // 2. Recordings — scoped by test_result_id (preferred). Fallback to
      // user+examSetId only for legacy rows where test_result_id is NULL.
      let recsRaw: any[] = [];
      if (testResultId) {
        const { data } = await supabase
          .from("speaking_recordings")
          .select("id,part,audio_url,duration_seconds,created_at,test_result_id")
          .eq("user_id", userId)
          .eq("test_result_id", testResultId)
          .order("created_at", { ascending: true });
        recsRaw = (data || []) as any[];
      }
      if (recsRaw.length === 0) {
        // Legacy fallback: rows without test_result_id, scoped by examSetId + time window.
        const windowMs = 2 * 60 * 60 * 1000;
        const target = toTimeSafe(attemptCreatedAt);
        const { data: legacy } = await supabase
          .from("speaking_recordings")
          .select("id,part,audio_url,duration_seconds,created_at,test_result_id")
          .eq("user_id", userId)
          .eq("exam_set_id", examSetId)
          .is("test_result_id", null)
          .order("created_at", { ascending: true });
        recsRaw = ((legacy || []) as any[]).filter(
          (r) => !target || Math.abs(toTimeSafe(r.created_at) - target) < windowMs,
        );
      }
      // recordings.part is like "part1_q1"; index by question position
      const recByIdx: (any | null)[] = new Array(Math.max(promptCount, 1)).fill(null);
      for (const r of recsRaw) {
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

      // 3. Gradings — scoped strictly by test_result_id (no part-label filter,
      // no time-window fallback). Each test_result_id maps to exactly one part.
      let matching: any[] = [];
      if (testResultId) {
        const { data: gradingRows } = await supabase
          .from("speaking_question_gradings")
          .select("item_index,max_points,part_score,transcript,grammar_errors,pronunciation_errors,improved_version,feedback,part")
          .eq("user_id", userId)
          .eq("test_result_id", testResultId)
          .order("item_index", { ascending: true });
        matching = (gradingRows || []) as any[];
      }
      const gradeArr: (SpeakingGradingResult | null)[] = new Array(Math.max(promptCount, 1)).fill(null);
      for (const g of matching) {
        const { analysis, feedback } = decodeAnalysisFeedback(g.feedback as any);
        const item: SpeakingItemGrading = {
          transcript: g.transcript || "",
          addressPercent: 0,
          grammarErrors: (g.grammar_errors as any) || [],
          pronunciationErrors: (g.pronunciation_errors as any) || [],
          timePenalty: 0,
          errorPenalty: 0,
          partScore: g.part_score || 0,
          maxPoints: g.max_points || 0,
          feedback,
          analysis,
          improvedVersion: g.improved_version || undefined,
        };
        if (g.item_index >= 0 && g.item_index < gradeArr.length) gradeArr[g.item_index] = item;
      }

      // 4. NEW system (speaking_skill_results) — try test_result_id, then
      // fall back to full_test_session_id / fullPartSession from test_results.
      let v2Row: any = null;
      if (testResultId) {
        const { data } = await (supabase as any)
          .from("speaking_skill_results")
          .select("parts,scale50,cefr")
          .eq("user_id", userId)
          .eq("test_result_id", testResultId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data && (data.parts as any)?.[pt]) v2Row = data;
      }
      if (!v2Row && testResultId) {
        try {
          const { data: tr } = await supabase
            .from("test_results").select("skill_scores")
            .eq("id", testResultId).maybeSingle();
          const ss: any = tr?.skill_scores || {};
          const ssid: string | null = ss.fullTestSession || ss.fullPartSession || null;
          if (ssid) {
            const { data } = await (supabase as any)
              .from("speaking_skill_results")
              .select("parts,scale50,cefr")
              .eq("user_id", userId)
              .eq("full_test_session_id", ssid)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (data && (data.parts as any)?.[pt]) v2Row = data;
          }
        } catch (e) {
          console.warn("[SpeakingReviewPage] v2 session lookup failed", e);
        }
      }

      if (cancelled) return;
      setRecordings(signed);
      setGradings(gradeArr);
      setV2Part(v2Row ? (v2Row.parts as any)[pt] : null);
      setV2Scale(v2Row?.scale50 ?? null);
      setV2Cefr(v2Row?.cefr ?? null);
      setReviewIndex(0);
      setPromptCount(Math.max(promptCount, 1));
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

  const handleRegrade = async (gIdx: number) => {
    const url = recordings[partType === "part4" ? 0 : gIdx];
    if (!url) return;
    const specs = buildSpeakingGradingSpecs(partType, {
      part1Data, part2Data, part3Data, part4Data,
    });
    const spec = specs[gIdx];
    if (!spec) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const base64 = await blobToBase64(blob);
      const r = await gradeSpeakingSpec(spec, base64, spec.speakTime);
      setGradings((prev) => {
        const next = prev.slice();
        next[gIdx] = r;
        return next;
      });
      if (!("error" in r)) {
        // Best-effort upsert into speaking_question_gradings (delete old + insert).
        try {
          let del = supabase
            .from("speaking_question_gradings")
            .delete()
            .eq("user_id", userId)
            .eq("part", partLabel)
            .eq("item_index", gIdx);
          if (testResultId) del = del.eq("test_result_id", testResultId);
          await del;
          await supabase.from("speaking_question_gradings").insert({
            user_id: userId,
            test_result_id: testResultId ?? null,
            exam_set_id: examSetId,
            part: partLabel,
            item_index: gIdx,
            question_text: spec.questionText,
            max_points: r.maxPoints ?? 0,
            part_score: r.partScore ?? 0,
            transcript: r.transcript ?? null,
            grammar_errors: (r.grammarErrors ?? []) as any,
            pronunciation_errors: (r.pronunciationErrors ?? []) as any,
            improved_version: r.improvedVersion ?? null,
            feedback: encodeAnalysisFeedback(r.analysis, r.feedback ?? ""),
          } as any);
        } catch (e) {
          console.warn("[SpeakingReviewPage] persist regrade failed", e);
        }
      }
    } catch (e) {
      console.warn("[SpeakingReviewPage] regrade failed", e);
    }
  };

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
          reviewIndex={effectiveIndex}
          onChangeIndex={setReviewIndex}
          onBack={onExit}
          hidePager={questionIndex !== undefined}
          onRegrade={handleRegrade}
        />
      </div>
    </div>
  );
};

export default SpeakingReviewPage;

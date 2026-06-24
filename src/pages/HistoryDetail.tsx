import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, RotateCcw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import HistoryReviewPager, { type ReviewPage } from "@/components/history/HistoryReviewPager";
import { toTimeSafe } from "@/lib/safeDate";

interface ResultRow {
  id: string;
  created_at: string;
  score: number;
  total: number;
  level: string;
  time_spent: number | null;
  exam_set_id: string | null;
  skill_scores: any;
}

interface QuestionDetail {
  id: string;
  question_text: string;
  options: any;
  correct_answer: number | null;
  explanation: string | null;
  user_answer: string | null;
  is_correct: boolean;
  order_index: number;
}

interface RecordingRow {
  id: string;
  part: string;
  audio_url: string;
  signed_url?: string;
  duration_seconds: number | null;
}

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar", reading: "Reading", listening: "Listening",
  speaking: "Speaking", writing: "Writing",
};
const SKILL_ROUTES: Record<string, string> = {
  grammar: "/grammar", grammar_vocab: "/grammar", grammar_vocabulary: "/grammar",
  reading: "/reading", listening: "/listening",
  speaking: "/speaking", writing: "/writing",
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const formatDuration = (s: number | null) => {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec}s`;
};

const HistoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startReview = searchParams.has("review");
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<ResultRow | null>(null);
  const [setInfo, setSetInfo] = useState<{ title: string; skill: string; part: string } | null>(null);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [history, setHistory] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewPages, setReviewPages] = useState<ReviewPage[]>([]);
  const [reviewInitialIdx, setReviewInitialIdx] = useState(0);

  // Auto-enter review mode when requested via URL and pages are ready.
  useEffect(() => {
    if (startReview && reviewPages.length > 0 && !reviewing) {
      setReviewing(true);
    }
  }, [startReview, reviewPages.length, reviewing]);

  // When toggling between summary/review, scroll to top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [reviewing]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: r } = await supabase
          .from("test_results")
          .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!r) { if (!cancelled) setNotFound(true); return; }
        if (cancelled) return;
        setResult(r as ResultRow);

        let skill = (r.skill_scores as any)?.skill || "unknown";
        if (r.exam_set_id) {
          const { data: s } = await supabase
            .from("exam_sets").select("title,skill,part,full_test_id").eq("id", r.exam_set_id).maybeSingle();
          if (s) { setSetInfo(s as any); skill = (s as any).skill; }
          // History of attempts on same set
          const { data: hist } = await supabase
            .from("test_results")
            .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores")
            .eq("user_id", user.id).eq("exam_set_id", r.exam_set_id)
            .order("created_at", { ascending: false });
          if (!cancelled) setHistory((hist || []) as any);

          // Build review pages: if exam_set is part of a single-skill Full Part group,
          // include all sibling parts under the same full_test_id as separate pages.
          const ftId = (s as any)?.full_test_id ?? null;
          const norm = (sk: string) => (sk === "grammar_vocab" || sk === "grammar_vocabulary" ? "grammar" : sk);
          let pages: ReviewPage[] = [{
            testResultId: r.id,
            examSetId: r.exam_set_id,
            skill: norm((s as any)?.skill || skill),
            part: (s as any)?.part || "",
            testTitle: (s as any)?.title || "",
            attemptCreatedAt: r.created_at,
          }];
          let initialIdx = 0;
          if (ftId) {
            // Fetch all sets in the same full_test group
            const { data: sibSets } = await supabase
              .from("exam_sets")
              .select("id,title,skill,part")
              .eq("full_test_id", ftId);
            const setIds = (sibSets || []).map((x: any) => x.id);
            if (setIds.length > 1) {
              // Find latest test_result per sibling set for this user, in the same attempt window
              const target = toTimeSafe(r.created_at);
              const { data: sibResults } = await supabase
                .from("test_results")
                .select("id,exam_set_id,created_at")
                .eq("user_id", user.id)
                .in("exam_set_id", setIds);
              const setMap: Record<string, any> = {};
              (sibSets || []).forEach((x: any) => { setMap[x.id] = x; });
              const partNum = (p: string) => {
                const m = (p || "").match(/(\d)/);
                return m ? parseInt(m[1], 10) : 99;
              };
              // For each sibling set, pick closest result within 4h window; else skip
              const picked: { resultId: string; setId: string; createdAt: string; setRow: any }[] = [];
              for (const sid of setIds) {
                const matches = (sibResults || [])
                  .filter((x: any) => x.exam_set_id === sid)
                  .map((x: any) => ({ ...x, delta: Math.abs(toTimeSafe(x.created_at) - target) }))
                  .sort((a: any, b: any) => a.delta - b.delta);
                const best = matches[0];
                if (best && best.delta < 4 * 60 * 60 * 1000) {
                  picked.push({ resultId: best.id, setId: sid, createdAt: best.created_at, setRow: setMap[sid] });
                }
              }
              picked.sort((a, b) => partNum(a.setRow?.part || "") - partNum(b.setRow?.part || ""));
              if (picked.length > 1) {
                pages = picked.map((p) => ({
                  testResultId: p.resultId,
                  examSetId: p.setId,
                  skill: norm(p.setRow?.skill || skill),
                  part: p.setRow?.part || "",
                  testTitle: p.setRow?.title || "",
                  attemptCreatedAt: p.createdAt,
                }));
                initialIdx = Math.max(0, pages.findIndex((pg) => pg.testResultId === r.id));
              }
            }
          }
          if (!cancelled) { setReviewPages(pages); setReviewInitialIdx(initialIdx); }
        }

        // Per-question results
        const { data: qResults } = await supabase
          .from("exam_question_results")
          .select("exam_question_id,user_answer,is_correct")
          .eq("test_result_id", id);
        const qIds = (qResults || []).map((q: any) => q.exam_question_id);
        if (qIds.length > 0) {
          const { data: qs } = await supabase
            .from("exam_questions")
            .select("id,question_text,options,correct_answer,explanation,order_index")
            .in("id", qIds);
          const qMap: Record<string, any> = {};
          (qs || []).forEach((q: any) => { qMap[q.id] = q; });
          const merged: QuestionDetail[] = (qResults || [])
            .map((qr: any) => {
              const q = qMap[qr.exam_question_id];
              if (!q) return null;
              return {
                id: q.id, question_text: q.question_text, options: q.options,
                correct_answer: q.correct_answer, explanation: q.explanation,
                order_index: q.order_index ?? 0,
                user_answer: qr.user_answer, is_correct: qr.is_correct,
              } as QuestionDetail;
            })
            .filter(Boolean) as QuestionDetail[];
          merged.sort((a, b) => a.order_index - b.order_index);
          if (!cancelled) setQuestions(merged);
        }

        // Speaking recordings
        if (skill === "speaking" && r.exam_set_id) {
          const { data: recs } = await supabase
            .from("speaking_recordings")
            .select("id,part,audio_url,duration_seconds,created_at")
            .eq("user_id", user.id).eq("exam_set_id", r.exam_set_id)
            .order("created_at", { ascending: false });
          // Take recordings from the same attempt window (within 2h of result.created_at)
          const target = toTimeSafe(r.created_at);
          const sameAttempt = (recs || []).filter((rec: any) =>
            Math.abs(toTimeSafe(rec.created_at) - target) < 2 * 60 * 60 * 1000
          );
          const signed = await Promise.all(sameAttempt.map(async (rec: any) => {
            const { data } = await supabase.storage
              .from("speaking-recordings").createSignedUrl(rec.audio_url, 3600);
            return { ...rec, signed_url: data?.signedUrl };
          }));
          // Sort by part name
          signed.sort((a, b) => (a.part > b.part ? 1 : -1));
          if (!cancelled) setRecordings(signed as any);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20 section-container"><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const skill = setInfo?.skill || (result?.skill_scores as any)?.skill || "unknown";
  const pct = result && result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;

  // Review mode: render via HistoryReviewPager (single or multi-part).
  if (reviewing && result && reviewPages.length > 0) {
    return (
      <HistoryReviewPager
        pages={reviewPages}
        initialPageIdx={reviewInitialIdx}
        userId={user.id}
        onExit={() => {
          if (startReview) {
            navigate("/history", { replace: true });
          } else {
            setReviewing(false);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="section-container max-w-4xl">
          <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" /> Quay lại lịch sử
          </Link>


          {notFound ? (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">Không tìm thấy kết quả này.</p>
            </div>
          ) : loading || !result ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <>
              {/* Summary */}
              <div className="glass-card p-6 md:p-8 mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="secondary">{SKILL_LABELS[skill] || skill}</Badge>
                  {setInfo?.part && <Badge variant="outline">{setInfo.part}</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground mb-4">
                  {setInfo?.title || "Đề mẫu"}
                </h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Điểm số" value={`${result.score}/${result.total}`} />
                  <Stat label="Tỉ lệ" value={`${pct}%`} />
                  <Stat label="Band level" value={result.level} highlight />
                  <Stat label="Thời gian" value={formatDuration(result.time_spent)} icon={<Clock className="w-3.5 h-3.5" />} />
                </div>

                {/* Đúng / Sai / Bỏ trống chips */}
                {questions.length > 0 && (() => {
                  const correct = questions.filter((q) => q.is_correct).length;
                  const attempted = questions.filter((q) => q.user_answer != null && q.user_answer !== "").length;
                  const blank = questions.length - attempted;
                  const wrong = attempted - correct;
                  return (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đúng {correct}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/5 text-destructive border border-destructive/20">
                        <XCircle className="w-3.5 h-3.5" /> Sai {wrong}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        Bỏ trống {blank}
                      </span>
                    </div>
                  );
                })()}

                <div className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Làm bài lúc {formatDateTime(result.created_at)}
                </div>
              </div>

              {/* Attempts comparison */}
              {history.length > 1 && (
                <div className="glass-card p-6 mb-6">
                  <h2 className="font-heading font-bold text-foreground mb-4">Các lần làm bộ đề này</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">Ngày làm</th>
                          <th className="py-2 pr-4">Điểm</th>
                          <th className="py-2 pr-4">Tỉ lệ</th>
                          <th className="py-2">Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => {
                          const hp = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
                          const isCurrent = h.id === result.id;
                          const rowCls = `border-b border-border last:border-0 ${isCurrent ? "bg-primary/5" : "tech-row cursor-pointer"}`;
                          const cells = (
                            <>
                              <td className="py-2.5 pr-4 text-foreground">{formatDateTime(h.created_at)}{isCurrent && <span className="ml-2 text-xs text-primary">(lần này)</span>}</td>
                              <td className="py-2.5 pr-4 text-foreground font-medium">{h.score}/{h.total}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{hp}%</td>
                              <td className="py-2.5"><Badge className="bg-primary/10 text-primary border-0">{h.level}</Badge></td>
                            </>
                          );
                          if (isCurrent) return <tr key={h.id} className={rowCls}>{cells}</tr>;
                          return (
                            <tr
                              key={h.id}
                              className={rowCls}
                              onClick={() => { window.location.href = `/history/${h.id}`; }}
                            >
                              {cells}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                {(questions.length > 0 || recordings.length > 0) && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setReviewing(true)}
                  >
                    <Eye className="w-4 h-4" /> Xem lại từng câu
                  </Button>
                )}
                <Link
                  to={
                    result.exam_set_id
                      ? `${SKILL_ROUTES[skill] || "/practice"}?set=${result.exam_set_id}`
                      : SKILL_ROUTES[skill] || "/practice"
                  }
                >
                  <Button className="gap-2"><RotateCcw className="w-4 h-4" />Làm lại</Button>
                </Link>
              </div>
            </>

          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Stat = ({ label, value, highlight, icon }: { label: string; value: string; highlight?: boolean; icon?: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</div>
    <div className={`font-heading font-bold ${highlight ? "text-primary text-xl" : "text-foreground text-lg"}`}>{value}</div>
  </div>
);

export default HistoryDetail;

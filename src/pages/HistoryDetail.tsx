import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, RotateCcw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";

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
  grammar: "/grammar", reading: "/reading", listening: "/listening",
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
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<ResultRow | null>(null);
  const [setInfo, setSetInfo] = useState<{ title: string; skill: string; part: string } | null>(null);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [history, setHistory] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviewing, setReviewing] = useState(false);

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
            .from("exam_sets").select("title,skill,part").eq("id", r.exam_set_id).maybeSingle();
          if (s) { setSetInfo(s as any); skill = (s as any).skill; }
          // History of attempts on same set
          const { data: hist } = await supabase
            .from("test_results")
            .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores")
            .eq("user_id", user.id).eq("exam_set_id", r.exam_set_id)
            .order("created_at", { ascending: false });
          if (!cancelled) setHistory((hist || []) as any);
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
          const target = new Date(r.created_at).getTime();
          const sameAttempt = (recs || []).filter((rec: any) =>
            Math.abs(new Date(rec.created_at).getTime() - target) < 2 * 60 * 60 * 1000
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="section-container max-w-4xl">
          {reviewing ? (
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại kết quả
            </button>
          ) : (
            <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="w-4 h-4" /> Quay lại lịch sử
            </Link>
          )}

          {notFound ? (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">Không tìm thấy kết quả này.</p>
            </div>
          ) : loading || !result ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <>
              {!reviewing && (
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
                              return (
                                <tr key={h.id} className={`border-b border-border last:border-0 ${isCurrent ? "bg-primary/5" : ""}`}>
                                  <td className="py-2.5 pr-4 text-foreground">{formatDateTime(h.created_at)}{isCurrent && <span className="ml-2 text-xs text-primary">(lần này)</span>}</td>
                                  <td className="py-2.5 pr-4 text-foreground font-medium">{h.score}/{h.total}</td>
                                  <td className="py-2.5 pr-4 text-muted-foreground">{hp}%</td>
                                  <td className="py-2.5"><Badge className="bg-primary/10 text-primary border-0">{h.level}</Badge></td>
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
                        className="gap-2 border-primary text-primary hover:bg-primary/10 hover:text-primary"
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

              {reviewing && (
                <>
                  {/* Speaking recordings */}
                  {skill === "speaking" && (
                    <div className="glass-card p-6 mb-6">
                      <h2 className="font-heading font-bold text-foreground mb-4">Bài ghi âm</h2>
                      {recordings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Không có file ghi âm cho lần thi này.</p>
                      ) : (
                        <div className="space-y-4">
                          {recordings.map((rec) => (
                            <div key={rec.id} className="p-3 rounded-lg bg-muted/40">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-foreground">{rec.part.toUpperCase()}</span>
                                {rec.duration_seconds != null && (
                                  <span className="text-xs text-muted-foreground">{rec.duration_seconds}s</span>
                                )}
                              </div>
                              {rec.signed_url ? (
                                <audio controls src={rec.signed_url} className="w-full" />
                              ) : (
                                <p className="text-xs text-muted-foreground">Không tải được file ghi âm.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-question list */}
                  {skill !== "speaking" && questions.length > 0 && (
                    <div className="glass-card p-6 mb-6">
                      <h2 className="font-heading font-bold text-foreground mb-4">Chi tiết câu hỏi</h2>
                      <div className="space-y-5">
                        {questions.map((q, idx) => {
                          const opts = Array.isArray(q.options) ? q.options : [];
                          return (
                            <div key={q.id} className="border border-border rounded-xl p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <span className="text-xs font-bold text-muted-foreground mt-0.5">Câu {idx + 1}</span>
                                {q.is_correct ? (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                              </div>
                              <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{q.question_text}</p>
                              {opts.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                  {opts.map((opt: any, i: number) => {
                                    const text = typeof opt === "string" ? opt : opt?.text ?? String(opt);
                                    const isCorrect = q.correct_answer === i;
                                    const userIdx = q.user_answer != null ? parseInt(q.user_answer, 10) : -1;
                                    const isUser = userIdx === i;
                                    return (
                                      <div key={i} className={`text-sm px-3 py-1.5 rounded-md border ${
                                        isCorrect ? "border-success/40 bg-success/10 text-foreground"
                                        : isUser ? "border-destructive/40 bg-destructive/10 text-foreground"
                                        : "border-border text-muted-foreground"
                                      }`}>
                                        <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>{text}
                                        {isCorrect && <span className="ml-2 text-xs text-success font-medium">✓ Đáp án đúng</span>}
                                        {isUser && !isCorrect && <span className="ml-2 text-xs text-destructive font-medium">Bạn chọn</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {q.user_answer && (!opts || opts.length === 0) && (
                                <div className="text-xs text-muted-foreground mb-2">
                                  <span>Đáp án của bạn: </span>
                                  {(() => {
                                    const raw = q.user_answer!;
                                    try {
                                      const parsed = JSON.parse(raw);
                                      if (Array.isArray(parsed)) {
                                        return <span className="text-foreground">{parsed.map((v, i) => `${i + 1}. ${v ?? "—"}`).join("  •  ")}</span>;
                                      }
                                      if (parsed && typeof parsed === "object") {
                                        return <span className="text-foreground">{Object.entries(parsed).map(([k, v]) => `${k}: ${v ?? "—"}`).join("  •  ")}</span>;
                                      }
                                      return <span className="text-foreground whitespace-pre-wrap">{String(parsed)}</span>;
                                    } catch {
                                      return <span className="text-foreground whitespace-pre-wrap">{raw}</span>;
                                    }
                                  })()}
                                </div>
                              )}
                              {q.explanation && (
                                <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
                                  <strong className="text-foreground">Giải thích: </strong>{q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button variant="outline" className="gap-2" onClick={() => setReviewing(false)}>
                      <ArrowLeft className="w-4 h-4" /> Quay lại kết quả
                    </Button>
                  </div>
                </>
              )}
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

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Trophy, RotateCcw, Eye,
  Mic, Headphones, Brain, BookOpen, PenLine, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLevel, getLevelColor } from "@/data/questions";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";

interface SessionRow {
  id: string;
  created_at: string;
  score: number;
  total: number;
  level: string;
  exam_set_id: string | null;
  skill_scores: any;
  setTitle?: string;
  setSkill?: string;
  setPart?: string;
  skill: string; // normalized
}

type SkillKey = "speaking" | "listening" | "grammar" | "reading" | "writing";

const SKILL_ORDER: SkillKey[] = ["speaking", "listening", "grammar", "reading", "writing"];
const SKILL_LABELS: Record<SkillKey, string> = {
  speaking: "Speaking", listening: "Listening",
  grammar: "Grammar & Vocabulary", reading: "Reading", writing: "Writing",
};
const SKILL_ICONS: Record<SkillKey, React.ElementType> = {
  speaking: Mic, listening: Headphones, grammar: Brain, reading: BookOpen, writing: PenLine,
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const FullTestHistoryDetail = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [title, setTitle] = useState<string>("Bài thi thử Aptis");
  const [fullTestId, setFullTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Review state — which row we are reviewing
  const [reviewRow, setReviewRow] = useState<SessionRow | null>(null);
  const [reviewQResults, setReviewQResults] = useState<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: rs } = await supabase
          .from("test_results")
          .select("id,created_at,score,total,level,exam_set_id,skill_scores,full_test_id")
          .eq("user_id", user.id)
          .eq("full_test_session_id", sessionId)
          .order("created_at", { ascending: true });
        if (!rs || rs.length === 0) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const ftId = (rs[0] as any).full_test_id ?? null;
        if (ftId && !cancelled) {
          const { data: ft } = await supabase.from("full_tests").select("title").eq("id", ftId).maybeSingle();
          if (ft?.title) setTitle(ft.title);
          setFullTestId(ftId);
        }
        const setIds = Array.from(new Set(rs.map((r: any) => r.exam_set_id).filter(Boolean)));
        const setsMap: Record<string, { title: string; skill: string; part: string }> = {};
        if (setIds.length > 0) {
          const { data: sets } = await supabase
            .from("exam_sets").select("id,title,skill,part").in("id", setIds);
          (sets || []).forEach((s: any) => { setsMap[s.id] = s; });
        }
        const mapped: SessionRow[] = rs.map((r: any) => {
          const s = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
          let skill = s?.skill || (r.skill_scores?.skill) || "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
          return {
            ...r,
            setTitle: s?.title, setSkill: s?.skill, setPart: s?.part, skill,
          } as SessionRow;
        });
        if (!cancelled) setRows(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, sessionId]);

  // Aggregate per skill
  const skillAgg = useMemo(() => {
    const acc: Record<SkillKey, { correct: number; total: number; rows: SessionRow[] }> = {
      speaking: { correct: 0, total: 0, rows: [] },
      listening: { correct: 0, total: 0, rows: [] },
      grammar: { correct: 0, total: 0, rows: [] },
      reading: { correct: 0, total: 0, rows: [] },
      writing: { correct: 0, total: 0, rows: [] },
    };
    for (const r of rows) {
      const sk = (r.skill as SkillKey);
      if (!acc[sk]) continue;
      acc[sk].correct += r.score || 0;
      acc[sk].total += r.total || 0;
      acc[sk].rows.push(r);
    }
    return acc;
  }, [rows]);

  const totals = useMemo(() => {
    let correct = 0, total = 0;
    for (const r of rows) { correct += r.score; total += r.total; }
    return { correct, total };
  }, [rows]);

  const overallLevel = totals.total > 0
    ? getLevel(Math.round((totals.correct / totals.total) * 100), 100)
    : "—";

  const handleReview = async (r: SessionRow) => {
    setReviewRow(r);
    setReviewLoading(true);
    setReviewQResults([]);
    try {
      const { data } = await supabase
        .from("exam_question_results")
        .select("exam_question_id,user_answer,is_correct")
        .eq("test_result_id", r.id);
      setReviewQResults((data || []) as any);
    } finally {
      setReviewLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20 section-container"><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // Full-screen review of one skill/row
  if (reviewRow) {
    if (reviewLoading || !reviewRow.exam_set_id) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Skeleton className="h-32 w-64" />
        </div>
      );
    }
    if (reviewRow.skill === "speaking") {
      // Speaking review uses the standard HistoryDetail page; fallback navigate.
      return (
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="flex-1 pt-24 pb-16">
            <div className="section-container max-w-4xl">
              <button onClick={() => setReviewRow(null)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
                <ArrowLeft className="w-4 h-4" /> Quay lại kết quả
              </button>
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground mb-4">Xem chi tiết phần Speaking trong trang lịch sử riêng.</p>
                <Link to={`/history/${reviewRow.id}`}>
                  <Button>Mở chi tiết Speaking</Button>
                </Link>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    return (
      <HistoryReviewRenderer
        examSetId={reviewRow.exam_set_id}
        skill={reviewRow.skill}
        part={reviewRow.setPart || ""}
        testTitle={`${title} – ${SKILL_LABELS[reviewRow.skill as SkillKey] || reviewRow.skill}`}
        qResults={reviewQResults}
        onExit={() => setReviewRow(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="section-container max-w-4xl">
          <Link to="/history?skill=fulltest" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" /> Quay lại lịch sử
          </Link>

          {notFound ? (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">Không tìm thấy lần thi Full Test này.</p>
            </div>
          ) : loading || rows.length === 0 ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <>
              {/* Summary */}
              <div className="glass-card p-6 md:p-8 mb-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-primary" />
                </div>
                <Badge className="bg-primary/10 text-primary border-0 mb-3 gap-1">
                  <Trophy className="w-3 h-3" /> Full Test
                </Badge>
                <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground mb-2">{title}</h1>
                <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {formatDateTime(rows[0].created_at)}
                </p>
                {totals.total > 0 && (
                  <div className="inline-flex items-center gap-2 bg-muted rounded-xl px-5 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Trình độ tổng thể:</span>
                    <span className={`text-lg font-heading font-extrabold ${getLevelColor(overallLevel)}`}>{overallLevel}</span>
                    <span className="text-sm text-muted-foreground ml-2">• {totals.correct}/{totals.total}</span>
                  </div>
                )}
              </div>

              {/* Per-skill cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {SKILL_ORDER.map((sk) => {
                  const agg = skillAgg[sk];
                  const Icon = SKILL_ICONS[sk];
                  const pct = agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0;
                  const lvl = agg.total > 0 ? getLevel(agg.correct, agg.total) : null;
                  // For grammar there's exactly one row (merged). For others, list per-part.
                  return (
                    <div key={sk} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-heading font-bold text-foreground text-sm">{SKILL_LABELS[sk]}</p>
                            {lvl ? (
                              <p className={`text-[11px] font-bold ${getLevelColor(lvl)}`}>Band {lvl} • {pct}%</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">Chưa có dữ liệu</p>
                            )}
                          </div>
                        </div>
                        {agg.total > 0 && (
                          <span className="text-sm font-bold text-foreground">{agg.correct}/{agg.total}</span>
                        )}
                      </div>

                      {agg.rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">—</p>
                      ) : (
                        <div className="space-y-2">
                          {agg.rows.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => handleReview(r)}
                              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                            >
                              <span className="text-xs text-foreground truncate">
                                {r.setPart || "Phần"} {r.setTitle ? `– ${r.setTitle}` : ""}
                              </span>
                              <span className="text-xs text-primary inline-flex items-center gap-1 shrink-0 group-hover:underline">
                                <Eye className="w-3 h-3" /> Xem lại
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Link to="/thi-thu">
                  <Button className="gap-2"><RotateCcw className="w-4 h-4" />Làm lại Full Test</Button>
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

export default FullTestHistoryDetail;

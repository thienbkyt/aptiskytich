import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Plus, Play, Pencil, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import CustomSetBuilder from "@/components/mysets/CustomSetBuilder";
import FullTestEngine from "@/components/fulltest/FullTestEngine";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import {
  useCustomSets,
  deleteCustomSet,
  touchCustomSetPlayed,
  SKILL_LABELS_VI,
  type CustomSetRow,
} from "@/hooks/useCustomSets";
import { safeFormatDateTime } from "@/lib/safeDate";

type View = { kind: "list" } | { kind: "create" } | { kind: "edit"; set: CustomSetRow } | { kind: "play"; set: CustomSetRow };

const MySets = () => {
  usePageMeta({
    title: "Bộ đề của tôi — Tự tạo full test & full part | Aptis Kỳ Tích",
    description: "Tự tạo bộ đề Aptis từ các đề lẻ: full test 5 kỹ năng hoặc full part theo kỹ năng, chấm AI và lưu lịch sử như bộ đề chính thức.",
    path: "/my-sets",
  });

  const { user, loading: authLoading } = useAuth();
  const { isPro } = useIsPro();
  const { sets, loading, invalidate } = useCustomSets();
  const [view, setView] = useState<View>({ kind: "list" });

  const startPlay = async (set: CustomSetRow) => {
    setView({ kind: "play", set });
    touchCustomSetPlayed(set.id).then(invalidate);
  };

  if (view.kind === "play") {
    const set = view.set;
    const back = () => { setView({ kind: "list" }); invalidate(); };
    if (set.mode === "full_test") {
      return <FullTestEngine testId={set.id} testTitle={set.title} onExit={back} customSetId={set.id} />;
    }
    return (
      <SkillFullPracticeEngine
        fullTestId={set.id}
        customSetId={set.id}
        skill={(set.skill || "reading") as any}
        testTitle={set.title}
        onExit={back}
      />
    );
  }

  const freeBlocked = !isPro && sets.length >= 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                    Bộ đề của tôi
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Tự ghép các đề lẻ thành một bộ full test (5 kỹ năng) hoặc full part (1 kỹ năng).
                  Làm bài vẫn được AI chấm, lưu lịch sử và tính band như bộ đề chính thức.
                </p>
              </div>
              {view.kind === "list" && (
                <Button
                  onClick={() => setView({ kind: "create" })}
                  disabled={!user || freeBlocked}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" /> Tạo bộ đề mới
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="section-container py-8">
          {!user && !authLoading ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">Đăng nhập để tạo và lưu bộ đề của riêng bạn.</p>
              <Button asChild className="mt-4"><Link to="/auth">Đăng nhập</Link></Button>
            </div>
          ) : view.kind === "create" || view.kind === "edit" ? (
            <CustomSetBuilder
              editing={view.kind === "edit" ? view.set : null}
              onDone={() => { invalidate(); setView({ kind: "list" }); }}
              onCancel={() => setView({ kind: "list" })}
            />
          ) : (
            <>
              {freeBlocked && (
                <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center gap-3">
                  <Crown className="w-5 h-5 text-primary" />
                  <p className="text-sm text-foreground flex-1">
                    Tài khoản miễn phí chỉ giữ được 1 bộ đề. Nâng cấp Pro để tạo không giới hạn.
                  </p>
                  <Button asChild size="sm"><Link to="/pricing">Nâng cấp</Link></Button>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                </div>
              ) : sets.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-10 text-center">
                  <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium text-sm">Bạn chưa có bộ đề nào</p>
                  <Button className="mt-4 gap-2" onClick={() => setView({ kind: "create" })}>
                    <Plus className="w-4 h-4" /> Tạo bộ đề đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sets.map((s) => (
                    <div key={s.id} className="border border-border rounded-xl bg-card p-5 flex flex-col gap-3">
                      <div>
                        <h3 className="font-heading font-semibold text-foreground">{s.title}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.mode === "full_test" ? "Full test" : `Full part · ${SKILL_LABELS_VI[s.skill ?? ""] ?? s.skill}`}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{s.memberCount} đề</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {s.last_played_at
                            ? `Làm gần nhất: ${safeFormatDateTime(s.last_played_at)}`
                            : "Chưa làm lần nào"}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <Button size="sm" className="gap-1.5 flex-1" onClick={() => startPlay(s)}>
                          <Play className="w-3.5 h-3.5" /> Làm bài
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setView({ kind: "edit", set: s })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!confirm(`Xoá bộ đề "${s.title}"?`)) return;
                            try {
                              await deleteCustomSet(s.id);
                              toast.success("Đã xoá bộ đề");
                              invalidate();
                            } catch {
                              toast.error("Không xoá được bộ đề");
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default MySets;

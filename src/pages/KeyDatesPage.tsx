import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { CalendarDays, Infinity as InfinityIcon, ArrowRight, Inbox, BookOpen, Headphones, Mic, PenLine } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { normalizePart, type ExamSetRow } from "@/hooks/useExamSets";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useUserGradedProgress } from "@/hooks/useUserGradedProgress";
import { motion } from "framer-motion";

type SkillKey = "reading" | "listening" | "speaking" | "writing";

const SKILL_META: Record<SkillKey, { label: string; icon: any; route: string; supportsMarathon: boolean }> = {
  reading:   { label: "Reading",   icon: BookOpen,   route: "/reading",   supportsMarathon: true  },
  listening: { label: "Listening", icon: Headphones, route: "/listening", supportsMarathon: true  },
  speaking:  { label: "Speaking",  icon: Mic,        route: "/speaking",  supportsMarathon: false },
  writing:   { label: "Writing",   icon: PenLine,    route: "/writing",   supportsMarathon: false },
};

const PART_ORDER = ["part1", "part2", "part3", "part4"] as const;

const fmtDate = (d: string) => {
  // best-effort, accept YYYY-MM-DD or any parseable date
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
};

const KeyDatesPage = () => {
  usePageMeta({
    title: "Đề Key theo ngày | Aptis Kỳ Tích",
    description: "Chọn ngày dự đoán và luyện đề Aptis đã được gán key theo ngày. Marathon Reading/Listening hoặc luyện lẻ Speaking/Writing.",
    path: "/key",
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dates, setDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [sets, setSets] = useState<ExamSetRow[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const selectedDate = searchParams.get("date") || "";

  const { progress: rlProgress } = useUserExamProgress();
  const { progress: spProgress } = useUserGradedProgress("speaking");
  const { progress: wrProgress } = useUserGradedProgress("writing");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDates(true);
      const { data } = await supabase
        .from("exam_sets")
        .select("key_date")
        .not("key_date", "is", null)
        .eq("is_published", true);
      if (cancelled) return;
      const uniq = Array.from(new Set((data || []).map((r: any) => r.key_date as string).filter(Boolean)));
      uniq.sort().reverse();
      setDates(uniq);
      setLoadingDates(false);
      if (!selectedDate && uniq.length > 0) {
        setSearchParams({ date: uniq[0] }, { replace: true });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDate) { setSets([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingSets(true);
      const { data } = await supabase
        .from("exam_sets")
        .select("id, title, exam_type, skill, part, time_limit, description, is_published, created_at, access_tier, key_date")
        .eq("is_published", true)
        .eq("key_date", selectedDate);
      if (cancelled) return;
      setSets((data || []) as any as ExamSetRow[]);
      setLoadingSets(false);
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  const grouped = useMemo(() => {
    const out: Record<SkillKey, Record<string, ExamSetRow[]>> = {
      reading: {}, listening: {}, speaking: {}, writing: {},
    };
    sets.forEach((s) => {
      const skill = (s.skill as SkillKey);
      if (!out[skill]) return;
      const p = normalizePart(s.part);
      (out[skill][p] ||= []).push(s);
    });
    // sort each part list by title number
    const numOf = (t: string) => { const m = t.match(/\d+/); return m ? parseInt(m[0], 10) : 9999; };
    (Object.keys(out) as SkillKey[]).forEach((sk) => {
      Object.values(out[sk]).forEach((arr) => arr.sort((a, b) => numOf(a.title) - numOf(b.title) || a.title.localeCompare(b.title)));
    });
    return out;
  }, [sets]);

  const getBadgeItem = (skill: SkillKey, setId: string) => {
    if (skill === "reading" || skill === "listening") return rlProgress.get(setId);
    if (skill === "speaking") return spProgress.get(setId);
    if (skill === "writing") return wrProgress.get(setId);
    return undefined;
  };

  const openSet = (skill: SkillKey, setId: string) => {
    navigate(`${SKILL_META[skill].route}?set=${setId}`);
  };
  const openMarathon = (skill: SkillKey, part: string) => {
    navigate(`${SKILL_META[skill].route}?marathon=${part}&keyDate=${encodeURIComponent(selectedDate)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <section className="section-container">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Đề Key theo ngày</h1>
              <p className="text-sm text-muted-foreground">Chọn ngày dự đoán để luyện đề đã được gán key.</p>
            </div>
          </div>

          {/* Date chips */}
          <div className="mt-5 mb-8">
            {loadingDates ? (
              <div className="flex gap-2 flex-wrap">
                {[1,2,3,4].map((i) => <TechSkeleton key={i} variant="text" className="w-28 h-9" />)}
              </div>
            ) : dates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Chưa có ngày nào được gán key.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => {
                  const active = d === selectedDate;
                  return (
                    <button
                      key={d}
                      onClick={() => setSearchParams({ date: d }, { replace: true })}
                      className={[
                        "px-3.5 py-2 rounded-full text-sm font-medium border transition",
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-foreground border-border hover:bg-muted",
                      ].join(" ")}
                    >
                      {fmtDate(d)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedDate && (
            <>
              {loadingSets ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3].map((i) => <TechSkeleton key={i} variant="card" className="h-40" />)}
                </div>
              ) : sets.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Ngày này chưa có đề nào được gán.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {(Object.keys(SKILL_META) as SkillKey[]).map((skill) => {
                    const meta = SKILL_META[skill];
                    const partsMap = grouped[skill];
                    const partKeys = Object.keys(partsMap).sort((a, b) => {
                      const ia = PART_ORDER.indexOf(a as any); const ib = PART_ORDER.indexOf(b as any);
                      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                    });
                    if (partKeys.length === 0) return null;
                    const Icon = meta.icon;

                    return (
                      <div key={skill}>
                        <div className="flex items-center gap-2 mb-4">
                          <Icon className="w-5 h-5 text-primary" />
                          <h2 className="text-xl font-heading font-bold text-foreground">{meta.label}</h2>
                        </div>

                        <div className="space-y-6">
                          {partKeys.map((partKey) => {
                            const arr = partsMap[partKey];
                            const partLabel = partKey.replace("part", "Part ");
                            return (
                              <div key={partKey}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                  {meta.supportsMarathon && arr.length > 0 && (
                                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                                      <div className="group relative rounded-xl p-5 flex flex-col h-full border-2 border-primary/60 bg-gradient-to-br from-primary/10 via-accent/5 to-background shadow-lg shadow-primary/10">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Badge className="w-fit text-[11px] font-semibold bg-primary text-primary-foreground border-0 gap-1">
                                            <InfinityIcon className="w-3 h-3" /> Marathon
                                          </Badge>
                                          <Badge variant="secondary" className="text-[11px]">{partLabel}</Badge>
                                        </div>
                                        <h3 className="text-lg font-heading font-extrabold text-foreground mb-2">
                                          Marathon {partLabel} — Key {fmtDate(selectedDate)}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                          Làm liên tục {arr.length} đề của ngày này — không giới hạn giờ.
                                        </p>
                                        <div className="flex-1" />
                                        <div className="flex justify-end">
                                          <Button size="sm" onClick={() => openMarathon(skill, partKey)} className="gap-1.5 font-semibold">
                                            Bắt đầu <ArrowRight className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}

                                  {arr.map((s) => (
                                    <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                                      <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                                        <div className="absolute top-3 right-3">
                                          <CornerResultBadge item={getBadgeItem(skill, s.id)} />
                                        </div>
                                        <div className="flex items-center gap-2 mb-3">
                                          <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">{partLabel}</Badge>
                                        </div>
                                        <h3 className="text-lg font-heading font-bold text-foreground mb-3">{s.title}</h3>
                                        {s.description && (
                                          <p className="text-sm text-muted-foreground mb-4">📖 {s.description}</p>
                                        )}
                                        <div className="flex-1" />
                                        <div className="flex justify-end">
                                          <Button variant="ghost" size="sm" onClick={() => openSet(skill, s.id)} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                                            Luyện tập <ArrowRight className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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

export default KeyDatesPage;

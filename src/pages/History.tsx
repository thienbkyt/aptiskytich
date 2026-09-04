import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ArrowRight, Eye, RotateCcw, History as HistoryIcon, Calendar, Trophy,
  BookOpen, Headphones, Mic, Pencil, GraduationCap, ListChecks, CalendarDays,

} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readingPartLabel, normalizePart } from "@/hooks/useExamSets";
import { useAuth } from "@/hooks/useAuth";
import { HistorySkeleton, TechSkeletonRow } from "@/components/ui/tech-skeleton";
import { getSkillBand } from "@/data/questions";
import { computeHistoryDisplay } from "@/lib/historyDisplay";
import { toTimeSafe } from "@/lib/safeDate";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";

interface HistoryRow {
  id: string;
  created_at: string;
  score: number;
  total: number;
  level: string;
  time_spent: number | null;
  exam_set_id: string | null;
  skill: string;
  title: string;
  part: string;
  full_test_session_id: string | null;
  full_test_id: string | null;
  isMarathon: boolean;
  marathonMode: string | null;          // "marathon" | "marathon-set" | null
  marathonSessionId: string | null;
  marathonPartType: string | null;
  marathonLabel: string | null;
  fullPartSession: string | null;
  customSetId: string | null;
  customSetTitle: string | null;
  review_snapshot: any;
  // computed display
  displayScore: string;     // e.g. "12/25" or "8/10" or "—"
  displayBand: string;      // e.g. "B1" or "—"
  scorePct: number | null;  // for sorting/optional pct
}

interface FullTestGroup {
  sessionId: string;
  fullTestId: string | null;
  title: string;
  created_at: string;
  rows: HistoryRow[];
  totalScaled: number;     // sum of scaled50 per skill (max 250 = 5x50)
  hasScaled: boolean;
  skillCount: number;
  gvScaled: number | null;
  skillAgg: Record<string, { num: number; den: number }>;
  customSetTitle: string | null;
}

interface FullPartGroup {
  sessionId: string;
  skill: string;
  customSetTitle?: string | null;
  created_at: string;
  partCount: number;
  num: number;
  den: number;
  ungradedCount: number;
  displayScore: string;
  displayBand: string;
}

interface MarathonGroup {
  sessionId: string;
  skill: string;
  partType: string | null;
  label: string;
  created_at: string;
  setCount: number;
  score: number;
  total: number;
  reviewRowId: string | null;   // row có review_snapshot để "Xem lại"
}



const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  grammar_vocab: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

const SKILL_ROUTES: Record<string, string> = {
  grammar: "/grammar",
  grammar_vocab: "/grammar",
  reading: "/reading",
  listening: "/listening",
  speaking: "/speaking",
  writing: "/writing",
};

const VALID_MARATHON_PARTS = ["part1", "part2", "part3", "part4"];

const PAGE_SIZE = 50;

const SKILL_ICON: Record<string, any> = {
  grammar: GraduationCap,
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: Pencil,
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay() || 7; // Mon=1..Sun=7
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  return d;
};

const computeDisplay = computeHistoryDisplay;

const formatMarathonLabel = (partType: string | null, skill: string) => {
  if (!partType) return "Marathon";
  if (skill === "reading") return `Marathon · ${readingPartLabel(partType)}`;
  const n = partType.replace(/^part/i, "");
  return `Marathon · Part ${n}`;
};

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const skillFilter = params.get("skill") || "all";
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [fullTestGroups, setFullTestGroups] = useState<FullTestGroup[]>([]);
  const [fullPartGroups, setFullPartGroups] = useState<FullPartGroup[]>([]);
  const [marathonGroups, setMarathonGroups] = useState<MarathonGroup[]>([]);
  const [groupedMarathonRowIds, setGroupedMarathonRowIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Bài mà AI chấm lỗi hẳn → hiện nút "Chấm lại" thay cho dấu "—".
  const { jobsByResult: failedJobs, retry: retryGrading, retryingId } =
    useFailedGradingJobs(Boolean(user));
  const handleRetryGrading = async (jobId: string) => {
    const { ok, reason } = await retryGrading(jobId);
    if (ok) {
      toast({ title: "Đã gửi chấm lại", description: "Bài của bạn đang được chấm lại, kết quả cập nhật sau ít phút." });
    } else if (reason?.includes("retry_limit_reached")) {
      toast({ title: "Đã hết lượt chấm lại", description: "Mỗi bài chỉ được chấm lại tối đa 2 lần.", variant: "destructive" });
    } else {
      toast({ title: "Chưa gửi được", description: "Thử lại sau ít phút nhé.", variant: "destructive" });
    }
  };


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const warn = (table: string, error: any) => {
        console.error(`[History] query failed: ${table}`, error);
        setLoadError("Không tải được đầy đủ lịch sử, thử tải lại trang.");
      };
      try {
        // Tải theo lô để không bị Supabase cắt cứng ở 1.000 dòng
        const PAGE = 1000;
        const MAX_PAGES = 20;
        const results: any[] = [];
        let mainFailed = false;
        for (let page = 0; page < MAX_PAGES; page++) {
          const from = page * PAGE;
          const { data, error } = await supabase
            .from("test_results")
            .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores,full_test_session_id,full_test_id,review_snapshot")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (error) {
            warn("test_results", error);
            mainFailed = true;
            break;
          }
          const batch = data || [];
          results.push(...batch);
          if (batch.length < PAGE) break;
        }
        if (mainFailed) {
          if (!cancelled) setLoading(false);
          return;
        }

        const chunk = <T,>(arr: T[], size: number): T[][] => {
          const out: T[][] = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };
        const IN_CHUNK = 150;

        const setIds = Array.from(
          new Set((results || []).map((r: any) => r.exam_set_id).filter(Boolean))
        );
        const setsMap: Record<string, { title: string; skill: string; part: string }> = {};
        if (setIds.length > 0) {
          for (const ids of chunk(setIds, IN_CHUNK)) {
            const { data: sets, error } = await supabase
              .from("exam_sets")
              .select("id,title,skill,part")
              .in("id", ids);
            if (error) warn("exam_sets", error);
            (sets || []).forEach((s: any) => {
              setsMap[s.id] = { title: s.title, skill: s.skill, part: s.part };
            });
          }
        }

        const ftIds = Array.from(
          new Set((results || []).map((r: any) => r.full_test_id).filter(Boolean))
        );
        const ftMap: Record<string, string> = {};
        if (ftIds.length > 0) {
          for (const ids of chunk(ftIds, IN_CHUNK)) {
            const { data: fts, error } = await supabase
              .from("full_tests")
              .select("id,title")
              .in("id", ids);
            if (error) warn("full_tests", error);
            (fts || []).forEach((f: any) => { ftMap[f.id] = f.title; });
          }
        }

        // AI gradings aggregated per test_result_id
        const [{ data: wg, error: wgErr }, { data: sg, error: sgErr }] = await Promise.all([
          supabase
            .from("writing_question_gradings")
            .select("test_result_id,part_score,max_points")
            .eq("user_id", user.id),
          (supabase as any)
            .from("speaking_question_gradings")
            .select("test_result_id,part_score,max_points")
            .eq("user_id", user.id),
        ]);
        if (wgErr) warn("writing_question_gradings", wgErr);
        if (sgErr) warn("speaking_question_gradings", sgErr);
        const writingAggMap: Record<string, { sum: number; max: number }> = {};
        (wg || []).forEach((g: any) => {
          if (!g.test_result_id) return;
          const a = writingAggMap[g.test_result_id] || { sum: 0, max: 0 };
          a.sum += Number(g.part_score || 0);
          a.max += Number(g.max_points || 0);
          writingAggMap[g.test_result_id] = a;
        });
        const speakingAggMap: Record<string, { sum: number; max: number }> = {};
        (sg || []).forEach((g: any) => {
          if (!g.test_result_id) return;
          const a = speakingAggMap[g.test_result_id] || { sum: 0, max: 0 };
          a.sum += Number(g.part_score || 0);
          a.max += Number(g.max_points || 0);
          speakingAggMap[g.test_result_id] = a;
        });

        // Official Writing/Speaking skill scores (single source of truth),
        // keyed by full-part session id. History must READ these, never recompute.
        const [{ data: wsr, error: wsrErr }, { data: ssr, error: ssrErr }] = await Promise.all([
          supabase
            .from("writing_skill_results")
            .select("full_test_session_id,scale50,cefr,created_at")
            .eq("user_id", user.id)
            .not("full_test_session_id", "is", null),
          supabase
            .from("speaking_skill_results")
            .select("full_test_session_id,scale50,cefr,created_at")
            .eq("user_id", user.id)
            .not("full_test_session_id", "is", null),
        ]);
        if (wsrErr) warn("writing_skill_results", wsrErr);
        if (ssrErr) warn("speaking_skill_results", ssrErr);

        type OfficialScore = { scale50: number; cefr: string | null };
        // Writing và Speaking phải TÁCH map riêng: trong phiên Full Test thật hai kỹ năng
        // dùng CHUNG một full_test_session_id nên gộp chung sẽ bị ghi đè lẫn nhau.
        const writingOfficialBySession: Record<string, OfficialScore> = {};
        const speakingOfficialBySession: Record<string, OfficialScore> = {};
        const collectOfficial = (list: any[] | null, target: Record<string, OfficialScore>) => {
          (list || [])
            .slice()
            .sort((a, b) => toTimeSafe(a.created_at) - toTimeSafe(b.created_at))
            .forEach((r: any) => {
              const sid = r.full_test_session_id as string;
              const s50 = Number(r.scale50);
              if (!sid || !Number.isFinite(s50) || s50 <= 0) return;
              target[sid] = { scale50: Math.round(s50), cefr: r.cefr ?? null };
            });
        };
        collectOfficial(wsr as any[], writingOfficialBySession);
        collectOfficial(ssr as any[], speakingOfficialBySession);



        const merged: HistoryRow[] = (results || []).map((r: any) => {
          const setInfo = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
          const ss = (r.skill_scores || {}) as any;
          let skill = setInfo?.skill || ss.skill || "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
          const mode: string | null = typeof ss.mode === "string" ? ss.mode : null;
          const isMarathon = mode === "marathon" || mode === "marathon-set";
          const title = isMarathon
            ? (ss.label || setInfo?.title || "Luyện nhanh (Marathon)")
            : (setInfo?.title || (r.review_snapshot as any)?.testTitle || "Đề mẫu");
          const disp = computeDisplay(
            { skill, score: r.score, total: r.total, level: r.level },
            r.review_snapshot,
            writingAggMap[r.id],
            speakingAggMap[r.id],
          );
          return {
            id: r.id,
            created_at: r.created_at,
            score: r.score,
            total: r.total,
            level: r.level,
            time_spent: r.time_spent,
            exam_set_id: r.exam_set_id,
            skill,
            title,
            part: setInfo?.part || "",
            full_test_session_id: r.full_test_session_id ?? null,
            full_test_id: r.full_test_id ?? null,
            isMarathon,
            marathonMode: mode,
            marathonSessionId: typeof ss.marathonSessionId === "string" ? ss.marathonSessionId : null,
            marathonPartType: (() => {
              const raw = ss.partType || ss.part || setInfo?.part || null;
              return raw ? normalizePart(raw) : null;
            })(),
            marathonLabel: typeof ss.label === "string" ? ss.label : null,
            fullPartSession: ss.fullPartSession ?? null,
            customSetId: typeof ss.customSetId === "string" ? ss.customSetId : null,
            customSetTitle: typeof ss.customSetTitle === "string" ? ss.customSetTitle : null,
            review_snapshot: r.review_snapshot ?? null,
            ...disp,
          };
        });

        // Full Test grouping
        const sessionMap = new Map<string, FullTestGroup>();
        for (const r of merged) {
          // Full Part sessions cũng ghi full_test_session_id + cờ fullPartSession —
          // loại chúng để tab Full Test chỉ còn phiên thi thử thật.
          if (!r.full_test_session_id || r.fullPartSession) continue;

          let g = sessionMap.get(r.full_test_session_id);
          if (!g) {
            g = {
              sessionId: r.full_test_session_id,
              fullTestId: r.full_test_id,
              title: r.customSetTitle || (r.full_test_id && ftMap[r.full_test_id]) || "Bài thi thử Aptis",
              created_at: r.created_at,
              rows: [],
              totalScaled: 0,
              hasScaled: false,
              skillCount: 0,
              gvScaled: null,
              skillAgg: {},
              customSetTitle: r.customSetTitle,
            };
            sessionMap.set(r.full_test_session_id, g);
          }
          g.rows.push(r);
          // Gộp theo kỹ năng (mỗi kỹ năng nhiều part = nhiều row).
          // MCQ dùng score/total; AI dùng tổng gradings (sum/max).
          {
            let num = 0, den = 0;
            if (r.skill === "speaking") { const a = speakingAggMap[r.id]; num = a?.sum || 0; den = a?.max || 0; }
            else if (r.skill === "writing") { const a = writingAggMap[r.id]; num = a?.sum || 0; den = a?.max || 0; }
            else { num = r.score; den = r.total; }
            if (den > 0) {
              const cur = g.skillAgg[r.skill] || { num: 0, den: 0 };
              cur.num += num; cur.den += den;
              g.skillAgg[r.skill] = cur;
            }
          }
          if (toTimeSafe(r.created_at) < toTimeSafe(g.created_at)) {
            g.created_at = r.created_at;
          }
        }
        const FOUR_SKILLS = ["reading", "listening", "speaking", "writing"];
        const groups = Array.from(sessionMap.values()).map((g) => {
          g.skillCount = new Set(g.rows.map((r) => r.skill)).size;
          let total = 0, has = false, gv: number | null = null;
          const scaledBySkill: Record<string, number> = {};
          for (const sk of Object.keys(g.skillAgg)) {
            const { num, den } = g.skillAgg[sk];
            if (den <= 0) continue;
            scaledBySkill[sk] = Math.min(50, Math.round((num / den) * 50));
          }
          // Writing/Speaking: ĐỌC điểm đã lưu, không tự tính lại từ bảng gradings.
          const wOff = writingOfficialBySession[g.sessionId];
          if (wOff) scaledBySkill.writing = wOff.scale50;
          const sOff = speakingOfficialBySession[g.sessionId];
          if (sOff) scaledBySkill.speaking = sOff.scale50;
          for (const sk of Object.keys(scaledBySkill)) {
            const scaled = scaledBySkill[sk];
            if (sk === "grammar") gv = scaled;
            else if (FOUR_SKILLS.includes(sk)) { total += scaled; has = true; }
          }

          g.totalScaled = total; g.gvScaled = gv; g.hasScaled = has;
          return g;
        });
        groups.sort((a, b) => toTimeSafe(b.created_at) - toTimeSafe(a.created_at));

        // Full Part grouping
        const fpMap = new Map<string, FullPartGroup>();
        for (const r of merged) {
          if (!r.fullPartSession) continue;
          let g = fpMap.get(r.fullPartSession);
          if (!g) {
            g = {
              sessionId: r.fullPartSession,
              skill: r.skill,
              customSetTitle: r.customSetTitle,
              created_at: r.created_at,
              partCount: 0,
              num: 0,
              den: 0,
              ungradedCount: 0,
              displayScore: "—",
              displayBand: "—",
            };
            fpMap.set(r.fullPartSession, g);
          }
          g.partCount++;
          if (r.skill === "speaking" || r.skill === "writing") {
            const a = r.skill === "speaking" ? speakingAggMap[r.id] : writingAggMap[r.id];
            if (a && a.max > 0) {
              g.num += a.sum; g.den += a.max;
            } else {
              // Fallback only (no stored skill result): per-part figures.
              // Part chưa chấm = thiếu s50 HOẶC s50 === 0; không cộng vào tử/mẫu.
              const snap: any = r.review_snapshot || {};
              const s50 = typeof snap.partScaled50 === "number" ? snap.partScaled50
                : typeof snap.scaled50 === "number" ? snap.scaled50 : null;
              if (s50 == null || s50 === 0) {
                g.ungradedCount++;
              } else {
                g.num += s50; g.den += 50;
              }
            }
          } else {
            g.num += r.score; g.den += r.total;
          }
          if (toTimeSafe(r.created_at) > toTimeSafe(g.created_at)) {
            g.created_at = r.created_at;
          }
        }
        const fpGroups = Array.from(fpMap.values()).map((g) => {
          const isGrammar = g.skill === "grammar";
          const official =
            g.skill === "writing" ? writingOfficialBySession[g.sessionId]
            : g.skill === "speaking" ? speakingOfficialBySession[g.sessionId]
            : undefined;

          if (official) {
            // Stored rubric-weighted score — display as saved, no recomputation.
            // Skill result tồn tại = đã chốt điểm ⇒ không bao giờ gắn "Chấm chưa đủ",
            // kể cả khi còn dòng test_results lẻ/hụt trong session.
            g.ungradedCount = 0;
            g.displayScore = `${official.scale50}/50`;
            g.displayBand = official.cefr || getSkillBand(official.scale50, g.skill as any);
            return g;
          }

          const scaled = g.den > 0 ? Math.round((g.num / g.den) * 50) : null;
          g.displayScore = scaled != null ? `${scaled}/50` : "—";
          g.displayBand = scaled != null && !isGrammar ? getSkillBand(scaled, g.skill as any) : "—";
          return g;
        });

        // Marathon grouping — gom các đề con (mode "marathon-set") theo marathonSessionId.
        // Dòng tổng kết (mode "marathon") mang CÙNG sessionId nên phải tách bằng mode.
        const marathonRows = merged.filter(
          (r) => r.isMarathon && !r.full_test_session_id && !r.fullPartSession,
        );
        const summaryBySession = new Map<string, HistoryRow>();
        for (const r of marathonRows) {
          if (r.marathonMode !== "marathon" || !r.marathonSessionId) continue;
          const prev = summaryBySession.get(r.marathonSessionId);
          if (!prev || toTimeSafe(r.created_at) > toTimeSafe(prev.created_at)) {
            summaryBySession.set(r.marathonSessionId, r);
          }
        }
        const mMap = new Map<string, MarathonGroup>();
        const groupedRowIds = new Set<string>();
        for (const r of marathonRows) {
          if (r.marathonMode !== "marathon-set" || !r.marathonSessionId) continue;
          groupedRowIds.add(r.id);
          const sid = r.marathonSessionId;
          let g = mMap.get(sid);
          if (!g) {
            const summary = summaryBySession.get(sid);
            const partType = summary?.marathonPartType || r.marathonPartType || null;
            g = {
              sessionId: sid,
              skill: r.skill,
              partType,
              label: summary?.marathonLabel || r.marathonLabel || formatMarathonLabel(partType, r.skill),
              created_at: r.created_at,
              setCount: 0,
              score: 0,
              total: 0,
              reviewRowId: summary?.review_snapshot ? summary.id : null,
            };
            mMap.set(sid, g);
          }
          g.setCount++;
          g.score += Number(r.score) || 0;
          g.total += Number(r.total) || 0;
          if (toTimeSafe(r.created_at) > toTimeSafe(g.created_at)) g.created_at = r.created_at;
        }
        // Dòng tổng kết đã là đại diện của nhóm → không hiện riêng, và ưu tiên
        // điểm/snapshot của nó nếu có.
        for (const [sid, summary] of summaryBySession) {
          const g = mMap.get(sid);
          if (!g) continue;
          groupedRowIds.add(summary.id);
          if (Number(summary.total) > 0) {
            g.score = Number(summary.score) || 0;
            g.total = Number(summary.total) || 0;
          }
          if (!g.reviewRowId && summary.review_snapshot) g.reviewRowId = summary.id;
          if (toTimeSafe(summary.created_at) > toTimeSafe(g.created_at)) g.created_at = summary.created_at;
        }
        const mGroups = Array.from(mMap.values());

        if (!cancelled) {
          setRows(merged);
          setFullTestGroups(groups);
          setFullPartGroups(fpGroups);
          setMarathonGroups(mGroups);
          setGroupedMarathonRowIds(groupedRowIds);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const perSkillRows = useMemo(
    () => rows.filter(
      (r) => !r.full_test_session_id && !r.fullPartSession && !groupedMarathonRowIds.has(r.id),
    ),
    [rows, groupedMarathonRowIds],
  );


  type MixedItem =
    | { kind: "row"; created_at: string; row: HistoryRow }
    | { kind: "group"; created_at: string; group: FullPartGroup }
    | { kind: "marathon"; created_at: string; marathon: MarathonGroup };

  const filteredItems = useMemo<MixedItem[]>(() => {
    const rowItems: MixedItem[] = perSkillRows
      .filter((r) => skillFilter === "all" || skillFilter === "fulltest" || r.skill === skillFilter)
      .map((r) => ({ kind: "row", created_at: r.created_at, row: r }));
    const groupItems: MixedItem[] = fullPartGroups
      .filter((g) => skillFilter === "all" || g.skill === skillFilter)
      .map((g) => ({ kind: "group", created_at: g.created_at, group: g }));
    const marathonItems: MixedItem[] = marathonGroups
      .filter((g) => skillFilter === "all" || g.skill === skillFilter)
      .map((g) => ({ kind: "marathon", created_at: g.created_at, marathon: g }));
    return [...rowItems, ...groupItems, ...marathonItems].sort(
      (a, b) => toTimeSafe(b.created_at) - toTimeSafe(a.created_at),
    );
  }, [perSkillRows, fullPartGroups, marathonGroups, skillFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [skillFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageNumbers = useMemo<(number | "ellipsis")[]>(() => {
    const out: (number | "ellipsis")[] = [];
    const want = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    const list = Array.from(want).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    let prev = 0;
    for (const n of list) {
      if (prev && n - prev > 1) out.push("ellipsis");
      out.push(n);
      prev = n;
    }
    return out;
  }, [page, totalPages]);



  // Top stats
  const stats = useMemo(() => {
    const totalAttempts =
      perSkillRows.length + fullTestGroups.length + fullPartGroups.length + marathonGroups.length;
    const weekStart = startOfWeek().getTime();
    const thisWeek =
      perSkillRows.filter((r) => toTimeSafe(r.created_at) >= weekStart).length +
      fullTestGroups.filter((g) => toTimeSafe(g.created_at) >= weekStart).length +
      fullPartGroups.filter((g) => toTimeSafe(g.created_at) >= weekStart).length +
      marathonGroups.filter((g) => toTimeSafe(g.created_at) >= weekStart).length;
    return { totalAttempts, thisWeek };
  }, [perSkillRows, fullTestGroups, fullPartGroups, marathonGroups]);



  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <HistorySkeleton />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const setSkill = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("skill"); else next.set("skill", v);
    setParams(next, { replace: true });
  };

  const isFullTestTab = skillFilter === "fulltest";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-[144px] md:pt-24 pb-16">
        <div className="section-container">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground">Lịch sử làm bài</h1>
          </div>
          <p className="text-muted-foreground mb-6">Toàn bộ kết quả các bài bạn đã hoàn thành.</p>

          {loadError && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}



          {/* Stats strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <StatCard
              icon={ListChecks}
              label="Tổng lượt làm"
              value={loading ? "…" : String(stats.totalAttempts)}
            />
            <StatCard
              icon={CalendarDays}
              label="Số bài tuần này"
              value={loading ? "…" : String(stats.thisWeek)}
            />
          </div>


          <Tabs value={skillFilter} onValueChange={setSkill} className="mb-6">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              <TabsTrigger value="all" className="flex-1 min-w-[80px]">Tất cả</TabsTrigger>
              <TabsTrigger value="fulltest" className="flex-1 min-w-[80px] gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Full Test
              </TabsTrigger>
              {["grammar","reading","listening","speaking","writing"].map((k) => (
                <TabsTrigger key={k} value={k} className="flex-1 min-w-[80px]">{SKILL_LABELS[k]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <TechSkeletonRow key={i} />
              ))}
            </div>
          ) : isFullTestTab ? (
            fullTestGroups.length === 0 ? (
              <EmptyState
                title="Chưa có lần thi thử Full Test nào"
                desc="Hãy thử sức với bài thi thử Aptis 162 phút để xem kết quả tại đây."
                ctaTo="/thi-thu"
                ctaLabel="Đi đến trang thi thử"
              />
            ) : (
              <div className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày giờ</TableHead>
                      <TableHead>Bài thi</TableHead>
                      <TableHead>Kỹ năng</TableHead>
                      <TableHead className="text-right">Điểm</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullTestGroups.map((g) => (
                      <TableRow key={g.sessionId}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(g.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary border-0 gap-1">
                              <Trophy className="w-3 h-3" />{g.customSetTitle ? "Bộ của tôi" : "Full Test"}
                            </Badge>
                            <span className="font-medium text-foreground truncate">{g.title}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[11px]">{g.skillCount}/5 kỹ năng</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-foreground">{g.hasScaled ? `${g.totalScaled}/200` : "—"}</div>
                          {g.gvScaled != null && (
                            <div className="text-[11px] text-muted-foreground">G&V {g.gvScaled}/50</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Link to={`/history/full-test/${g.sessionId}`}>
                              <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                            </Link>
                            <Link to="/thi-thu">
                              <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử làm bài"
              desc="Hãy bắt đầu luyện tập để theo dõi tiến trình của bạn nhé!"
              ctaTo="/practice"
              ctaLabel="Đi đến trang luyện tập"
            />
          ) : (
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày giờ</TableHead>
                    <TableHead>Kỹ năng</TableHead>
                    <TableHead>Phần</TableHead>
                    <TableHead className="text-right">Điểm</TableHead>
                    <TableHead className="text-right">Band</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((item) => {
                    if (item.kind === "group") {
                      const g = item.group;
                      const Icon = SKILL_ICON[g.skill] || ListChecks;
                      return (
                        <TableRow key={`fp-${g.sessionId}`}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(g.created_at)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground truncate">
                                    {g.customSetTitle || SKILL_LABELS[g.skill] || g.skill}
                                  </span>
                                  <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                                    {g.customSetTitle ? "Bộ của tôi" : "Full Part"}
                                  </Badge>
                                  {g.ungradedCount > 0 && (
                                    <span
                                      className="inline-flex items-center select-none text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{
                                        color: "#92400e",
                                        background: "#fef3c7",
                                        border: "1px solid #fde68a",
                                      }}
                                    >
                                      Chấm chưa đủ
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">{g.partCount} phần</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-muted-foreground">—</span></TableCell>
                          <TableCell className="text-right font-semibold text-foreground">{g.displayScore}</TableCell>
                          <TableCell className="text-right">
                            {g.displayBand && g.displayBand !== "—" ? (
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 font-bold">{g.displayBand}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Link to={`/history/full-part/${g.sessionId}`}>
                                <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                              </Link>
                              <Link to={SKILL_ROUTES[g.skill] || "/practice"}>
                                <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    if (item.kind === "marathon") {
                      const m = item.marathon;
                      const Icon = SKILL_ICON[m.skill] || ListChecks;
                      const canRetryMarathon = !!m.partType && VALID_MARATHON_PARTS.includes(m.partType);
                      const retryTo = canRetryMarathon
                        ? `${SKILL_ROUTES[m.skill] || "/practice"}?marathon=${m.partType}`
                        : SKILL_ROUTES[m.skill] || "/practice";
                      return (
                        <TableRow key={`mr-${m.sessionId}`}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(m.created_at)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground truncate">{SKILL_LABELS[m.skill] || m.skill}</span>
                                  <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Marathon</Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">{m.label}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">{m.setCount} đề</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {m.total > 0 ? `${m.score}/${m.total}` : "—"}
                          </TableCell>
                          <TableCell className="text-right"><span className="text-muted-foreground">—</span></TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              {m.reviewRowId && (
                                <Link to={`/history/marathon/${m.reviewRowId}`}>
                                  <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                                </Link>
                              )}
                              {canRetryMarathon && (
                                <Link to={retryTo}>
                                  <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const r = item.row;
                    const Icon = SKILL_ICON[r.skill] || ListChecks;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(r.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{SKILL_LABELS[r.skill] || r.skill}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {r.title}{r.isMarathon ? " · Marathon" : ""}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.part ? (
                            <Badge variant="outline" className="text-[11px]">
                              {r.skill === "reading" ? readingPartLabel(r.part) : r.part}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">{r.displayScore}</TableCell>
                        <TableCell className="text-right">
                          {r.displayBand && r.displayBand !== "—" ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 font-bold">{r.displayBand}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            {r.review_snapshot && (
                              <Link to={r.isMarathon ? `/history/marathon/${r.id}` : `/history/${r.id}?review=1`}>
                                <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                              </Link>
                            )}
                            <Link
                              to={
                                r.isMarathon
                                  ? (r.marathonPartType
                                      ? `${SKILL_ROUTES[r.skill] || "/practice"}?marathon=${r.marathonPartType}`
                                      : SKILL_ROUTES[r.skill] || "/practice")
                                  : r.exam_set_id
                                  ? `${SKILL_ROUTES[r.skill] || "/practice"}?set=${r.exam_set_id}`
                                  : SKILL_ROUTES[r.skill] || "/practice"
                              }
                            >
                              <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Hiện {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredItems.length)} trong tổng {filteredItems.length} lượt
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          aria-disabled={page === 1}
                          className={page === 1 ? "pointer-events-none opacity-50" : ""}
                          onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                        />
                      </PaginationItem>
                      {pageNumbers.map((p, i) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              isActive={p === page}
                              onClick={(e) => { e.preventDefault(); setPage(p); }}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          aria-disabled={page === totalPages}
                          className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                          onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>

          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const StatCard = ({
  icon: Icon, label, value,
}: { icon: any; label: string; value: string }) => (
  <div className="glass-card p-4 flex items-center gap-3">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-muted text-foreground">
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold text-foreground">{value}</div>
    </div>
  </div>
);

const EmptyState = ({ title, desc, ctaTo, ctaLabel }: { title: string; desc: string; ctaTo: string; ctaLabel: string }) => (
  <div className="glass-card p-10 text-center">
    <HistoryIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
    <h2 className="font-heading font-bold text-foreground mb-1">{title}</h2>
    <p className="text-sm text-muted-foreground mb-5">{desc}</p>
    <Link to={ctaTo}>
      <Button className="gap-2">{ctaLabel} <ArrowRight className="w-4 h-4" /></Button>
    </Link>
  </div>
);

export default History;

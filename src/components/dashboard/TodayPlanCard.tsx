import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, TrendingDown, RotateCcw, SpellCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PlanItem =
  | { kind: "weak_part"; skill: string; part: string; avg_pct: number; runs: number }
  | { kind: "wrong"; count: number; detail: string | null }
  | { kind: "grammar_error"; group: string; times: number };

const SKILL_LABEL: Record<string, string> = {
  grammar_vocab: "Grammar & Vocabulary",
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

function skillPage(skill: string | null | undefined): string {
  const s = (skill || "").toLowerCase();
  if (s === "reading") return "/reading";
  if (s === "listening") return "/listening";
  if (s === "writing") return "/writing";
  if (s === "speaking") return "/speaking";
  return "/grammar";
}

function examRoute(skill: string | null | undefined, setId: string): string {
  return `${skillPage(skill)}?set=${setId}&jump=1&from=key`;
}

const ICONS = {
  weak_part: TrendingDown,
  key_sets: KeyRound,
  wrong: RotateCcw,
  grammar_error: SpellCheck,
  countdown: CalendarClock,
} as const;

function render(item: PlanItem): { title: string; desc: string; linkLabel: string; to: string } | null {
  switch (item.kind) {
    case "weak_part": {
      const label = SKILL_LABEL[(item.skill || "").toLowerCase()] || item.skill;
      return {
        title: `${label} ${item.part} đang là phần yếu nhất`,
        desc: `${item.runs} lượt gần đây trung bình ${item.avg_pct}%, thấp hơn các part khác`,
        linkLabel: `Luyện ${label}`,
        to: skillPage(item.skill),
      };
    }
    case "key_sets": {
      const sets = item.sets || [];
      if (!sets.length) return null;
      return {
        title: `${sets.length} đề key ưu tiên cao bạn chưa làm`,
        desc: sets.map((s) => s.title).join(" · "),
        linkLabel: "Làm đề key ngay",
        to: examRoute(sets[0].skill, sets[0].exam_set_id),
      };
    }
    case "wrong": {
      const first = (item.detail || "").split(",")[0]?.trim().split(" ")[0];
      return {
        title: `${item.count} câu sai đang chờ ôn`,
        desc: item.detail || "Ôn lại các câu bạn đã làm sai",
        linkLabel: "Ôn câu sai",
        to: skillPage(first),
      };
    }
    case "grammar_error":
      return {
        title: `Bạn sai ${item.group} ${item.times} lần trong 10 bài Writing gần đây`,
        desc: "Lỗi lặp nhiều nhất của bạn",
        linkLabel: "Luyện Grammar",
        to: "/grammar",
      };
    case "countdown":
      return item.days <= 1
        ? {
            title: "Mai thi rồi — đừng học đề mới",
            desc: "Ôn lại câu sai và đề key là đủ",
            linkLabel: "Xem đề key",
            to: "/key-du-doan",
          }
        : {
            title: `Còn ${item.days} ngày tới ngày thi`,
            desc: "Nên làm 1 Full Test để canh sức",
            linkLabel: "Vào thi thử",
            to: "/thi-thu",
          };
    default:
      return null;
  }
}

const TodayPlanCard = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["today-plan", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_today_plan");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as PlanItem[];
    },
  });

  const items = (data || []).slice(0, 4);
  if (!items.length) return null;

  const countdown = (data || []).find((i) => i.kind === "countdown") as
    | { kind: "countdown"; days: number }
    | undefined;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h3 className="font-heading font-extrabold text-base md:text-lg text-foreground">⚡ Hôm nay nên làm</h3>
      <p className="text-sm text-muted-foreground mt-0.5">
        Gợi ý dựa trên lịch sử ôn tập của bạn
        {countdown ? ` · còn ${countdown.days} ngày tới ngày thi` : ""}
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, idx) => {
          const c = render(item);
          if (!c) return null;
          const Icon = ICONS[item.kind] ?? TrendingDown;
          return (
            <div key={idx} className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.desc}</p>
                <Link
                  to={c.to}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-1.5 hover:underline"
                >
                  {c.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayPlanCard;

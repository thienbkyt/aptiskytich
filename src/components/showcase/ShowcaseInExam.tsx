import { useEffect, useMemo, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { useIsPro } from "@/hooks/useIsPro";
import {
  fetchShowcaseBandCounts,
  fetchShowcaseBySet,
  fetchShowcaseExamTitle,
  type ShowcaseBand,
  type ShowcaseCard,
} from "@/lib/showcase";
import ShowcaseDetailDialog from "./ShowcaseDetailDialog";

interface Props {
  examSetId: string;
  skill: "writing" | "speaking";
  partType: string;
}

const BANDS: ShowcaseBand[] = ["B1", "B2", "C"];

const ShowcaseInExam = ({ examSetId, skill, partType }: Props) => {
  const { isPro, isPremium } = useIsPro();
  const canRead = isPro || isPremium;
  const [counts, setCounts] = useState<Record<ShowcaseBand, number> | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [band, setBand] = useState<ShowcaseBand | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [cards, setCards] = useState<ShowcaseCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setCounts(null);
    setBand(null);
    Promise.all([
      fetchShowcaseBandCounts(examSetId, skill, partType),
      fetchShowcaseExamTitle(examSetId),
    ])
      .then(([nextCounts, nextTitle]) => {
        if (!alive) return;
        setCounts(nextCounts);
        setExamTitle(nextTitle);
        setBand(BANDS.find((item) => nextCounts[item] > 0) ?? null);
      })
      .catch(() => alive && setCounts({ B1: 0, B2: 0, C: 0 }));
    return () => {
      alive = false;
    };
  }, [examSetId, skill, partType]);

  useEffect(() => {
    if (!band) {
      setCards([]);
      return;
    }
    let alive = true;
    setLoadingCards(true);
    fetchShowcaseBySet(examSetId, band, seed, skill, partType)
      .then((rows) => alive && setCards(rows))
      .catch(() => alive && setCards([]))
      .finally(() => alive && setLoadingCards(false));
    return () => {
      alive = false;
    };
  }, [examSetId, band, seed, skill, partType]);

  const total = useMemo(
    () => (counts ? BANDS.reduce((sum, item) => sum + counts[item], 0) : 0),
    [counts],
  );

  if (!counts || total === 0 || !band) return null;

  const openDetail = (id: string) => {
    if (!canRead) {
      setLockOpen(true);
      return;
    }
    setDetailId(id);
    setDetailOpen(true);
  };

  return (
    <section className="mt-4 rounded-xl border border-exam-border border-l-4 border-l-[hsl(43_65%_47%)] bg-exam-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-exam-text">
          🏆 BÀI KỲ TÍCH CỦA ĐỀ NÀY · {total} bài
        </h3>
        <a
          target="_blank"
          rel="noopener"
          href={`/bang-ky-tich?q=${encodeURIComponent(examTitle)}`}
          className="text-xs font-semibold text-exam-accent hover:underline"
        >
          Xem Bảng Kỳ Tích ↗
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Chọn band bài Kỳ Tích">
        {BANDS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={band === item ? "default" : "outline"}
            disabled={counts[item] === 0}
            onClick={() => setBand(item)}
            className={band === item
              ? "bg-exam-accent text-exam-accent-foreground hover:bg-exam-accent/90"
              : "border-exam-border bg-exam-surface text-exam-text hover:bg-exam-bg disabled:opacity-35"}
          >
            {item} ({counts[item]})
          </Button>
        ))}
      </div>

      {loadingCards ? (
        <div className="flex min-h-28 items-center justify-center text-sm text-exam-text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải bài...
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <Button
              key={card.id}
              type="button"
              variant="outline"
              onClick={() => openDetail(card.id)}
              className="h-auto min-h-32 w-full items-stretch justify-start whitespace-normal border-exam-border bg-exam-bg p-3 text-left text-exam-text hover:border-exam-accent hover:bg-exam-bg/70"
            >
              <span className="flex w-full flex-col">
                <span className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{card.band}</Badge>
                  <span className="text-xs font-semibold text-exam-text-muted">{card.raw_part}/30</span>
                </span>
                <span className="mt-2 line-clamp-4 text-sm font-normal leading-relaxed text-exam-text-muted">
                  {card.preview}
                </span>
                <span className="mt-auto pt-2 text-xs font-semibold text-exam-text">
                  {card.display_name || "Học viên ẩn danh"}
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={loadingCards}
        onClick={() => setSeed(Math.floor(Math.random() * 100000))}
        className="mt-3 text-exam-accent hover:bg-exam-bg hover:text-exam-accent"
      >
        <Shuffle className="mr-2 h-4 w-4" /> Đổi 3 bài khác
      </Button>

      <ShowcaseDetailDialog
        id={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        hidePractice
      />
      <UpgradeLock
        asModal
        open={lockOpen}
        onOpenChange={setLockOpen}
        reason="pro"
        featureLabel="Bảng Kỳ Tích"
      />
    </section>
  );
};

export default ShowcaseInExam;
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { useIsPro } from "@/hooks/useIsPro";
import ShowcaseDetailDialog from "./ShowcaseDetailDialog";
import { browseBandFor, fetchShowcaseBySet, type ShowcaseCard } from "@/lib/showcase";

interface Props {
  examSetId: string | null | undefined;
  /** Điểm thô của học viên để chọn band bài mẫu nên đọc. */
  rawPart: number | null | undefined;
  /** Kỹ năng của màn kết quả hiện tại để lọc bài mẫu. */
  skill?: string | null;
  /** Part của màn kết quả hiện tại để lọc bài mẫu. */
  partType?: string | null;
  title?: string;
}

const ShowcaseSetSamples = ({ examSetId, rawPart, skill, partType, title }: Props) => {
  const { isPro, isPremium } = useIsPro();
  const canRead = isPro || isPremium;
  const band = browseBandFor(rawPart);
  const seed = useMemo(() => Math.floor(Math.random() * 100000), []);

  const [cards, setCards] = useState<ShowcaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  useEffect(() => {
    if (!examSetId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchShowcaseBySet(examSetId, band, seed, skill, partType)
      .then((rows) => alive && setCards(rows))
      .catch(() => alive && setCards([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [examSetId, band, seed, skill, partType]);

  if (!examSetId) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bài Kỳ Tích của đề này...
      </div>
    );
  }
  if (cards.length === 0) return null;

  const openDetail = (id: string) => {
    if (!canRead) {
      setLockOpen(true);
      return;
    }
    setDetailId(id);
    setDetailOpen(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Trophy className="h-5 w-5 text-primary" />
          {title || `Bài band ${band} của đề này`}
        </h4>
        <Button asChild variant="ghost" size="sm">
          <Link to="/bang-ky-tich">Xem Bảng Kỳ Tích</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openDetail(c.id)}
            className="rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="secondary">{c.band}</Badge>
              {!canRead ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            </div>
            <p className="line-clamp-4 text-sm text-muted-foreground">{c.preview}</p>
            <p className="mt-2 text-xs font-medium text-foreground">
              {c.display_name || "Học viên ẩn danh"}
            </p>
          </button>
        ))}
      </div>

      <ShowcaseDetailDialog id={detailId} open={detailOpen} onOpenChange={setDetailOpen} />
      <UpgradeLock
        asModal
        open={lockOpen}
        onOpenChange={setLockOpen}
        reason="pro"
        featureLabel="Bảng Kỳ Tích"
      />
    </div>
  );
};

export default ShowcaseSetSamples;

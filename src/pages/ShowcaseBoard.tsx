import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Search, Loader2, Lock } from "lucide-react";
import UpgradeLock from "@/components/pro/UpgradeLock";
import ShowcaseDetailDialog from "@/components/showcase/ShowcaseDetailDialog";
import { useIsPro } from "@/hooks/useIsPro";
import {
  fetchShowcaseBoard,
  showcasePartLabel,
  showcaseSkillLabel,
  type ShowcaseBoardRow,
} from "@/lib/showcase";

const PAGE_SIZE = 12;
const ALL = "all";

const ShowcaseBoard = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("q") ?? "";
  usePageMeta({
    title: "Bảng Kỳ Tích — Bài Writing & Speaking điểm đỉnh | APTIS KỲ TÍCH",
    description:
      "Đọc bài Writing và Speaking đạt điểm đỉnh của học viên APTIS KỲ TÍCH: band B1, B2, C kèm từ vựng đáng học.",
  });

  const { isPro, isPremium } = useIsPro();
  const canRead = isPro || isPremium;

  const [skill, setSkill] = useState(ALL);
  const [part, setPart] = useState(ALL);
  const [band, setBand] = useState(ALL);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);

  const [rows, setRows] = useState<ShowcaseBoardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  const parts = useMemo(
    () => (skill === "writing" ? ["task2", "task3", "task4"] : skill === "speaking" ? ["part2", "part3", "part4"] : []),
    [skill],
  );

  const load = useCallback(
    async (offset: number) => {
      const data = await fetchShowcaseBoard({
        skill: skill === ALL ? null : skill,
        partType: part === ALL ? null : part,
        band: band === ALL ? null : band,
        search: search.trim() || null,
        limit: PAGE_SIZE,
        offset,
      });
      setTotal(data[0]?.total_count ? Number(data[0].total_count) : offset === 0 ? 0 : total);
      return data;
    },
    [skill, part, band, search, total],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load(0)
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, part, band, search]);

  const handleMore = async () => {
    setLoadingMore(true);
    try {
      const data = await load(rows.length);
      setRows((prev) => [...prev, ...data]);
    } catch {
      /* bỏ qua */
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetail = (id: string) => {
    if (!canRead) {
      setLockOpen(true);
      return;
    }
    setDetailId(id);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pt-16 pb-16">
        <header className="py-8">
          <h1 className="flex items-center gap-3 text-3xl font-black text-foreground sm:text-4xl">
            <Trophy className="h-8 w-8 text-primary" />
            Bảng Kỳ Tích
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Những bài Writing và Speaking đạt điểm đỉnh của học viên, chia sẻ lại để bạn đọc tham khảo cách viết, cách
            nói và từ vựng đáng học.
          </p>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={skill}
            onValueChange={(v) => {
              setSkill(v);
              setPart(ALL);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kỹ năng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả kỹ năng</SelectItem>
              <SelectItem value="writing">Writing</SelectItem>
              <SelectItem value="speaking">Speaking</SelectItem>
            </SelectContent>
          </Select>

          <Select value={part} onValueChange={setPart} disabled={parts.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Part" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả part</SelectItem>
              {parts.map((p) => (
                <SelectItem key={p} value={p}>
                  {showcasePartLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={band} onValueChange={setBand}>
            <SelectTrigger>
              <SelectValue placeholder="Band" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả band</SelectItem>
              <SelectItem value="B1">B1</SelectItem>
              <SelectItem value="B2">B2</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
            className="flex gap-2"
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo đề..."
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Tìm">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            Chưa có bài nào ở mục này. Hãy là người đầu tiên chia sẻ bài điểm đỉnh của bạn!
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{total} bài được trưng bày</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDetail(r.id)}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground">{r.band}</Badge>
                      <Badge variant="secondary">
                        {showcaseSkillLabel(r.skill)} {showcasePartLabel(r.part_type)}
                      </Badge>
                    </div>
                    {!canRead ? <Lock className="h-4 w-4 text-muted-foreground" /> : null}
                  </div>
                  <p className="line-clamp-4 text-sm text-muted-foreground">{r.preview}</p>
                  <p className="mt-3 text-xs font-medium text-foreground">
                    {r.display_name || "Học viên ẩn danh"}
                    {r.exam_set_title ? <span className="text-muted-foreground"> · {r.exam_set_title}</span> : null}
                  </p>
                </button>
              ))}
            </div>

            {rows.length < total ? (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={handleMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...
                    </>
                  ) : (
                    "Xem thêm"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>
      <Footer />

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

export default ShowcaseBoard;

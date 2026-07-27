import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateFeed, relativeLabel, isToday, type FeedItem } from "@/hooks/useUpdateFeed";
import { useIsMobile } from "@/hooks/use-mobile";
import { safeSessionStorage } from "@/lib/safeStorage";

const RED = "#CC1C01";
const ORANGE = "#FEAD5F";
const CREAM = "#FFF8F5";
const DISMISS_KEY = "home-update-dock-dismissed";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "key", label: "Key dự đoán" },
  { key: "reading", label: "Reading" },
  { key: "listening", label: "Listening" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
];

const dayLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const Row = ({
  item,
  highlight,
  onGo,
  compact,
}: {
  item: FeedItem;
  highlight: boolean;
  onGo: (href: string) => void;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={() => onGo(item.href)}
    className="w-full text-left flex items-center gap-2.5 rounded-xl border border-[#F2E2D4] px-2.5 py-2 transition-colors hover:border-[#E9C9B6]"
    style={{ background: highlight ? "#FFEDE6" : "#FFFFFF" }}
  >
    <div className="shrink-0 w-[52px] text-center">
      <div className="text-sm font-extrabold leading-none" style={{ color: RED }}>
        {dayLabel(item.date)}
      </div>
      {highlight && (
        <div className="text-[9px] mt-1 font-bold tracking-wide" style={{ color: RED }}>
          HÔM NAY
        </div>
      )}
    </div>

    <div className="min-w-0 flex-1">
      <span
        className="inline-block text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full"
        style={
          item.kind === "key"
            ? { background: RED, color: "#FFFFFF" }
            : { background: ORANGE, color: "#4D0D0D" }
        }
      >
        {item.badge}
      </span>
      <div className="mt-0.5 text-[13px] font-semibold truncate" style={{ color: "#3C1C12" }}>
        {item.title}
      </div>
      <div className="text-[11px] truncate" style={{ color: "#8A6656" }}>
        {item.subtitle}
      </div>
    </div>

    <ChevronRight className={`shrink-0 w-4 h-4 ${compact ? "" : ""}`} style={{ color: RED }} />
  </button>
);

const UpdateFeedDock = () => {
  const { items, loading } = useUpdateFeed();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => safeSessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const latest = items[0];
  const latestLabel = latest ? relativeLabel(latest.date) : null;

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.bucket === filter)),
    [items, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    filtered.forEach((i) => {
      const k = `THÁNG ${i.date.getMonth() + 1} · ${i.date.getFullYear()}`;
      const arr = map.get(k) ?? [];
      arr.push(i);
      map.set(k, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const dismiss = () => {
    safeSessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (loading || items.length === 0 || dismissed) return null;

  const showPanel = !isMobile || expanded;

  return (
    <>
      <div className="fixed z-[80] left-4 bottom-4 max-w-[calc(100vw-2rem)]">
        {isMobile && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 rounded-full bg-white border border-[#F2E2D4] px-3 py-2 text-xs font-semibold shadow-lg"
            style={{ color: "#3C1C12" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Đề mới
          </button>
        )}

        {showPanel && (
          <div
            className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#F2E2D4] overflow-hidden"
            style={{ background: CREAM, boxShadow: "0 16px 40px -20px rgba(60, 28, 18, 0.45)" }}
          >
            <div className="flex items-start gap-2 px-3 py-2.5 bg-white border-b border-[#F2E2D4]">
              <span className="relative flex h-2 w-2 mt-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold" style={{ color: "#3C1C12" }}>
                  Đề mới cập nhật
                </div>
                <div className="text-[11px]" style={{ color: "#8A6656" }}>
                  Gần nhất: {latestLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => (isMobile ? setExpanded(false) : dismiss())}
                aria-label="Đóng bảng cập nhật"
                className="text-[#9A7B6C] hover:text-[#3C1C12]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 space-y-2">
              {items.slice(0, 3).map((item, idx) => (
                <Row
                  key={item.id}
                  item={item}
                  highlight={idx === 0 && isToday(item.date)}
                  onGo={go}
                  compact
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-semibold bg-white border-t border-[#F2E2D4] hover:bg-[#FFEDE6] transition-colors"
              style={{ color: RED }}
            >
              Xem tất cả cập nhật
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#F2E2D4]">
            <DialogTitle className="text-lg font-heading font-extrabold" style={{ color: "#3C1C12" }}>
              Lịch sử cập nhật đề
            </DialogTitle>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#8A6656" }}>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Cập nhật gần nhất: {latestLabel} · {items.length} bản cập nhật
            </div>
          </DialogHeader>

          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[#F2E2D4]">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                  style={
                    active
                      ? { background: RED, borderColor: RED, color: "#FFFFFF" }
                      : { background: "#FFFFFF", borderColor: "#F2E2D4", color: "#6B4A3B" }
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-5 py-4 space-y-4" style={{ background: CREAM }}>
            {grouped.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "#8A6656" }}>
                Chưa có cập nhật nào.
              </p>
            )}
            {grouped.map(([month, rows]) => (
              <div key={month}>
                <div className="text-[11px] font-bold tracking-wider mb-2" style={{ color: "#9A7B6C" }}>
                  {month}
                </div>
                <div className="space-y-2.5">
                  {rows.map((item) => (
                    <Row key={item.id} item={item} highlight={isToday(item.date)} onGo={go} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 text-center text-xs border-t border-[#F2E2D4]" style={{ color: "#8A6656" }}>
            Kho đề được bổ sung mỗi ngày — key dự đoán cập nhật trước kỳ thi
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UpdateFeedDock;

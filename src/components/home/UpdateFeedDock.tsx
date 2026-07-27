import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateFeed, relativeLabel, isToday, type FeedItem } from "@/hooks/useUpdateFeed";
import { useIsMobile } from "@/hooks/use-mobile";

const RED = "#CC1C01";
const ORANGE = "#FEAD5F";
const CREAM = "#FFF8F5";


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
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const latest = items[0];
  const latestLabel = latest ? relativeLabel(latest.date) : null;

  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return items.filter((i) => i.date.getTime() >= cutoff).length;
  }, [items]);

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

  if (loading || items.length === 0) return null;

  const dock = (
    <div className="fixed z-[120] left-4 bottom-4 max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-white border border-[#F2E2D4] px-3.5 py-2 text-xs font-semibold shadow-lg hover:bg-[#FFEDE6] transition-colors"
        style={{ color: "#3C1C12" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        {isMobile ? "Đề mới" : "Đề mới cập nhật"}
        {recentCount > 0 && <span style={{ color: RED }}>· {recentCount}</span>}
      </button>
    </div>
  );


  return (
    <>
      {typeof document !== "undefined" ? createPortal(dock, document.body) : dock}

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

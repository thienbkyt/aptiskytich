import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateFeed, relativeLabel, isToday, type FeedItem } from "@/hooks/useUpdateFeed";

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

const FeedRow = ({ item, highlight, onGo }: { item: FeedItem; highlight: boolean; onGo: (href: string) => void }) => {
  const d = item.date;
  return (
    <button
      type="button"
      onClick={() => onGo(item.href)}
      className="w-full text-left flex items-center gap-3 md:gap-4 rounded-2xl border border-[#F2E2D4] px-3 py-3 md:px-4 transition-all hover:-translate-y-0.5 hover:border-[#E9C9B6]"
      style={{ background: highlight ? CREAM : "#FFFFFF" }}
    >
      <div
        className="shrink-0 w-[64px] md:w-[74px] rounded-xl py-2 text-center border"
        style={{
          background: highlight ? "#FFEDE6" : "#FFFFFF",
          borderColor: highlight ? "#F6C9B7" : "#F2E2D4",
        }}
      >
        <div className="text-base md:text-lg font-extrabold leading-none" style={{ color: RED }}>
          {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
        </div>
        <div className="text-[10px] mt-1 font-semibold tracking-wide" style={{ color: highlight ? RED : "#9A7B6C" }}>
          {highlight ? "HÔM NAY" : d.getFullYear()}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <span
          className="inline-block text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full"
          style={
            item.kind === "key"
              ? { background: RED, color: "#FFFFFF" }
              : { background: ORANGE, color: "#4D0D0D" }
          }
        >
          {item.badge}
        </span>
        <div className="mt-1 text-sm md:text-[15px] font-semibold truncate" style={{ color: "#3C1C12" }}>
          {item.title}
        </div>
        <div className="text-xs truncate" style={{ color: "#8A6656" }}>{item.subtitle}</div>
      </div>

      <span className="shrink-0 hidden sm:inline-flex items-center gap-1 text-xs font-semibold" style={{ color: RED }}>
        {item.kind === "key" ? "Xem key" : "Luyện ngay"}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
};

const UpdateFeedSection = () => {
  const { items, loading } = useUpdateFeed();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

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

  if (loading || items.length === 0) return null;

  return (
    <section className="relative py-8 md:py-12" style={{ background: "#FFFFFF" }}>
      <div className="section-container">
        <div
          className="max-w-4xl mx-auto rounded-[24px] border border-[#F2E2D4] p-5 md:p-7"
          style={{ background: CREAM, boxShadow: "0 10px 24px -16px rgba(204, 28, 1, 0.2)" }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-[#F2E2D4]" style={{ color: "#4D0D0D" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Cập nhật gần nhất: {latestLabel}
          </span>

          <h2 className="mt-3 text-xl md:text-2xl font-heading font-extrabold" style={{ color: "#3C1C12" }}>
            Đề mới cập nhật liên tục
          </h2>
          <p className="text-sm mt-1" style={{ color: "#8A6656" }}>
            Kho đề được bổ sung mỗi ngày — key dự đoán cập nhật trước kỳ thi.
          </p>

          <div className="mt-4 space-y-2.5">
            {items.slice(0, 5).map((item, idx) => (
              <FeedRow key={item.id} item={item} highlight={idx === 0 && isToday(item.date)} onGo={go} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 w-full md:w-auto md:px-6 py-2.5 rounded-full border-2 text-sm font-semibold bg-white transition-colors hover:bg-[#FFEDE6]"
            style={{ borderColor: RED, color: RED }}
          >
            Xem tất cả cập nhật
          </button>
        </div>
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
              <p className="text-sm text-center py-8" style={{ color: "#8A6656" }}>Chưa có cập nhật nào.</p>
            )}
            {grouped.map(([month, rows]) => (
              <div key={month}>
                <div className="text-[11px] font-bold tracking-wider mb-2" style={{ color: "#9A7B6C" }}>{month}</div>
                <div className="space-y-2.5">
                  {rows.map((item) => (
                    <FeedRow key={item.id} item={item} highlight={isToday(item.date)} onGo={go} />
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
    </section>
  );
};

export default UpdateFeedSection;

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mascotSrc } from "./pathText";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STEPS: Array<{ n: string; title: string; body: string }> = [
  { n: "1", title: "Đặt mục tiêu", body: "Chọn ngày thi, band aim và số bài mỗi ngày. Ngày thi giúp Kỳ Kỳ đếm ngược và mở bước Key ngày thi đúng lúc." },
  { n: "2", title: "Thi thử đầu vào", body: "Làm 1 bài thi thử full (~2,5 giờ) để biết band hiện tại, quen format bài thi và thấy kỹ năng nào yếu. Bận thì có thể bỏ qua." },
  { n: "3–6", title: "Reading → Listening → Writing → Speaking", body: "Ôn lần lượt từng kỹ năng theo đề key, đi từ ưu tiên Cao → Vừa → Thấp. Ôn từng part trong Luyện tập từng kỹ năng, chưa cần làm Full Part hay Full Test." },
  { n: "7", title: "Key ngày thi", body: "Mở trước ngày thi 1 ngày: hiện các đề key của ngày thi mà bạn chưa làm để ôn nước rút." },
  { n: "8", title: "Về đích", body: "Xong cả lộ trình thì làm 1 bài thi thử full để đo band trước ngày thi thật." },
];

const NOTES = [
  "Đề key cập nhật hằng ngày theo các đề vừa ra thi thật, nên số đề trong lộ trình có thể thay đổi mỗi ngày.",
  "Xong một kỹ năng, Kỳ Kỳ sẽ gợi ý làm thử 1 Full Part để quen áp lực thời gian.",
  "Tài khoản miễn phí ôn được phần đề key miễn phí; phần còn lại nằm trong gói Pro.",
];

/** Popup "Đọc hướng dẫn": giải thích lộ trình 8 bước. */
const PathGuideDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-16px)] max-w-md overflow-y-auto overflow-x-hidden rounded-2xl p-4 sm:p-6">
      <DialogHeader className="text-left">
        <div className="flex items-end gap-3 pr-6">
          <img src={mascotSrc("check")} alt="" className="h-16 w-auto shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="font-heading text-lg leading-snug">Lộ trình đạt aim cùng Kỳ Tích</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">8 bước ôn đúng trọng tâm, từ hôm nay tới ngày thi.</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <ol className="mt-1 space-y-2.5">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-primary/10 px-1.5 text-[11.5px] font-extrabold text-primary">{s.n}</span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-extrabold text-foreground">{s.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <ul className="mt-1 space-y-1.5 rounded-xl bg-muted/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {NOTES.map((n) => (
          <li key={n} className="flex gap-2"><span className="text-primary">•</span><span>{n}</span></li>
        ))}
      </ul>

      <Button className="mt-1 w-full" onClick={() => onOpenChange(false)}>Đã hiểu, bắt đầu ôn</Button>
    </DialogContent>
  </Dialog>
);

export default PathGuideDialog;

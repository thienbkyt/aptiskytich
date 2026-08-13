import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import fb01 from "@/assets/feedback/fb01.webp.asset.json";
import fb02 from "@/assets/feedback/fb02.webp.asset.json";
import fb03 from "@/assets/feedback/fb03.webp.asset.json";
import fb04 from "@/assets/feedback/fb04.webp.asset.json";
import fb05 from "@/assets/feedback/fb05.webp.asset.json";
import fb06 from "@/assets/feedback/fb06.webp.asset.json";
import fb07 from "@/assets/feedback/fb07.webp.asset.json";
import fb08 from "@/assets/feedback/fb08.webp.asset.json";
import fb09 from "@/assets/feedback/fb09.webp.asset.json";
import fb10 from "@/assets/feedback/fb10.webp.asset.json";

/** Ảnh feedback học viên (4:5). Hàng trên: fb01–fb05, hàng dưới: fb06–fb10. */
const feedbackImages: { src: string; alt: string }[] = [
  { src: fb01.url, alt: "Feedback học viên Aptis Kỳ Tích 1" },
  { src: fb02.url, alt: "Feedback học viên Aptis Kỳ Tích 2" },
  { src: fb03.url, alt: "Feedback học viên Aptis Kỳ Tích 3" },
  { src: fb04.url, alt: "Feedback học viên Aptis Kỳ Tích 4" },
  { src: fb05.url, alt: "Feedback học viên Aptis Kỳ Tích 5" },
  { src: fb06.url, alt: "Feedback học viên Aptis Kỳ Tích 6" },
  { src: fb07.url, alt: "Feedback học viên Aptis Kỳ Tích 7" },
  { src: fb08.url, alt: "Feedback học viên Aptis Kỳ Tích 8" },
  { src: fb09.url, alt: "Feedback học viên Aptis Kỳ Tích 9" },
  { src: fb10.url, alt: "Feedback học viên Aptis Kỳ Tích 10" },
];

const topRow = feedbackImages.slice(0, 5);
const bottomRow = feedbackImages.slice(5, 10);

export const hasFeedbackImages = feedbackImages.length > 0;

const Row = ({
  images,
  reverse,
  onPick,
}: {
  images: { src: string; alt: string }[];
  reverse?: boolean;
  onPick: (img: { src: string; alt: string }) => void;
}) => {
  // Chỉ 5 ảnh/hàng → nhân ba để băng chạy không hụt trên màn hình rộng
  const tripled = [...images, ...images, ...images];
  return (
    <div className="group relative overflow-hidden">
      <div
        className="flex w-max gap-5 py-2 will-change-transform motion-reduce:!animate-none group-hover:[animation-play-state:paused]"
        style={{
          animation: `kt-marquee${reverse ? "-reverse" : ""} 60s linear infinite`,
        }}
      >
        {tripled.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => onPick(img)}
            className="flex-shrink-0 rounded-2xl border border-[#F2E2D4] bg-white p-2 transition-transform hover:-translate-y-1"
            style={{ boxShadow: "0 8px 20px -14px rgba(204, 28, 1, 0.22)" }}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="h-[300px] w-[240px] object-cover rounded-[16px] bg-white"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const FeedbackMarquee = () => {
  const [active, setActive] = useState<{ src: string; alt: string } | null>(null);
  if (feedbackImages.length === 0) return null;

  return (
    <>
      <style>{`
@keyframes kt-marquee { from { transform: translateX(-33.3333%); } to { transform: translateX(0); } }
@keyframes kt-marquee-reverse { from { transform: translateX(0); } to { transform: translateX(-33.3333%); } }
@media (prefers-reduced-motion: reduce) { .kt-marquee-wrap * { animation: none !important; } }
      `}</style>

      <div className="kt-marquee-wrap relative space-y-5">
        <Row images={topRow} onPick={setActive} />
        <Row images={bottomRow} reverse onPick={setActive} />

        {/* Gradient mờ hai mép */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-white to-transparent" />
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white">
          {active && (
            <img src={active.src} alt={active.alt} className="w-full h-auto rounded-xl" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackMarquee;

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Ảnh feedback học viên. Thêm ảnh vào src/assets/feedback/ rồi import ở đây:
 *   import fb01 from "@/assets/feedback/fb-01.jpg";
 * Mảng rỗng → section không render.
 */
const feedbackImages: { src: string; alt: string }[] = [
  // { src: fb01, alt: "Feedback học viên Aptis Kỳ Tích 1" },
];

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
  const doubled = [...images, ...images];
  return (
    <div className="group relative overflow-hidden">
      <div
        className="flex w-max gap-5 py-2 will-change-transform motion-reduce:!animate-none group-hover:[animation-play-state:paused]"
        style={{
          animation: `kt-marquee${reverse ? "-reverse" : ""} 60s linear infinite`,
        }}
      >
        {doubled.map((img, i) => (
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
              className="h-[260px] w-auto object-contain rounded-xl bg-white"
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
@keyframes kt-marquee { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes kt-marquee-reverse { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .kt-marquee-wrap * { animation: none !important; } }
      `}</style>

      <div className="kt-marquee-wrap relative space-y-5">
        <Row images={feedbackImages} onPick={setActive} />
        <Row images={feedbackImages} reverse onPick={setActive} />

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

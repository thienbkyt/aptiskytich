import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

interface BlogCTAProps {
  title?: string;
  buttonLabel?: string;
  href?: string;
  className?: string;
}

const BlogCTA = ({
  title = "Luyện ngay dạng bài này trên hệ thống mô phỏng 100% thi thật",
  buttonLabel = "Luyện thi miễn phí",
  href = "/thi-thu",
  className = "",
}: BlogCTAProps) => {
  return (
    <div
      className={`not-prose my-8 rounded-2xl p-6 md:p-8 text-white shadow-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Aptis Kỳ Tích
          </div>
          <p className="mt-3 text-lg md:text-xl font-heading font-bold leading-snug">
            {title}
          </p>
        </div>
        <Link
          to={href}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[#CC1C01] font-bold text-sm md:text-base shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
        >
          {buttonLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default BlogCTA;

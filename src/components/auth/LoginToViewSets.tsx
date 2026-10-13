import { Link, useLocation } from "react-router-dom";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Khách chưa đăng nhập: thay cho "Chưa có đề cho phần này" (danh sách đề chỉ
 * tải được khi đã đăng nhập) → mời đăng nhập / đăng ký để xem toàn bộ đề.
 */
const LoginToViewSets = ({ className = "" }: { className?: string }) => {
  const loc = useLocation();
  const redirect = encodeURIComponent(loc.pathname + loc.search);
  return (
    <div className={`col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-12 text-center ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <p className="text-lg font-bold text-foreground">Đăng nhập để xem toàn bộ đề</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Tạo tài khoản miễn phí để xem kho đề, luyện tập và lưu tiến độ học của bạn.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button asChild className="gap-1.5 font-semibold">
          <Link to={`/auth?redirect=${redirect}`}><LogIn className="h-4 w-4" /> Đăng nhập</Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5 border-primary font-semibold text-primary hover:bg-primary/10 hover:text-primary">
          <Link to={`/auth?tab=signup&redirect=${redirect}`}><UserPlus className="h-4 w-4" /> Đăng ký miễn phí</Link>
        </Button>
      </div>
    </div>
  );
};

export default LoginToViewSets;

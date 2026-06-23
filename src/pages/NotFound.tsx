import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, FileText } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-[hsl(var(--primary)/0.05)]">
      <Navbar />
      <main className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="relative mb-6">
          <span className="block text-[8rem] md:text-[10rem] font-extrabold leading-none bg-gradient-to-br from-primary to-[#FEAD5F] bg-clip-text text-transparent">
            404
          </span>
        </div>
        <h1 className="mb-3 text-3xl md:text-4xl font-bold text-foreground">
          Không tìm thấy trang
        </h1>
        <p className="mb-8 max-w-md text-base md:text-lg text-muted-foreground">
          Trang bạn đang tìm không tồn tại hoặc đã được di chuyển. Hãy quay lại trang chủ hoặc bắt đầu thi thử ngay.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="w-4 h-4" />
              Về trang chủ
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
            <Link to="/thi-thu">
              <FileText className="w-4 h-4" />
              Thi thử
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NotFound;

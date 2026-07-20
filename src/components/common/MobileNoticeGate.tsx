import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDeviceType } from "@/lib/deviceInfo";
import { safeSessionStorage } from "@/lib/safeStorage";

const FLAG_KEY = "kt_mobile_notice_shown";

interface Ctx {
  openMobileNotice: (onContinue?: () => void) => void;
}

const MobileNoticeContext = createContext<Ctx>({ openMobileNotice: () => {} });
export const useMobileNotice = () => useContext(MobileNoticeContext);

export function MobileNoticeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const afterRef = useRef<(() => void) | null>(null);

  const openMobileNotice = useCallback((onContinue?: () => void) => {
    const device = getDeviceType();
    const isMobileLike = device === "mobile" || device === "tablet";
    const alreadyShown = safeSessionStorage.getItem(FLAG_KEY) === "1";

    if (!isMobileLike || alreadyShown) {
      onContinue?.();
      return;
    }

    afterRef.current = onContinue ?? null;
    safeSessionStorage.setItem(FLAG_KEY, "1");
    setOpen(true);
  }, []);

  const handleContinue = () => {
    setOpen(false);
    const cb = afterRef.current;
    afterRef.current = null;
    setTimeout(() => cb?.(), 100);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      const cb = afterRef.current;
      afterRef.current = null;
      if (cb) setTimeout(() => cb(), 100);
    }
  };

  return (
    <MobileNoticeContext.Provider value={{ openMobileNotice }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💻 Nên học trên máy tính</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p>
              Bài thi Aptis thật được làm hoàn toàn trên máy tính. Giao diện trên điện thoại/iPad sẽ không tối ưu cho việc ôn luyện.
            </p>
            <p>
              Để luyện sát đề thật và tránh lỗi, bạn nên luyện tập với <strong>aptiskytich.vn</strong> bằng máy tính.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              className="w-full text-white hover:opacity-90"
              style={{ backgroundColor: "#CC1C01" }}
              onClick={handleContinue}
            >
              Đã hiểu, tiếp tục
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileNoticeContext.Provider>
  );
}

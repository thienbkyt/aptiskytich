import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, Sparkles, Users, X } from "lucide-react";

const FB_GROUP_URL = "https://www.facebook.com/groups/1551779633112657";
const FLAG_KEY = "kt_show_group_popup";

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const PostLoginFBGroupModal = () => {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(FLAG_KEY) === "1") {
        sessionStorage.removeItem(FLAG_KEY);
        shownRef.current = true;
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-[420px] translate-x-[-50%] translate-y-[-50%] rounded-3xl border-0 bg-transparent p-0 shadow-none outline-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] p-6 text-center text-white shadow-2xl md:p-8">
            {/* Decorative glows */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

            {/* Subtle dot pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Close button */}
            <DialogClose className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50">
              <X className="h-5 w-5" />
              <span className="sr-only">Đóng</span>
            </DialogClose>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/10 backdrop-blur-sm">
                <Users className="h-8 w-8 text-white" />
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                <Sparkles className="h-3.5 w-3.5" />
                APTIS KỲ TÍCH
              </div>

              <DialogTitle className="mt-4 text-center font-heading text-xl font-bold leading-tight text-white md:text-2xl">
                Tham gia nhóm học tập & Review đề
              </DialogTitle>

              <DialogDescription className="mt-3 text-center text-sm text-white/90 md:text-base">
                Để nhanh đạt mục tiêu Aptis cùng cộng đồng.
              </DialogDescription>

              <p className="mt-2 text-center text-xs text-white/70">
                Cùng hàng nghìn bạn đang ôn thi Aptis mỗi ngày
              </p>

              <a
                href={FB_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#CC1C01] shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                aria-label="Tham gia nhóm Facebook"
              >
                <FacebookIcon className="h-4 w-4 fill-current" />
                Tham gia nhóm
                <ArrowRight className="h-4 w-4" />
              </a>

              <DialogClose className="mt-4 text-sm font-medium text-white/80 transition-colors hover:text-white focus:outline-none">
                Để sau
              </DialogClose>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default PostLoginFBGroupModal;

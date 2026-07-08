import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Sparkles } from "lucide-react";

const FB_GROUP_URL = "https://www.facebook.com/groups/1551779633112657";

const PostLoginFBGroupModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Delay slightly to avoid clashing with other post-login UI
        setTimeout(() => setOpen(true), 400);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <div className="rounded-2xl p-6 md:p-8 text-white shadow-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F]">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> APTIS KỲ TÍCH
          </div>
          <p className="mt-4 text-xl md:text-2xl font-heading font-bold leading-snug">
            Tham gia nhóm học tập&nbsp;& Review đề để nhanh đạt mục tiêu nha.
          </p>
          <div className="mt-6">
            <a
              href={FB_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-[#CC1C01] font-bold text-sm md:text-base shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              Tham gia nhóm
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostLoginFBGroupModal;

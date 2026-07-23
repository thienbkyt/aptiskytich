import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import GlowCard from "@/components/ui/glow-card";
import { supabase } from "@/integrations/supabase/client";
import { parseDateSafe } from "@/lib/safeDate";

interface BlogTip {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
}

const formatDate = (iso: string | null) => {
  const d = parseDateSafe(iso);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

const BlogTipsCard = () => {
  const [posts, setPosts] = useState<BlogTip[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("blog_posts" as any)
      .select("id, title, slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (alive) setPosts(((data as unknown) as BlogTip[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <GlowCard className="p-6 border-accent/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-accent" />
          </div>
          <h2 className="font-heading font-bold text-foreground">Blog - Mẹo</h2>
        </div>
        <Link
          to="/meo-thi-aptis"
          className="text-xs font-bold text-primary hover:text-primary-glow inline-flex items-center gap-1"
        >
          Xem tất cả <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {posts === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">Chưa có bài viết mới.</p>
          <Link
            to="/meo-thi-aptis"
            className="text-sm font-semibold text-primary hover:text-primary-glow inline-flex items-center gap-1"
          >
            Đến trang Blog - Mẹo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to={`/meo-thi-aptis/${p.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/40 hover:bg-muted/50 transition-all"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {p.title}
                </div>
                {p.published_at && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(p.published_at)}
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </GlowCard>
  );
};

export default BlogTipsCard;

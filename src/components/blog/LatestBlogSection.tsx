import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowRight, FileText, BookOpen } from "lucide-react";
import { parseDateSafe } from "@/lib/safeDate";
import {
  BlogPost,
  CATEGORY_LABELS,
} from "@/components/admin/blog/blogTypes";

const formatDate = (iso: string | null) => {
  const d = parseDateSafe(iso);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const useSignedCover = (path: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
    setUrl(data?.publicUrl ?? null);
  }, [path]);

  return url;
};

const LatestPostCard = ({ post }: { post: BlogPost }) => {
  const cover = useSignedCover(post.cover_image_url);
  return (
    <Link
      to={`/meo-thi-aptis/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-[#CC1C01]/40 hover:shadow-lg transition-all"
    >
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#CC1C01]/10 to-[#FEAD5F]/20">
            <FileText className="w-10 h-10 text-[#CC1C01]/40" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-semibold">
          {CATEGORY_LABELS[post.category]}
        </span>
        <h3 className="mt-3 text-lg font-heading font-bold text-foreground leading-snug line-clamp-2 group-hover:text-[#CC1C01] transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {post.excerpt}
          </p>
        )}
        <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {formatDate(post.published_at)}
        </div>
      </div>
    </Link>
  );
};

const LatestBlogSection = () => {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldLoad) return;
    const node = sentinelRef.current;
    if (!node) return;
    // Defer the Supabase call until the section is near the viewport.
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let alive = true;
    supabase
      .from("blog_posts" as any)
      .select("id, title, slug, excerpt, cover_image_url, category, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (alive) setPosts(((data as unknown) as BlogPost[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [shouldLoad]);


  if (posts && posts.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-[#FFF8F5] dark:bg-background border-t border-[#CC1C01]/10">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" /> Blog Aptis Kỳ Tích
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-heading font-extrabold tracking-tight text-[#4D0D0D] dark:text-foreground">
              Bài viết mới nhất
            </h2>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Mẹo làm bài, cấu trúc đề thi và kinh nghiệm đạt B1–C1 Aptis từ đội ngũ Aptis Kỳ Tích.
            </p>
          </div>
          <Link
            to="/meo-thi-aptis"
            className="inline-flex items-center gap-2 text-[#CC1C01] font-semibold hover:text-[#4D0D0D] transition-colors"
          >
            Xem tất cả bài viết
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {posts === null ? (
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-24 bg-muted rounded-full" />
                  <div className="h-5 w-full bg-muted rounded" />
                  <div className="h-3 w-5/6 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map((p) => (
              <LatestPostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default LatestBlogSection;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, FileText, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDateSafe } from "@/lib/safeDate";
import { BlogPost, BlogCategory, CATEGORY_LABELS, CATEGORY_OPTIONS } from "@/components/admin/blog/blogTypes";
import BlogCTA from "@/components/blog/BlogCTA";
import { usePageMeta } from "@/hooks/usePageMeta";

const POSTS_PER_PAGE = 9;

const formatDate = (iso: string | null) => {
  const d = parseDateSafe(iso);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const readingTime = (content: string | null | undefined) => {
  if (!content) return null;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} phút đọc`;
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


const CoverImage = ({ path, alt, className }: { path: string | null; alt: string; className?: string }) => {
  const url = useSignedCover(path);
  if (!url) {
    return (
      <div className={`bg-gradient-to-br from-[#CC1C01]/10 via-[#FEAD5F]/20 to-[#FEAD5F]/5 flex items-center justify-center ${className}`}>
        <FileText className="w-10 h-10 text-[#CC1C01]/40" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
};

const CategoryBadge = ({ category }: { category: BlogCategory }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-semibold">
    {CATEGORY_LABELS[category]}
  </span>
);

const FeaturedCard = ({ post }: { post: BlogPost }) => (
  <Link
    to={`/meo-thi-aptis/${post.slug}`}
    className="group grid md:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-[#CC1C01]/15 bg-card shadow-sm hover:shadow-xl hover:border-[#CC1C01]/40 transition-all"
  >
    <div className="relative aspect-[16/10] md:aspect-auto md:h-full overflow-hidden">
      <CoverImage
        path={post.cover_image_url}
        alt={post.title}
        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute top-4 left-4">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white text-xs font-bold shadow-md">
          ★ Nổi bật
        </span>
      </div>
    </div>
    <div className="p-6 md:p-8 flex flex-col justify-center">
      <CategoryBadge category={post.category} />
      <h2 className="mt-3 text-2xl md:text-3xl font-heading font-extrabold text-foreground leading-tight line-clamp-3 group-hover:text-[#CC1C01] transition-colors">
        {post.title}
      </h2>
      {post.excerpt && (
        <p className="mt-3 text-muted-foreground text-base leading-relaxed line-clamp-3">
          {post.excerpt}
        </p>
      )}
      <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> {formatDate(post.published_at)}
        </span>
        {readingTime(post.content) && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {readingTime(post.content)}
          </span>
        )}

      </div>
      <div className="mt-5 inline-flex items-center gap-2 text-[#CC1C01] font-semibold text-sm">
        Đọc bài viết
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  </Link>
);

const PostCard = ({ post }: { post: BlogPost }) => (
  <Link
    to={`/meo-thi-aptis/${post.slug}`}
    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-[#CC1C01]/40 hover:shadow-lg transition-all"
  >
    <div className="aspect-[16/9] overflow-hidden">
      <CoverImage
        path={post.cover_image_url}
        alt={post.title}
        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
      />
    </div>
    <div className="p-5 flex flex-col flex-1">
      <CategoryBadge category={post.category} />
      <h3 className="mt-3 text-lg font-heading font-bold text-foreground leading-snug line-clamp-2 group-hover:text-[#CC1C01] transition-colors">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {post.excerpt}
        </p>
      )}
      <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {formatDate(post.published_at)}
        </span>
        {readingTime(post.content) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {readingTime(post.content)}
          </span>
        )}

      </div>
    </div>
  </Link>
);

const CardSkeleton = () => (
  <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
    <div className="aspect-[16/9] bg-muted" />
    <div className="p-5 space-y-3">
      <div className="h-4 w-24 bg-muted rounded-full" />
      <div className="h-5 w-full bg-muted rounded" />
      <div className="h-5 w-3/4 bg-muted rounded" />
      <div className="h-3 w-full bg-muted rounded" />
      <div className="h-3 w-5/6 bg-muted rounded" />
    </div>
  </div>
);

type Filter = "all" | BlogCategory;

const BlogIndex = () => {
  usePageMeta({
    title: "Blog luyện thi Aptis | Aptis Kỳ Tích",
    description:
      "Mẹo làm bài, cấu trúc đề thi và kinh nghiệm đạt B1–C1 Aptis từ đội ngũ Aptis Kỳ Tích.",
  });

  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const load = () => {
    setError(null);
    setPosts(null);
    supabase
      .from("blog_posts" as any)
      .select("id, title, slug, excerpt, cover_image_url, category, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setPosts([]);
          return;
        }
        setPosts((data ?? []) as unknown as BlogPost[]);
      });
  };


  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (filter === "all") return posts;
    return posts.filter((p) => p.category === filter);
  }, [posts, filter]);

  const featured = filter === "all" && page === 1 ? filtered[0] : null;
  const gridPosts = featured ? filtered.slice(1) : filtered;

  const totalPages = Math.max(1, Math.ceil(gridPosts.length / POSTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
  const pagePosts = gridPosts.slice(pageStart, pageStart + POSTS_PER_PAGE);

  const handleFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const loading = posts === null;

  return (
    <div className="min-h-screen bg-[#FFF8F5] dark:bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-14 md:pt-32 md:pb-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-[#CC1C01]/10 via-[#FEAD5F]/15 to-transparent"
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 -z-10 h-72 w-72 rounded-full bg-[#FEAD5F]/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 -z-10 h-72 w-72 rounded-full bg-[#CC1C01]/20 blur-3xl"
        />
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-bold uppercase tracking-wider">
            Blog Aptis Kỳ Tích
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-heading font-extrabold tracking-tight text-[#4D0D0D] dark:text-foreground">
            Blog - Mẹo ôn{" "}
            <span className="bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] bg-clip-text text-transparent">
              Aptis
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
            Mẹo làm bài, cấu trúc đề thi và kinh nghiệm đạt B1–C1 từ Aptis Kỳ Tích.
          </p>
        </div>
      </section>

      {/* CTA nhóm Facebook */}
      <section className="max-w-[1200px] mx-auto px-4">
        <BlogCTA
          title={"Tham gia nhóm học tập\u00a0& Review đề để nhanh đạt mục tiêu nha."}
          buttonLabel="Tham gia nhóm"
          href="https://www.facebook.com/groups/1551779633112657"
        />
      </section>

      {/* Category filter */}
      <section className="bg-[#FFF8F5] dark:bg-background border-y border-[#CC1C01]/10">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none">
          {([{ key: "all" as Filter, label: "Tất cả" }] as { key: Filter; label: string }[])
            .concat(CATEGORY_OPTIONS.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })))
            .map((opt) => {
              const active = filter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleFilter(opt.key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    active
                      ? "bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white shadow-[0_4px_14px_-4px_rgba(204,28,1,0.5)]"
                      : "bg-white dark:bg-card text-foreground border border-border hover:border-[#CC1C01]/50 hover:text-[#CC1C01]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
        </div>
      </section>

      {/* Body */}
      <section className="max-w-[1200px] mx-auto px-4 py-10 md:py-14 space-y-10">
        {error && (
          <Card className="p-8 text-center border-destructive/40">
            <p className="text-destructive font-medium">Không tải được bài viết.</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button onClick={load} variant="outline" className="mt-4 gap-2">
              <RefreshCw className="w-4 h-4" /> Thử lại
            </Button>
          </Card>
        )}

        {loading && !error && (
          <>
            <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse grid md:grid-cols-2">
              <div className="aspect-[16/10] bg-muted" />
              <div className="p-8 space-y-4">
                <div className="h-4 w-24 bg-muted rounded-full" />
                <div className="h-7 w-full bg-muted rounded" />
                <div className="h-7 w-2/3 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-5/6 bg-muted rounded" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Card className="p-14 text-center">
            <FileText className="w-14 h-14 mx-auto text-[#CC1C01]/30 mb-4" />
            <h2 className="text-xl font-heading font-bold text-foreground">
              Chưa có bài viết trong mục này
            </h2>
            <p className="mt-2 text-muted-foreground">
              Hãy quay lại sau — đội ngũ Aptis Kỳ Tích đang biên soạn nội dung mới.
            </p>
          </Card>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            {featured && <FeaturedCard post={featured} />}

            {pagePosts.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pagePosts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const active = n === currentPage;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`h-9 min-w-9 px-3 rounded-md text-sm font-semibold transition-colors ${
                        active
                          ? "bg-[#CC1C01] text-white"
                          : "bg-white dark:bg-card border border-border text-foreground hover:border-[#CC1C01]/50"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  Sau <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default BlogIndex;

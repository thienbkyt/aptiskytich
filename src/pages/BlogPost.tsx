import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  User,
  ChevronRight,
  Home,
  FileText,
  Facebook,
  Link2,
  Share2,
  List,
  ArrowLeft,
} from "lucide-react";
import { parseDateSafe } from "@/lib/safeDate";
import {
  BlogPost,
  BlogCategory,
  CATEGORY_LABELS,
} from "@/components/admin/blog/blogTypes";
import BlogCTA from "@/components/blog/BlogCTA";
import { toast } from "@/hooks/use-toast";

const SITE = "https://aptiskytich.vn";
const BLOG_BASE = "/meo-thi-aptis";
const BLOG_LABEL = "Mẹo thi Aptis";

/**
 * Normalize legacy markdown stored with single-newline paragraph breaks so
 * ReactMarkdown treats each line as its own block. Also converts stray
 * setext underlines (`----` under a multi-line prose block) into <hr>.
 */
const normalizeMarkdown = (md: string): string => {
  if (!md) return "";
  const rawLines = md.replace(/\r\n/g, "\n").split("\n");
  // Pass 1: convert dash/equal-only lines (setext underlines) to real <hr>
  const pass1: string[] = [];
  let inFence1 = false;
  for (const line of rawLines) {
    if (/^```/.test(line.trim())) {
      inFence1 = !inFence1;
      pass1.push(line);
      continue;
    }
    if (!inFence1 && /^\s*(-{3,}|={3,})\s*$/.test(line)) {
      pass1.push("", "---", "");
      continue;
    }
    pass1.push(line);
  }
  // Pass 2: insert blank line between adjacent prose lines
  const isBlock = (s: string) =>
    /^\s*(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|\||```|---\s*$)/.test(s);
  const out: string[] = [];
  let inFence2 = false;
  for (let i = 0; i < pass1.length; i++) {
    const cur = pass1[i];
    out.push(cur);
    if (/^```/.test(cur.trim())) inFence2 = !inFence2;
    if (inFence2) continue;
    const next = pass1[i + 1];
    if (next === undefined) continue;
    if (cur.trim() === "" || next.trim() === "") continue;
    if (isBlock(cur) || isBlock(next)) continue;
    out.push("");
  }
  return out.join("\n");
};

const formatDate = (iso: string | null) => {
  const d = parseDateSafe(iso);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const readingMinutes = (content: string | null) => {
  const words = (content ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const slugifyHeading = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

const extractHeadings = (
  md: string | null,
): { id: string; text: string }[] => {
  if (!md) return [];
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  const lines = md.split("\n");
  let inCode = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = /^##\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/[*_`]/g, "").trim();
    let id = slugifyHeading(text);
    let i = 2;
    const base = id;
    while (seen.has(id)) id = `${base}-${i++}`;
    seen.add(id);
    out.push({ id, text });
  }
  return out;
};

const useSignedCover = (path: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from("blog-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
};

const CategoryBadge = ({ category }: { category: BlogCategory }) => (
  <Link
    to="/blog"
    className="inline-flex items-center px-3 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-bold uppercase tracking-wider hover:bg-[#CC1C01]/20 transition-colors"
  >
    {CATEGORY_LABELS[category]}
  </Link>
);

const RelatedCard = ({ post }: { post: BlogPost }) => {
  const cover = useSignedCover(post.cover_image_url);
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-[#CC1C01]/40 hover:shadow-lg transition-all"
    >
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#CC1C01]/10 to-[#FEAD5F]/20">
            <FileText className="w-8 h-8 text-[#CC1C01]/40" />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#CC1C01]">
          {CATEGORY_LABELS[post.category]}
        </span>
        <h3 className="mt-2 text-base font-heading font-bold text-foreground leading-snug line-clamp-2 group-hover:text-[#CC1C01] transition-colors">
          {post.title}
        </h3>
        <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {formatDate(post.published_at)}
        </div>
      </div>
    </Link>
  );
};

const ShareBar = ({ url, title }: { url: string; title: string }) => {
  const share = (target: "facebook" | "zalo") => {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const href =
      target === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${u}`
        : `https://zalo.me/share/url?url=${u}&title=${t}`;
    window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Đã sao chép liên kết" });
    } catch {
      toast({ title: "Không sao chép được", variant: "destructive" });
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mr-1">
        <Share2 className="w-4 h-4" /> Chia sẻ:
      </span>
      <button
        onClick={() => share("facebook")}
        aria-label="Chia sẻ lên Facebook"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1877F2] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Facebook className="w-4 h-4" /> Facebook
      </button>
      <button
        onClick={() => share("zalo")}
        aria-label="Chia sẻ lên Zalo"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0068FF] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <span className="text-xs font-black">Z</span> Zalo
      </button>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-semibold hover:border-[#CC1C01]/50 hover:text-[#CC1C01] transition-colors"
      >
        <Link2 className="w-4 h-4" /> Sao chép
      </button>
    </div>
  );
};

const NotFoundView = () => (
  <div className="min-h-screen bg-[#FFF8F5] dark:bg-background">
    <Navbar />
    <main className="max-w-3xl mx-auto px-4 py-24 text-center">
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#CC1C01]/10 text-[#CC1C01] text-xs font-bold uppercase tracking-wider">
        404
      </span>
      <h1 className="mt-4 text-3xl md:text-4xl font-heading font-extrabold text-[#4D0D0D] dark:text-foreground">
        Không tìm thấy bài viết
      </h1>
      <p className="mt-3 text-muted-foreground">
        Bài viết bạn đang tìm không tồn tại hoặc đã bị gỡ.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button asChild className="bg-[#CC1C01] hover:bg-[#4D0D0D] text-white gap-2">
          <Link to="/blog">
            <ArrowLeft className="w-4 h-4" /> Về trang Blog
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/">
            <Home className="w-4 h-4" /> Trang chủ
          </Link>
        </Button>
      </div>
    </main>
    <Footer />
  </div>
);

const PostSkeleton = () => (
  <div className="max-w-3xl mx-auto px-4 pt-28 pb-16 animate-pulse space-y-4">
    <div className="h-4 w-1/2 bg-muted rounded" />
    <div className="h-10 w-full bg-muted rounded" />
    <div className="h-10 w-3/4 bg-muted rounded" />
    <div className="h-72 w-full bg-muted rounded-2xl mt-6" />
    <div className="space-y-3 mt-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-4 w-full bg-muted rounded" />
      ))}
    </div>
  </div>
);

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const cover = useSignedCover(post?.cover_image_url ?? null);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    setPost(undefined);
    setRelated([]);
    setActiveId("");
    window.scrollTo({ top: 0, behavior: "auto" });
    supabase
      .from("blog_posts" as any)
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) {
          setPost(null);
          return;
        }
        const p = data as unknown as BlogPost;
        setPost(p);
        supabase
          .from("blog_posts" as any)
          .select("*")
          .eq("status", "published")
          .eq("category", p.category)
          .neq("id", p.id)
          .order("published_at", { ascending: false })
          .limit(3)
          .then(({ data: rel }) => {
            if (!alive) return;
            const list = ((rel as unknown) as BlogPost[]) ?? [];
            if (list.length >= 3) {
              setRelated(list);
              return;
            }
            const excludeIds = [p.id, ...list.map((r) => r.id)];
            supabase
              .from("blog_posts" as any)
              .select("*")
              .eq("status", "published")
              .not("id", "in", `(${excludeIds.join(",")})`)
              .order("published_at", { ascending: false })
              .limit(3 - list.length)
              .then(({ data: extra }) => {
                if (!alive) return;
                const more = ((extra as unknown) as BlogPost[]) ?? [];
                setRelated([...list, ...more]);
              });
          });
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const normalizedContent = useMemo(
    () => normalizeMarkdown(post?.content ?? ""),
    [post?.content],
  );

  const headings = useMemo(
    () => extractHeadings(normalizedContent || null),
    [normalizedContent],
  );

  useEffect(() => {
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [headings, post?.id]);

  // Derive a readable fallback title from the slug so crawlers and the
  // initial paint have meaningful metadata before the post loads.
  const slugTitle = (slug ?? "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const earlyTitle = slugTitle ? `${slugTitle} | Aptis Kỳ Tích` : `${BLOG_LABEL} | Aptis Kỳ Tích`;
  const earlyUrl = `${SITE}${BLOG_BASE}/${slug ?? ""}`;

  if (post === undefined) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] dark:bg-background">
        <Helmet>
          <title>{earlyTitle}</title>
          <meta
            name="description"
            content="Bài viết luyện thi Aptis từ Aptis Kỳ Tích — mẹo làm bài, cấu trúc đề thi và kinh nghiệm đạt B1–C1."
          />
          <link rel="canonical" href={earlyUrl} />
          <meta property="og:title" content={earlyTitle} />
          <meta property="og:url" content={earlyUrl} />
          <meta property="og:type" content="article" />
        </Helmet>
        <Navbar />
        <PostSkeleton />
        <Footer />
      </div>
    );
  }

  if (post === null) return <NotFoundView />;

  const url = `${SITE}${BLOG_BASE}/${post.slug}`;
  const seoTitle = post.seo_title || `${post.title} | Aptis Kỳ Tích`;
  const seoDescription = post.seo_description || post.excerpt || post.title;
  const publishedIso = post.published_at ?? post.created_at;
  const contentBody = normalizedContent;
  const midIndex = Math.floor(contentBody.length / 2);
  const splitAt = contentBody.indexOf("\n\n", midIndex);
  const firstHalf =
    splitAt > 0 ? contentBody.slice(0, splitAt) : contentBody;
  const secondHalf = splitAt > 0 ? contentBody.slice(splitAt) : "";
  const hasToc = headings.length >= 2;

  // Assign IDs to H2s in order — use a mutable counter closure
  let h2Counter = 0;
  const headingIds = headings.map((h) => h.id);
  const h2Class =
    "scroll-mt-28 mt-10 mb-4 text-[24px] leading-snug font-heading font-bold text-foreground";
  const H2 = (props: any) => {
    const id = headingIds[h2Counter++] ?? undefined;
    return (
      <h2 id={id} className={h2Class}>
        {props.children}
      </h2>
    );
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: seoDescription,
    image: cover ? [cover] : undefined,
    datePublished: publishedIso,
    dateModified: post.updated_at ?? publishedIso,
    author: {
      "@type": "Organization",
      name: "Aptis Kỳ Tích",
      url: SITE,
    },
    publisher: {
      "@type": "Organization",
      name: "Aptis Kỳ Tích",
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/icons/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  const markdownComponents: any = {
    h1: (p: any) => <h2 className={h2Class}>{p.children}</h2>,
    h2: H2,
    h3: (p: any) => (
      <h3 className="mt-8 mb-3 text-[20px] font-heading font-semibold text-foreground">
        {p.children}
      </h3>
    ),
    h4: (p: any) => (
      <h4 className="mt-6 mb-2 text-lg font-heading font-semibold text-foreground">
        {p.children}
      </h4>
    ),
    p: (p: any) => (
      <p className="mb-4 text-[17px] leading-[1.8] font-normal text-foreground">
        {p.children}
      </p>
    ),
    strong: (p: any) => (
      <strong className="font-semibold text-[#CC1C01]">{p.children}</strong>
    ),
    a: (p: any) => (
      <a
        href={p.href}
        target={p.href?.startsWith("http") ? "_blank" : undefined}
        rel={p.href?.startsWith("http") ? "noopener noreferrer" : undefined}
        className="text-[#CC1C01] font-medium no-underline hover:underline underline-offset-2"
      >
        {p.children}
      </a>
    ),
    ul: (p: any) => (
      <ul className="mb-4 pl-6 list-disc space-y-2 text-[17px] leading-[1.8] font-normal text-foreground marker:text-muted-foreground">
        {p.children}
      </ul>
    ),
    ol: (p: any) => (
      <ol className="mb-4 pl-6 list-decimal space-y-2 text-[17px] leading-[1.8] font-normal text-foreground marker:text-muted-foreground">
        {p.children}
      </ol>
    ),
    blockquote: (p: any) => (
      <blockquote className="my-6 border-l-4 border-[#CC1C01] bg-[#CC1C01]/5 px-5 py-3 rounded-r-lg italic text-foreground/90">
        {p.children}
      </blockquote>
    ),
    code: ({ inline, children }: any) =>
      inline ? (
        <code className="px-1.5 py-0.5 rounded bg-muted text-[#CC1C01] text-[0.9em] font-mono">
          {children}
        </code>
      ) : (
        <code className="block p-4 rounded-lg bg-[#0F0F10] text-white text-sm font-mono overflow-x-auto">
          {children}
        </code>
      ),
    pre: (p: any) => <pre className="my-5 overflow-x-auto">{p.children}</pre>,
    img: (p: any) => (
      <img
        src={p.src}
        alt={p.alt || ""}
        loading="lazy"
        className="my-6 rounded-xl w-full h-auto border border-border"
      />
    ),
    table: (p: any) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">{p.children}</table>
      </div>
    ),
    thead: (p: any) => <thead className="bg-[#CC1C01]/5">{p.children}</thead>,
    th: (p: any) => (
      <th className="px-4 py-2 text-left font-bold text-foreground border-b border-border">
        {p.children}
      </th>
    ),
    td: (p: any) => (
      <td className="px-4 py-2 border-b border-border/60 text-foreground/90">
        {p.children}
      </td>
    ),
    hr: () => <hr className="my-8 border-border" />,
  };

  return (
    <div className="min-h-screen bg-[#FFF8F5] dark:bg-background">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={url} />
        {cover && <meta property="og:image" content={cover} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {cover && <meta name="twitter:image" content={cover} />}
        <meta property="article:published_time" content={publishedIso ?? ""} />
        {post.updated_at && (
          <meta property="article:modified_time" content={post.updated_at} />
        )}
        <meta property="article:section" content={CATEGORY_LABELS[post.category]} />
        {(post.tags ?? []).map((t) => (
          <meta key={t} property="article:tag" content={t} />
        ))}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-28 pb-16">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="max-w-[1100px] mx-auto px-4 mb-6 text-sm text-muted-foreground"
        >
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li>
              <Link to="/" className="hover:text-[#CC1C01] inline-flex items-center gap-1">
                <Home className="w-3.5 h-3.5" /> Trang chủ
              </Link>
            </li>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <li>
              <Link to="/blog" className="hover:text-[#CC1C01]">
                Blog
              </Link>
            </li>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <li>
              <Link to="/blog" className="hover:text-[#CC1C01]">
                {CATEGORY_LABELS[post.category]}
              </Link>
            </li>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <li className="text-foreground font-medium line-clamp-1">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <header className="max-w-[900px] mx-auto px-4 text-center">
          <CategoryBadge category={post.category} />
          <h1 className="mt-4 text-3xl md:text-5xl font-heading font-extrabold tracking-tight text-[#4D0D0D] dark:text-foreground leading-tight">
            {post.title}
          </h1>
          <div className="mt-5 flex items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4" /> Aptis Kỳ Tích
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {formatDate(publishedIso)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {readingMinutes(post.content)} phút đọc
            </span>
          </div>
        </header>

        {/* Cover */}
        {(cover || post.cover_image_url) && (
          <div className="max-w-[900px] mx-auto px-4 mt-8">
            <div className="rounded-2xl overflow-hidden border border-border shadow-lg aspect-[16/9] bg-muted">
              {cover ? (
                <img
                  src={cover}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#CC1C01]/10 to-[#FEAD5F]/20">
                  <FileText className="w-14 h-14 text-[#CC1C01]/40" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body + TOC */}
        <div className="max-w-[1100px] mx-auto px-4 mt-10 grid lg:grid-cols-[1fr_260px] gap-10">
          <article className="min-w-0">
            {/* Mobile TOC */}
            {headings.length > 1 && (
              <details className="lg:hidden mb-6 rounded-xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold text-foreground inline-flex items-center gap-2">
                  <List className="w-4 h-4 text-[#CC1C01]" /> Mục lục ({headings.length})
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="text-muted-foreground hover:text-[#CC1C01] block"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mx-auto max-w-[720px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {firstHalf}
              </ReactMarkdown>

              {secondHalf && <BlogCTA />}

              {secondHalf && (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {secondHalf}
                </ReactMarkdown>
              )}

              {(post.tags?.length ?? 0) > 0 && (
                <div className="mt-10 flex flex-wrap gap-2">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full bg-[#FEAD5F]/20 text-[#4D0D0D] dark:text-[#FEAD5F] text-xs font-semibold"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <BlogCTA
                  title="Sẵn sàng luyện đề? Thử ngay bộ đề mô phỏng 100% thi thật."
                  buttonLabel="Bắt đầu luyện thi"
                />
              </div>

              <div className="mt-10 pt-6 border-t border-border">
                <ShareBar url={url} title={post.title} />
              </div>
            </div>
          </article>

          {/* Desktop TOC */}
          {headings.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                    <List className="w-4 h-4 text-[#CC1C01]" /> Mục lục
                  </div>
                  <ul className="space-y-2 text-sm max-h-[70vh] overflow-y-auto pr-1">
                    {headings.map((h) => {
                      const active = activeId === h.id;
                      return (
                        <li key={h.id}>
                          <a
                            href={`#${h.id}`}
                            className={`block py-1.5 pl-3 border-l-2 transition-colors ${
                              active
                                ? "border-[#CC1C01] text-[#CC1C01] font-semibold"
                                : "border-transparent text-muted-foreground hover:text-[#CC1C01] hover:border-[#CC1C01]/40"
                            }`}
                          >
                            {h.text}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="max-w-[1100px] mx-auto px-4 mt-16">
            <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-[#4D0D0D] dark:text-foreground">
              Bài viết liên quan
            </h2>
            <p className="mt-1 text-muted-foreground">
              Cùng chủ đề {CATEGORY_LABELS[post.category]}
            </p>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              {related.map((p) => (
                <RelatedCard key={p.id} post={p} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="gap-2">
                <Link to="/blog">
                  <ArrowLeft className="w-4 h-4" /> Xem tất cả bài viết
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPostPage;

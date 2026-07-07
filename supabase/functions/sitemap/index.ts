// Public sitemap generator. No auth required.
// Returns an XML sitemap listing the homepage, /blog, and every published blog post.
// Run this function and paste the response body into public/sitemap.xml whenever
// posts are added/removed so https://aptiskytich.vn/sitemap.xml stays fresh.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE = "https://aptiskytich.vn";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === "'"
            ? "&apos;"
            : "&quot;",
  );

const toW3C = (v: string | null) => {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) throw error;

    const now = new Date().toISOString();
    const urls: { loc: string; lastmod: string; priority: string; changefreq: string }[] = [
      { loc: `${SITE}/`, lastmod: now, priority: "1.0", changefreq: "weekly" },
      { loc: `${SITE}/blog`, lastmod: now, priority: "0.9", changefreq: "daily" },
      { loc: `${SITE}/thi-thu`, lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: `${SITE}/key-du-doan`, lastmod: now, priority: "0.8", changefreq: "weekly" },
      { loc: `${SITE}/vocabulary`, lastmod: now, priority: "0.7", changefreq: "weekly" },
      { loc: `${SITE}/pricing`, lastmod: now, priority: "0.6", changefreq: "monthly" },
    ];

    for (const p of posts ?? []) {
      urls.push({
        loc: `${SITE}/blog/${p.slug}`,
        lastmod: toW3C(p.updated_at ?? p.published_at),
        priority: "0.8",
        changefreq: "monthly",
      });
    }

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${xmlEscape(u.loc)}</loc>\n` +
            `    <lastmod>${u.lastmod}</lastmod>\n` +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            `  </url>`,
        )
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- error: ${(err as Error).message} -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      },
    );
  }
});

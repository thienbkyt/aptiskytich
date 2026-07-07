import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Upload, Save, Send, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BlogPost, BlogCategory, CATEGORY_LABELS, CATEGORY_OPTIONS, slugifyVi } from "./blogTypes";
import MarkdownToolbar from "./MarkdownToolbar";

interface Props {
  postId: string | null;
  onDone: () => void;
}

const EXCERPT_MAX = 200;
const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;

const BlogEditor = ({ postId, onDone }: Props) => {
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    slugTouched: false,
    excerpt: "",
    content: "",
    cover_image_url: "",
    category: "meo-lam-bai" as BlogCategory,
    tags: "",
    seo_title: "",
    seo_description: "",
    status: "draft" as "draft" | "published",
  });

  useEffect(() => {
    if (!postId) return;
    (async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("*")
        .eq("id", postId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Không tải được bài viết");
        onDone();
        return;
      }
      const p = data as unknown as BlogPost;
      setForm({
        title: p.title,
        slug: p.slug,
        slugTouched: true,
        excerpt: p.excerpt ?? "",
        content: p.content ?? "",
        cover_image_url: p.cover_image_url ?? "",
        category: p.category,
        tags: (p.tags ?? []).join(", "),
        seo_title: p.seo_title ?? "",
        seo_description: p.seo_description ?? "",
        status: p.status,
      });
      if (p.cover_image_url) resolveCoverPreview(p.cover_image_url);
      setLoading(false);
    })();
  }, [postId]);

  const resolveCoverPreview = async (path: string) => {
    if (path.startsWith("http")) {
      setCoverPreview(path);
      return;
    }
    const { data } = await supabase.storage.from("blog-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) setCoverPreview(data.signedUrl);
  };

  const handleTitleChange = (v: string) => {
    setForm((f) => ({
      ...f,
      title: v,
      slug: f.slugTouched ? f.slug : slugifyVi(v),
    }));
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("blog-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      setForm((f) => ({ ...f, cover_image_url: path }));
      await resolveCoverPreview(path);
      toast.success("Đã tải ảnh bìa lên");
    } catch (e: any) {
      toast.error("Tải ảnh thất bại: " + (e?.message ?? "unknown"));
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = () => {
    setForm((f) => ({ ...f, cover_image_url: "" }));
    setCoverPreview(null);
  };

  const save = async (nextStatus: "draft" | "published") => {
    if (!form.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugifyVi(form.title),
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      cover_image_url: form.cover_image_url || null,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      status: nextStatus,
    };
    if (!postId) {
      const { data: userRes } = await supabase.auth.getUser();
      payload.author_id = userRes.user?.id ?? null;
    }

    const q = postId
      ? supabase.from("blog_posts" as any).update(payload).eq("id", postId)
      : supabase.from("blog_posts" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success(nextStatus === "published" ? "Đã đăng bài viết" : "Đã lưu bản nháp");
    onDone();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 mx-auto animate-spin" />
      </div>
    );
  }

  const seoTitleDisplay = form.seo_title || form.title || "Tiêu đề bài viết";
  const seoDescDisplay =
    form.seo_description || form.excerpt || "Mô tả ngắn sẽ hiển thị trên Google.";
  const previewUrl = `aptiskytich.vn › blog › ${form.slug || "duong-dan"}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" onClick={onDone} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => save("draft")}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Lưu bản nháp
          </Button>
          <Button onClick={() => save("published")} disabled={saving} className="gap-2">
            <Send className="w-4 h-4" /> Đăng bài
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5 space-y-4">
            <div>
              <Label htmlFor="title">Tiêu đề</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ví dụ: 5 mẹo làm Reading Part 2 Aptis đạt B2"
                className="mt-1.5 text-lg"
              />
            </div>
            <div>
              <Label htmlFor="slug">Đường dẫn (slug)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">/blog/</span>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: slugifyVi(e.target.value), slugTouched: true }))
                  }
                  placeholder="tu-dong-tao-tu-tieu-de"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">
                Tóm tắt{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  ({form.excerpt.length}/{EXCERPT_MAX})
                </span>
              </Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value.slice(0, EXCERPT_MAX) }))
                }
                rows={3}
                placeholder="Đoạn giới thiệu ngắn xuất hiện trên trang danh sách và mạng xã hội."
                className="mt-1.5"
              />
            </div>
          </Card>

          <Card>
            <div className="px-5 pt-5 pb-3">
              <Label>Nội dung bài viết</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Hỗ trợ Markdown: tiêu đề, in đậm, danh sách, trích dẫn, liên kết, ảnh.
              </p>
            </div>
            <div className="px-5 pb-5">
              <div className="rounded-md border border-border">
                <MarkdownToolbar
                  textareaRef={contentRef}
                  onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                />
                <Textarea
                  ref={contentRef}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={20}
                  placeholder={`## Mở bài\n\nAptis Reading Part 2 yêu cầu bạn sắp xếp các câu theo thứ tự hợp lý...\n\n## Mẹo 1: Tìm từ nối\n\n- **However** báo hiệu ý đối lập\n- **Moreover** bổ sung thông tin\n\n> Ghi nhớ: luôn đọc câu đầu tiên trước.`}
                  className="rounded-t-none border-0 focus-visible:ring-0 font-mono text-sm resize-y"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">SEO</h3>
              <p className="text-xs text-muted-foreground">
                Tối ưu hoá cho công cụ tìm kiếm. Để trống sẽ dùng tiêu đề & tóm tắt.
              </p>
            </div>
            <div>
              <Label htmlFor="seo_title">
                SEO Title{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  ({form.seo_title.length}/{SEO_TITLE_MAX})
                </span>
              </Label>
              <Input
                id="seo_title"
                value={form.seo_title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seo_title: e.target.value.slice(0, SEO_TITLE_MAX) }))
                }
                placeholder="Mẹo làm Reading Part 2 Aptis | Aptis Kỳ Tích"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="seo_desc">
                SEO Description{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  ({form.seo_description.length}/{SEO_DESC_MAX})
                </span>
              </Label>
              <Textarea
                id="seo_desc"
                value={form.seo_description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seo_description: e.target.value.slice(0, SEO_DESC_MAX),
                  }))
                }
                rows={3}
                placeholder="Hướng dẫn chi tiết cách xử lý Reading Part 2 Aptis với ví dụ thực tế…"
                className="mt-1.5"
              />
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Xem trước trên Google
              </p>
              <div className="text-xs text-muted-foreground">{previewUrl}</div>
              <div className="text-[#1a0dab] dark:text-blue-400 text-lg font-medium leading-snug mt-0.5 line-clamp-1">
                {seoTitleDisplay}
              </div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {seoDescDisplay}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5 space-y-3">
            <Label>Ảnh bìa</Label>
            {coverPreview ? (
              <div className="relative rounded-md overflow-hidden border border-border">
                <img src={coverPreview} alt="Cover" className="w-full h-40 object-cover" />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={removeCover}
                  className="absolute top-2 right-2 h-7 w-7 p-0"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-40 rounded-md border-2 border-dashed border-border cursor-pointer hover:bg-muted/30 transition-colors">
                {uploadingCover ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Nhấn để tải ảnh lên</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload(f);
                    e.target.value = "";
                  }}
                  disabled={uploadingCover}
                />
              </label>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <Label>Danh mục</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as BlogCategory }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="reading, b2, mẹo thi"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ngăn cách bằng dấu phẩy.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BlogEditor;

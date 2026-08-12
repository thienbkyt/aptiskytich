import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, MessageSquareHeart, ImageIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  rating: number;
  content: string;
  score_image_url: string | null;
  is_anonymous: boolean;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  is_mine: boolean;
  is_approved?: boolean;
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày trước`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} tháng trước`;
  return `${Math.floor(mo / 12)} năm trước`;
};

const Stars = ({ value, size = 16 }: { value: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        style={{ width: size, height: size }}
        className={i <= value ? "fill-[#FEAD5F] text-[#FEAD5F]" : "text-muted-foreground/40"}
      />
    ))}
  </div>
);

const SignedFeedbackImage = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (/^https?:\/\//i.test(path)) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from("feedback-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="mt-3 h-40 rounded-lg bg-muted animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mt-3">
      <img
        src={url}
        alt="Ảnh bảng điểm Aptis của học viên"
        loading="lazy"
        className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted/30"
      />
    </a>
  );
};

const FeedbackCard = ({ row }: { row: Row }) => {
  const [expanded, setExpanded] = useState(false);
  const long = row.content.length > 260;
  const text = expanded || !long ? row.content : row.content.slice(0, 260) + "…";
  const name = row.is_anonymous ? "Học viên ẩn danh" : row.author_name || "Học viên";
  const pending = row.is_approved === false;

  return (
    <article className="rounded-xl border border-border bg-card p-5 flex flex-col">
      <div className="flex items-start gap-3">
        {row.is_anonymous || !row.author_avatar ? (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
            {row.is_anonymous ? "?" : name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <img src={row.author_avatar} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{name}</span>
            {pending && (
              <Badge variant="outline" className="text-[11px] border-[#FEAD5F] text-[#B26A00]">
                Chờ duyệt
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars value={row.rating} />
            <span className="text-xs text-muted-foreground">{relativeTime(row.created_at)}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-foreground/90 mt-3 whitespace-pre-wrap leading-relaxed">{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start mt-1 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Thu gọn" : "Đọc thêm"}
        </button>
      )}
      {row.score_image_url && <SignedFeedbackImage path={row.score_image_url} />}
    </article>
  );
};

const FeedbackPage = () => {
  usePageMeta({
    title: "Feedback học viên — Cảm nhận thật khi luyện thi Aptis | Aptis Kỳ Tích",
    description:
      "Cảm nhận của học viên Aptis Kỳ Tích: điểm số thực tế, trải nghiệm luyện đề và AI chấm Speaking, Writing. Gửi feedback của bạn ngay.",
    path: "/feedback",
  });

  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "image" | "mine">("all");
  const [open, setOpen] = useState(false);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [anon, setAnon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pub, own] = await Promise.all([
      supabase.rpc("list_student_feedback"),
      user
        ? supabase
            .from("student_feedback")
            .select("id, rating, content, score_image_url, is_anonymous, created_at, is_approved")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    setRows(((pub.data as Row[]) || []).map((r) => ({ ...r, is_approved: true })));
    setMine(
      ((own.data as any[]) || []).map((r) => ({
        ...r,
        author_name: null,
        author_avatar: null,
        is_mine: true,
      })) as Row[],
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const count = rows.length;
    const avg = count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
    const withImage = rows.filter((r) => !!r.score_image_url).length;
    return { count, avg, withImage };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "mine") return mine;
    if (filter === "image") return rows.filter((r) => !!r.score_image_url);
    return rows;
  }, [filter, rows, mine]);

  const submit = async () => {
    if (!user) return;
    if (content.trim().length < 10) {
      toast.error("Nội dung feedback cần ít nhất 10 ký tự.");
      return;
    }
    setSaving(true);
    try {
      let path: string | null = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận tệp ảnh.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Ảnh tối đa 5MB.");
        const ext = file.name.split(".").pop() || "jpg";
        const key = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("feedback-images").upload(key, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        path = key;
      }
      const { error } = await supabase.from("student_feedback").insert({
        user_id: user.id,
        rating,
        content: content.trim(),
        score_image_url: path,
        is_anonymous: anon,
      });
      if (error) throw error;
      setOpen(false);
      setContent("");
      setRating(5);
      setAnon(false);
      setFile(null);
      toast.success("Cảm ơn bạn, feedback sẽ hiển thị sau khi được duyệt");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Không gửi được feedback, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquareHeart className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                Feedback học viên
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Cảm nhận thật của học viên sau khi luyện đề và thi Aptis cùng Kỳ Tích.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-6 max-w-2xl">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-2xl font-bold text-foreground">{stats.avg.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground mt-1">Điểm trung bình</div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-2xl font-bold text-foreground">{stats.count}</div>
                <div className="text-xs text-muted-foreground mt-1">Feedback đã duyệt</div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-2xl font-bold text-foreground">{stats.withImage}</div>
                <div className="text-xs text-muted-foreground mt-1">Có ảnh bảng điểm</div>
              </div>
            </div>

            <div className="mt-6">
              {user ? (
                <Button className="gap-2" onClick={() => setOpen(true)}>
                  <Star className="w-4 h-4" /> Viết feedback của bạn
                </Button>
              ) : (
                <Button asChild className="gap-2">
                  <Link to="/auth">Đăng nhập để viết feedback</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="section-container py-8">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "Tất cả"],
              ["image", "Có bảng điểm"],
              ["mine", "Của tôi"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {filter === "mine"
                ? "Bạn chưa gửi feedback nào."
                : "Chưa có feedback nào ở mục này."}
            </div>
          ) : (
            <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((r) => (
                <FeedbackCard key={r.id} row={r} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Viết feedback của bạn</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Bạn chấm mấy sao?</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} sao`}>
                    <Star
                      className={`w-7 h-7 ${i <= rating ? "fill-[#FEAD5F] text-[#FEAD5F]" : "text-muted-foreground/40"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Nội dung</div>
              <Textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Bạn học thế nào, điểm thi ra sao, phần nào giúp bạn nhiều nhất?"
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Ảnh bảng điểm (không bắt buộc)</div>
              <label className="flex items-center gap-2 text-sm border border-dashed border-border rounded-lg px-3 py-3 cursor-pointer hover:bg-muted/40">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{file ? file.name : "Chọn ảnh (tối đa 5MB)"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <button
                  type="button"
                  className="mt-1 text-xs text-primary hover:underline"
                  onClick={() => setFile(null)}
                >
                  Bỏ ảnh
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={anon} onCheckedChange={(v) => setAnon(!!v)} />
              Đăng ẩn danh
            </label>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ImageIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Feedback sẽ hiển thị sau khi được đội ngũ duyệt.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Gửi feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackPage;

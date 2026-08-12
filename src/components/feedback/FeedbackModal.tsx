import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, MessageSquare, Star, Upload, X } from "lucide-react";

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface MyRow {
  id: string;
  rating: number;
  content: string;
  score_image_url: string | null;
  is_anonymous: boolean;
  is_approved: boolean;
  created_at: string;
}

const SignedImage = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(/^https?:\/\//i.test(path) ? path : null);
  useEffect(() => {
    if (/^https?:\/\//i.test(path)) return;
    let alive = true;
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
  if (!url) return <div className="mt-2 h-28 animate-pulse rounded-lg bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
      <img
        src={url}
        alt="Ảnh bảng điểm Aptis"
        loading="lazy"
        className="max-h-48 w-full rounded-lg border border-border bg-muted/30 object-contain"
      />
    </a>
  );
};

const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} sao`}>
        <Star
          className={`h-7 w-7 ${i <= value ? "fill-[#FEAD5F] text-[#FEAD5F]" : "text-muted-foreground/40"}`}
        />
      </button>
    ))}
  </div>
);

const FeedbackModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState("new");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [anon, setAnon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<MyRow[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadMine = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("student_feedback")
      .select("id, rating, content, score_image_url, is_anonymous, is_approved, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Không tải được feedback của bạn");
      setMine([]);
      return;
    }
    setMine((data as MyRow[]) || []);
  };

  useEffect(() => {
    if (open && tab === "mine") loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, user?.id]);

  const submit = async () => {
    if (!user) return;
    if (content.trim().length < MIN_CHARS) {
      toast.error(`Nội dung feedback cần ít nhất ${MIN_CHARS} ký tự.`);
      return;
    }
    setSaving(true);
    try {
      let path: string | null = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận tệp ảnh.");
        if (file.size > MAX_FILE_BYTES) throw new Error("Ảnh tối đa 5MB.");
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
      setContent("");
      setRating(5);
      setAnon(false);
      setFile(null);
      toast.success("Cảm ơn bạn, feedback sẽ hiển thị sau khi được duyệt");
      setTab("mine");
      loadMine();
    } catch (e: any) {
      toast.error(e?.message || "Không gửi được feedback, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feedback học viên
          </DialogTitle>
        </DialogHeader>

        {!user ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Bạn cần đăng nhập để gửi feedback.
          </p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">Gửi feedback</TabsTrigger>
              <TabsTrigger value="mine">Feedback của tôi</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-3 pt-3">
              <div>
                <div className="mb-2 text-sm font-medium">Bạn chấm mấy sao?</div>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Bạn học thế nào, điểm thi ra sao, phần nào giúp bạn nhiều nhất?"
                rows={6}
                className="resize-none"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tối thiểu {MIN_CHARS} ký tự · ảnh bảng điểm ≤ 5MB</span>
                <span>
                  {content.length}/{MAX_CHARS}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" /> Ảnh bảng điểm
                </Button>
                {file && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      aria-label="Bỏ ảnh"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={anon} onCheckedChange={(v) => setAnon(!!v)} />
                Đăng ẩn danh
              </label>

              <p className="text-xs text-muted-foreground">
                Feedback sẽ hiển thị sau khi được đội ngũ duyệt.
              </p>

              <Button
                className="w-full"
                disabled={content.trim().length < MIN_CHARS || saving}
                onClick={submit}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gửi feedback
              </Button>
            </TabsContent>

            <TabsContent value="mine" className="pt-3">
              {mine === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : mine.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Bạn chưa gửi feedback nào.</p>
              ) : (
                <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                  {mine.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[11px] font-semibold ${
                            r.is_approved
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "border-[#FEAD5F] text-[#B26A00]"
                          }`}
                        >
                          {r.is_approved ? "Đã duyệt" : "Chờ duyệt"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i <= r.rating ? "fill-[#FEAD5F] text-[#FEAD5F]" : "text-muted-foreground/40"}`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{r.content}</p>
                      {r.score_image_url && <SignedImage path={r.score_image_url} />}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;

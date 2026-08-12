import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, Paperclip, Link2, X, Loader2, Lightbulb, FileText, ExternalLink } from "lucide-react";

const MAX_CHARS = 2000;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Attachment =
  | { type: "image" | "file"; path: string; name: string }
  | { type: "link"; url: string; name: string };

interface SuggestionRow {
  id: string;
  content: string;
  attachments: Attachment[];
  status: string;
  admin_note: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "Mới", className: "bg-muted text-foreground" },
  planned: { label: "Đã lên kế hoạch", className: "bg-primary/10 text-primary border border-primary/30" },
  done: { label: "Đã làm", className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  rejected: { label: "Không làm", className: "bg-destructive/10 text-destructive border border-destructive/30" },
};

const AttachmentChip = ({ a, onRemove }: { a: Attachment; onRemove?: () => void }) => {
  const [url, setUrl] = useState<string | null>(a.type === "link" ? a.url : null);

  useEffect(() => {
    if (a.type === "link") return;
    let alive = true;
    supabase.storage
      .from("suggestion-files")
      .createSignedUrl(a.path, 3600)
      .then(({ data }) => {
        if (alive && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [a]);

  const Icon = a.type === "image" ? ImagePlus : a.type === "file" ? FileText : ExternalLink;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="truncate hover:underline">
          {a.name}
        </a>
      ) : (
        <span className="truncate">{a.name}</span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Xoá tệp đính kèm" className="text-muted-foreground hover:text-destructive">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
};

const FeatureSuggestionModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState("new");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [mine, setMine] = useState<SuggestionRow[] | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadMine = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("feature_suggestions")
      .select("id, content, attachments, status, admin_note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Không tải được đề xuất của bạn", variant: "destructive" });
      return;
    }
    setMine(
      (data ?? []).map((r) => ({
        ...r,
        attachments: Array.isArray(r.attachments) ? (r.attachments as unknown as Attachment[]) : [],
      })),
    );
  };

  useEffect(() => {
    if (open && tab === "mine") loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, user?.id]);

  const handleFiles = async (files: FileList | null, kind: "image" | "file") => {
    if (!files?.length || !user) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast({ title: `Tối đa ${MAX_ATTACHMENTS} tệp đính kèm`, variant: "destructive" });
      return;
    }
    setUploading(true);
    const added: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        toast({ title: `"${file.name}" vượt quá 5MB`, variant: "destructive" });
        continue;
      }
      const ok = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!ok) {
        toast({ title: `"${file.name}" không được hỗ trợ (chỉ ảnh hoặc PDF)`, variant: "destructive" });
        continue;
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("suggestion-files").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast({ title: `Tải "${file.name}" thất bại`, description: error.message, variant: "destructive" });
        continue;
      }
      added.push({ type: file.type === "application/pdf" ? "file" : kind, path, name: file.name });
    }
    setAttachments((prev) => [...prev, ...added]);
    setUploading(false);
  };

  const addLink = () => {
    const v = linkValue.trim();
    if (!v) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      toast({ title: `Tối đa ${MAX_ATTACHMENTS} tệp đính kèm`, variant: "destructive" });
      return;
    }
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    setAttachments((prev) => [...prev, { type: "link", url, name: url }]);
    setLinkValue("");
    setLinkMode(false);
  };

  const submit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("feature_suggestions").insert({
      user_id: user.id,
      content: content.trim(),
      attachments: attachments as unknown as never,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Gửi đề xuất thất bại", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã gửi đề xuất. Cảm ơn bạn!" });
    setContent("");
    setAttachments([]);
    setTab("mine");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Đề xuất tính năng
          </DialogTitle>
        </DialogHeader>

        {!user ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Bạn cần đăng nhập để gửi đề xuất tính năng.
          </p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">Đề xuất mới</TabsTrigger>
              <TabsTrigger value="mine">Đề xuất của tôi</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-3 pt-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Bạn muốn Aptis Kỳ Tích có thêm tính năng gì?"
                rows={6}
                className="resize-none"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tối đa {MAX_ATTACHMENTS} tệp đính kèm · ảnh/PDF ≤ 5MB</span>
                <span>{content.length}/{MAX_CHARS}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => imageInput.current?.click()}>
                  <ImagePlus className="mr-1.5 h-4 w-4" /> Ảnh
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  <Paperclip className="mr-1.5 h-4 w-4" /> Tệp
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setLinkMode((v) => !v)}>
                  <Link2 className="mr-1.5 h-4 w-4" /> Liên kết
                </Button>
                {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>

              <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { handleFiles(e.target.files, "image"); e.target.value = ""; }} />
              <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { handleFiles(e.target.files, "file"); e.target.value = ""; }} />

              {linkMode && (
                <div className="flex gap-2">
                  <Input
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                    placeholder="https://..."
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={addLink}>
                    Thêm
                  </Button>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <AttachmentChip
                      key={i}
                      a={a}
                      onRemove={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}

              <Button className="w-full" disabled={!content.trim() || submitting || uploading} onClick={submit}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gửi đề xuất
              </Button>
            </TabsContent>

            <TabsContent value="mine" className="pt-3">
              {mine === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : mine.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Bạn chưa gửi đề xuất nào.</p>
              ) : (
                <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                  {mine.map((s) => {
                    const meta = STATUS_META[s.status] ?? STATUS_META.new;
                    return (
                      <div key={s.id} className="rounded-xl border border-border p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge className={`${meta.className} rounded-full text-[11px] font-semibold`} variant="outline">
                            {meta.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{s.content}</p>
                        {s.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {s.attachments.map((a, i) => (
                              <AttachmentChip key={i} a={a} />
                            ))}
                          </div>
                        )}
                        {s.admin_note && (
                          <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Phản hồi: </span>
                            {s.admin_note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FeatureSuggestionModal;

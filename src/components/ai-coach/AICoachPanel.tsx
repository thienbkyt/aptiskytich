import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sparkles, RotateCcw, Loader2, Paperclip, Monitor, FileText, Square, Volume2, VolumeX, RefreshCw, Languages, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCoachContext, getSuggestedPrompts } from "@/hooks/useCoachContext";
import { toast } from "@/hooks/use-toast";

type Attachment = { id: string; dataUrl: string; label: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: { dataUrl: string; label: string }[];
  pageText?: string;
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function downscaleImage(dataUrl: string, maxDim = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function extractPageText(): string {
  const root = document.querySelector("main") || document.body;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("aside, script, style, noscript, [data-coach-panel]").forEach((el) => el.remove());
  const text = (clone.innerText || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.slice(0, 6000);
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AICoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ctx = useCoachContext();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pageSnippet, setPageSnippet] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Rate-limit countdown ticker
  useEffect(() => {
    if (!rateLimitUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rateLimitUntil]);
  useEffect(() => {
    if (rateLimitUntil && Date.now() >= rateLimitUntil) setRateLimitUntil(null);
  }, [now, rateLimitUntil]);

  // Stop TTS when panel closes
  useEffect(() => {
    if (!open) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) await addImageFile(f);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  const addImageFile = async (file: File) => {
    try {
      if (!file.type.startsWith("image/")) return;
      const raw = await fileToDataUrl(file);
      const small = await downscaleImage(raw);
      if (small.length > MAX_IMAGE_BYTES * 1.4) {
        toast({ title: "Ảnh quá lớn", description: "Hãy thử ảnh nhỏ hơn.", variant: "destructive" });
        return;
      }
      setAttachments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), dataUrl: small, label: file.name || "image.jpg" },
      ].slice(-4));
    } catch {
      toast({ title: "Không đọc được ảnh", variant: "destructive" });
    }
  };

  const captureScreen = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      // @ts-ignore
      const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as any, audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      const raw = canvas.toDataURL("image/jpeg", 0.85);
      const small = await downscaleImage(raw, 1800);
      setAttachments((prev) => [...prev, { id: crypto.randomUUID(), dataUrl: small, label: "Ảnh chụp màn hình" }].slice(-4));
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") {
        toast({ title: "Không chụp được màn hình", description: e?.message || "", variant: "destructive" });
      }
    } finally { setCapturing(false); }
  };

  const grabPageText = () => {
    const text = extractPageText();
    if (!text) { toast({ title: "Không tìm thấy nội dung trang" }); return; }
    setPageSnippet(text);
    toast({ title: "Đã trích nội dung trang", description: `${text.length} ký tự đã sẵn sàng gửi cho Coach.` });
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  };

  const speak = (id: string, raw: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast({ title: "Trình duyệt không hỗ trợ TTS" });
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const text = stripMarkdown(raw).slice(0, 2500);
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    // Heuristic: if mostly ASCII => English voice, else Vietnamese
    const asciiRatio = (text.match(/[\x00-\x7F]/g)?.length || 0) / text.length;
    u.lang = asciiRatio > 0.85 ? "en-GB" : "vi-VN";
    u.rate = 1.0; u.pitch = 1;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0 && !pageSnippet) || status !== "idle") return;
    if (rateLimitUntil && Date.now() < rateLimitUntil) return;
    setError(null);

    const userMsg: Msg = {
      id: crypto.randomUUID(), role: "user",
      content: trimmed || (attachments.length ? "Giúp mình phân tích ảnh này nhé." : "Giúp mình xem nội dung trang này."),
      images: attachments.length ? attachments.map((a) => ({ dataUrl: a.dataUrl, label: a.label })) : undefined,
      pageText: pageSnippet || undefined,
    };
    const assistantId = crypto.randomUUID();
    const newMsgs = [...messages, userMsg];
    setMessages([...newMsgs, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setPageSnippet(null);
    setStatus("loading");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMsgs.map((m) => ({
            role: m.role, content: m.content,
            images: m.images?.map((i) => i.dataUrl),
            pageText: m.pageText,
          })),
          context: ctx,
        }),
        signal: ac.signal,
      });

      if (res.status === 429) {
        const retry = parseInt(res.headers.get("Retry-After") || "60", 10);
        setRateLimitUntil(Date.now() + retry * 1000);
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Bạn đã hỏi quá nhanh. Thử lại sau ${retry}s.`);
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Lỗi ${res.status}`);
      }
      if (!res.body) throw new Error("Không nhận được phản hồi");

      setStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: acc } : m));
            }
          } catch {/* skip */}
        }
      }
      setStatus("idle");
    } catch (e: any) {
      if (e.name === "AbortError") { setStatus("idle"); return; }
      const msg = e.message || "Có lỗi xảy ra";
      setError(msg);
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `_${msg}_` } : m));
      setStatus("idle");
    } finally { abortRef.current = null; }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const reset = () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setMessages([]); setAttachments([]); setPageSnippet(null); setError(null); setStatus("idle");
  };

  const quickAction = (prompt: string) => send(prompt);

  const suggestions = getSuggestedPrompts(ctx);
  const hasContext = attachments.length > 0 || !!pageSnippet;
  const rlSec = rateLimitUntil ? Math.max(0, Math.ceil((rateLimitUntil - now) / 1000)) : 0;
  const rlActive = rlSec > 0;
  const isBusy = status !== "idle";
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant" && m.content && !m.content.startsWith("_"))?.id;

  return (
    <>
      <div
        className={cn("fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
      />
      <aside
        data-coach-panel
        className={cn(
          "fixed bottom-0 right-0 z-50 flex flex-col bg-background border-l border-t border-primary/20 shadow-2xl shadow-primary/20",
          "transition-transform duration-300 ease-out",
          "w-full md:w-[460px] h-[100dvh] md:h-[660px] md:max-h-[85vh] md:bottom-24 md:right-6 md:rounded-2xl md:border",
          open ? "translate-y-0 md:translate-y-0" : "translate-y-full md:translate-y-[calc(100%+6rem)]",
        )}
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-transparent md:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/40">
              <Bot className="w-5 h-5 text-primary-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Coach Kỳ Tích</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {ctx.exam?.questionText ? `Đang xem câu ${(ctx.exam.questionIndex ?? 0) + 1}` : "AI luyện thi Aptis"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={reset} title="Cuộc trò chuyện mới">
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-2">
              <div className="text-center space-y-2">
                <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center mb-2">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <h4 className="font-bold">Xin chào! 👋</h4>
                <p className="text-sm text-muted-foreground px-4">
                  Mình là Coach Kỳ Tích. Hỏi mình bất kỳ điều gì, hoặc <b>đính kèm ảnh / chụp màn hình</b> để mình hướng dẫn từng bước.
                </p>
                {ctx.dashboard?.weakestSkill && (
                  <p className="text-xs text-primary/80 px-4">
                    💡 Mình thấy bạn đang yếu <b>{ctx.dashboard.weakestSkill}</b> ({ctx.dashboard.accuracyBySkill?.[ctx.dashboard.weakestSkill]}%). Hỏi mình lộ trình cải thiện nhé!
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Gợi ý câu hỏi</p>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className="max-w-[85%] space-y-1">
                  <div className={cn("rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted/60 rounded-bl-sm")}>
                    {m.images && m.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {m.images.map((img, i) => (
                          <img key={i} src={img.dataUrl} alt={img.label} className="rounded-lg border border-border max-h-40 object-cover w-full" />
                        ))}
                      </div>
                    )}
                    {m.pageText && (
                      <div className="mb-2 text-[11px] opacity-80 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Đã đính kèm nội dung trang ({m.pageText.length} ký tự)
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      m.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-pre:my-2 prose-code:text-primary">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Đang suy nghĩ...</span>
                        </div>
                      )
                    ) : (
                      m.content && <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>

                  {/* Quick actions on the latest finished assistant msg */}
                  {m.role === "assistant" && m.content && !m.content.startsWith("_") && m.id === lastAssistantId && status === "idle" && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <button onClick={() => speak(m.id, m.content)}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                        {speakingId === m.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        {speakingId === m.id ? "Dừng đọc" : "Nghe"}
                      </button>
                      <button onClick={() => quickAction("Giải thích đơn giản hơn cho người mất gốc.")}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                        <Lightbulb className="w-3 h-3" /> Đơn giản hơn
                      </button>
                      <button onClick={() => quickAction("Cho mình thêm 2 ví dụ khác để mình hiểu hơn.")}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                        <RefreshCw className="w-3 h-3" /> Ví dụ khác
                      </button>
                      <button onClick={() => quickAction("Dịch toàn bộ câu trả lời vừa rồi sang tiếng Việt thuần.")}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                        <Languages className="w-3 h-3" /> Dịch tiếng Việt
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error && !rlActive && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-t border-destructive/20">{error}</div>
        )}
        {rlActive && (
          <div className="px-4 py-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs border-t border-amber-500/30 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Đang chờ giới hạn AI… thử lại sau <b>{rlSec}s</b>.
          </div>
        )}

        {hasContext && (
          <div className="px-3 pt-2 flex flex-wrap gap-2 border-t border-border">
            {attachments.map((a) => (
              <div key={a.id} className="relative group">
                <img src={a.dataUrl} alt={a.label} className="w-14 h-14 object-cover rounded-md border border-border" />
                <button onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pageSnippet && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs border border-primary/30">
                <FileText className="w-3 h-3" /> Nội dung trang ({pageSnippet.length})
                <button onClick={() => setPageSnippet(null)}><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border p-3 md:rounded-b-2xl bg-background space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                for (const f of files) await addImageFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }} />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
              onClick={() => fileRef.current?.click()} disabled={isBusy}>
              <Paperclip className="w-3.5 h-3.5" /> Ảnh
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
              onClick={captureScreen} disabled={isBusy || capturing}>
              {capturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Monitor className="w-3.5 h-3.5" />}
              Chụp màn hình
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
              onClick={grabPageText} disabled={isBusy}>
              <FileText className="w-3.5 h-3.5" /> Trích nội dung trang
            </Button>
          </div>

          <div className="flex items-end gap-2 rounded-xl border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-muted/30 px-3 py-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={
                rlActive ? `Đợi ${rlSec}s rồi thử lại...` :
                hasContext ? "Hỏi Coach về phần đang đính kèm..." :
                ctx.exam?.questionText ? "Hỏi về câu đang làm..." :
                ctx.skill ? `Hỏi về ${ctx.skill}...` :
                "Hỏi Coach hoặc đính kèm ảnh để được hướng dẫn..."
              }
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-32"
              style={{ minHeight: "20px" }} disabled={isBusy || rlActive} />
            {isBusy ? (
              <Button size="icon" variant="destructive" className="h-8 w-8 shrink-0 rounded-lg" onClick={stop} title="Dừng">
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={() => send(input)}
                disabled={(!input.trim() && !hasContext) || rlActive}>
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            AI có thể nhầm. Hãy kiểm tra lại thông tin quan trọng.
          </p>
        </div>
      </aside>
    </>
  );
}

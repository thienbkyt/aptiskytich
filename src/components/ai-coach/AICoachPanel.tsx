import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCoachContext, getSuggestedPrompts } from "@/hooks/useCoachContext";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;

export default function AICoachPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ctx = useCoachContext();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming">("idle");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status !== "idle") return;
    setError(null);
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();
    const newMsgs = [...messages, userMsg];
    setMessages([...newMsgs, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
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
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          context: ctx,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Lỗi ${res.status}`);
      }
      if (!res.body) throw new Error("Không nhận được phản hồi");

      setStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

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
      if (e.name === "AbortError") {
        setStatus("idle");
        return;
      }
      const msg = e.message || "Có lỗi xảy ra";
      setError(msg);
      setMessages((prev) => prev.map((m) => m.id === assistantId
        ? { ...m, content: `_${msg}_` }
        : m));
      setStatus("idle");
    } finally {
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus("idle");
  };

  const suggestions = getSuggestedPrompts(ctx);

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed bottom-0 right-0 z-50 flex flex-col bg-background border-l border-t border-primary/20 shadow-2xl shadow-primary/20",
          "transition-transform duration-300 ease-out",
          "w-full md:w-[440px] h-[100dvh] md:h-[640px] md:max-h-[85vh] md:bottom-24 md:right-6 md:rounded-2xl md:border",
          open ? "translate-y-0 md:translate-y-0" : "translate-y-full md:translate-y-[calc(100%+6rem)]",
        )}
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-transparent md:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/40">
              <Bot className="w-5 h-5 text-primary-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Coach Kỳ Tích</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI luyện thi Aptis
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-2">
              <div className="text-center space-y-2">
                <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center mb-2">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <h4 className="font-bold">Xin chào! 👋</h4>
                <p className="text-sm text-muted-foreground px-4">
                  Mình là Coach Kỳ Tích. Hỏi mình bất kỳ điều gì về Aptis, lộ trình học hay câu hỏi bạn đang làm nhé!
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Gợi ý câu hỏi
                </p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted/60 rounded-bl-sm",
                  )}
                >
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
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-t border-destructive/20">
            {error}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border p-3 md:rounded-b-2xl bg-background">
          <div className="flex items-end gap-2 rounded-xl border border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-muted/30 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ctx.skill ? `Hỏi về ${ctx.skill}...` : "Hỏi Coach bất kỳ điều gì..."}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-32"
              style={{ minHeight: "20px" }}
              disabled={status !== "idle"}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={() => send(input)}
              disabled={!input.trim() || status !== "idle"}
            >
              {status !== "idle" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            AI có thể nhầm. Hãy kiểm tra lại thông tin quan trọng.
          </p>
        </div>
      </aside>
    </>
  );
}

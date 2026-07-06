import { useState } from "react";
import { Copy, Check, Sparkles, Plug } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

const Connect = () => {
  usePageMeta({
    title: "Kết nối Aptis Kỳ Tích với AI Assistant",
    description:
      "Hướng dẫn kết nối ChatGPT hoặc Claude với Aptis Kỳ Tích để tra từ vựng và duyệt đề luyện thi ngay trong trợ lý AI.",
    path: "/connect",
  });

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      toast({ title: "Đã copy URL" });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Không copy được", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b border-border">
        <div className="section-container section-padding">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-primary/15 text-primary">
              <Plug className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Agent Integrations
            </span>
          </div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl mb-3">
            Kết nối Aptis Kỳ Tích với AI Assistant
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Thêm Aptis Kỳ Tích vào ChatGPT hoặc Claude để trợ lý có thể tra từ vựng và
            duyệt đề Aptis đã công bố trực tiếp trong cuộc trò chuyện.
          </p>
        </div>
      </section>

      <main className="flex-1 section-container section-padding space-y-10">
        {/* URL block */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">Địa chỉ MCP server</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Dán URL này vào trình cấu hình connector của ChatGPT hoặc Claude.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 px-4 py-3 rounded-lg bg-muted text-sm font-mono break-all">
              {mcpUrl}
            </code>
            <Button onClick={copy} className="sm:w-auto">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Đã copy
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> Copy URL
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ChatGPT */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-heading font-semibold text-xl mb-4">Kết nối với ChatGPT</h2>
          <ol className="space-y-3 text-sm leading-relaxed list-decimal list-inside marker:text-primary marker:font-semibold">
            <li>
              Mở{" "}
              <a
                href="https://chatgpt.com/#settings/Connectors/Advanced"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                chatgpt.com → Settings → Connectors → Advanced
              </a>{" "}
              và bật <strong>Developer mode</strong> (đọc kỹ cảnh báo rủi ro của ChatGPT).
            </li>
            <li>
              Trong khung chat, mở menu <strong>“+”</strong> và bật <strong>Developer mode</strong>.
            </li>
            <li>
              Chọn <strong>Add sources</strong>, rồi bấm <strong>Connect more</strong>.
            </li>
            <li>
              Đặt tên connector (ví dụ <em>Aptis Kỳ Tích</em>) và dán URL MCP ở trên vào.
            </li>
            <li>Hỏi ChatGPT về Aptis — trợ lý sẽ tự gọi tool khi cần.</li>
          </ol>
        </div>

        {/* Claude */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-heading font-semibold text-xl mb-4">Kết nối với Claude</h2>
          <ol className="space-y-3 text-sm leading-relaxed list-decimal list-inside marker:text-primary marker:font-semibold">
            <li>
              Mở{" "}
              <a
                href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                claude.ai → Connectors → Add custom connector
              </a>
              .
            </li>
            <li>
              Đặt tên connector (ví dụ <em>Aptis Kỳ Tích</em>) và dán URL MCP ở trên vào.
            </li>
            <li>
              Bật connector trong khung chat, rồi hỏi Claude về Aptis — trợ lý sẽ tự gọi
              tool khi cần.
            </li>
          </ol>
        </div>

        <p className="text-sm text-muted-foreground">
          Trợ lý AI khi đã kết nối có thể tra từ vựng Aptis và duyệt các đề luyện thi đã
          được Aptis Kỳ Tích công bố.
        </p>
      </main>

      <Footer />
    </div>
  );
};

export default Connect;

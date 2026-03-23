import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft,
  Volume2,
  Loader2,
  BookOpen,
} from "lucide-react";

function speak(text: string, lang: "en" | "vi") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-US" : "vi-VN";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example_en: string;
  example_vi: string;
  word_family: any[];
  status: string;
}

const VocabListDetail = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listName, setListName] = useState("");
  const [listDesc, setListDesc] = useState("");
  const [words, setWords] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !listId) return;

    const fetchData = async () => {
      // Fetch list info
      const { data: listData } = await supabase
        .from("vocab_lists")
        .select("*")
        .eq("id", listId)
        .eq("user_id", user.id)
        .single();

      if (listData) {
        setListName((listData as any).name);
        setListDesc((listData as any).description || "");
      }

      // Fetch words
      const { data: wordsData } = await supabase
        .from("vocab_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("vocab_set_id", listId)
        .order("created_at", { ascending: true });

      if (wordsData) setWords(wordsData as any);
      setLoading(false);
    };

    fetchData();
  }, [user, listId]);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <div className="border-b border-border bg-primary/5 dark:bg-primary/10">
          <div className="section-container py-5 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/vocabulary")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-xl text-foreground truncate">
                {listName || "Đang tải…"}
              </h1>
              {listDesc && (
                <p className="text-sm text-muted-foreground truncate">{listDesc}</p>
              )}
            </div>
            <Badge variant="outline" className="shrink-0">
              {words.length} từ
            </Badge>
          </div>
        </div>

        <div className="section-container py-8 max-w-3xl mx-auto">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : words.length === 0 ? (
            <Card className="border border-dashed border-primary/30">
              <CardContent className="py-14 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary/40" />
                <p className="font-medium text-foreground mb-1">Chưa có từ nào</p>
                <p className="text-sm">
                  Tra từ khi làm bài và thêm vào danh sách này để bắt đầu học!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {words.map((item, index) => (
                <Card
                  key={item.id}
                  className="border border-border overflow-hidden hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-0">
                    {/* Row 1 — Word, phonetic, meaning (RED accent) */}
                    <div className="px-5 py-4 border-b border-border bg-primary/5 dark:bg-primary/10">
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-heading font-bold text-lg shrink-0">
                          {index + 1}.
                        </span>
                        <h3 className="text-primary font-heading font-bold text-lg">
                          {item.word}
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => speak(item.word, "en")}
                        >
                          <Volume2 className="w-4 h-4 text-primary" />
                        </Button>
                        {item.phonetic && (
                          <span className="text-sm text-muted-foreground">
                            {item.phonetic}
                          </span>
                        )}
                        <span className="text-sm font-medium text-foreground ml-auto">
                          {item.meaning || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Row 2 — Example */}
                    {(item.example_en || item.example_vi) && (
                      <div className="px-5 py-3 border-b border-border">
                        {item.example_en && (
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-foreground italic flex-1">
                              "{item.example_en}"
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => speak(item.example_en, "en")}
                            >
                              <Volume2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {item.example_vi && (
                          <div className="flex items-start gap-2 mt-1">
                            <p className="text-xs text-muted-foreground flex-1">
                              {item.example_vi}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => speak(item.example_vi, "vi")}
                            >
                              <Volume2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 3 — Word family */}
                    {item.word_family &&
                      Array.isArray(item.word_family) &&
                      item.word_family.length > 0 && (
                        <div className="px-5 py-3">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">
                            Word Family
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.word_family.map((wf: any, i: number) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs font-normal cursor-pointer hover:bg-accent"
                                onClick={() =>
                                  speak(
                                    typeof wf === "string"
                                      ? wf.split(" ")[0]
                                      : wf.word || wf,
                                    "en"
                                  )
                                }
                              >
                                <Volume2 className="w-2.5 h-2.5 mr-1 opacity-50" />
                                {typeof wf === "string"
                                  ? wf
                                  : `${wf.word} (${wf.partOfSpeech})`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VocabListDetail;

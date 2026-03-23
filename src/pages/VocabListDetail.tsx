import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
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
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Headphones,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

/* ─── TTS helpers ─── */
function speak(text: string, lang: "en" | "vi") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-US" : "vi-VN";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function speakAsync(text: string, lang: "en" | "vi", rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "en" ? "en-US" : "vi-VN";
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/* ══════════════════ Component ══════════════════ */
const VocabListDetail = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listName, setListName] = useState("");
  const [listDesc, setListDesc] = useState("");
  const [words, setWords] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Playlist state ── */
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!user || !listId) return;

    const fetchData = async () => {
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

  /* ── 3R Playlist logic ── */
  const playFrom = useCallback(async (startIndex: number) => {
    abortRef.current = false;
    setIsPlaying(true);

    for (let i = startIndex; i < words.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);
      const item = words[i];

      // [Number]
      await speakAsync(`Number ${i + 1}`, "en", 1);
      if (abortRef.current) break;

      // [Word]
      await speakAsync(item.word, "en");
      if (abortRef.current) break;

      // [Vietnamese meaning]
      if (item.meaning) {
        await speakAsync(item.meaning, "vi");
        if (abortRef.current) break;
      }

      // [Example sentence — 1st time]
      if (item.example_en) {
        await speakAsync(item.example_en, "en");
        if (abortRef.current) break;

        // [Pause 2 seconds]
        await delay(2000);
        if (abortRef.current) break;

        // [Example sentence — 2nd time]
        await speakAsync(item.example_en, "en", 0.8);
        if (abortRef.current) break;
      }

      // Brief gap between words
      await delay(1000);
    }

    setIsPlaying(false);
    setCurrentIndex(-1);
  }, [words]);

  const stopPlayback = useCallback(() => {
    abortRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  const skipNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= words.length - 1) return;
    window.speechSynthesis.cancel();
    abortRef.current = true;
    setTimeout(() => playFrom(currentIndex + 1), 100);
  }, [currentIndex, words.length, playFrom]);

  const skipPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    window.speechSynthesis.cancel();
    abortRef.current = true;
    setTimeout(() => playFrom(currentIndex - 1), 100);
  }, [currentIndex, playFrom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  const progress = words.length > 0 && currentIndex >= 0
    ? ((currentIndex + 1) / words.length) * 100
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16 pb-28">
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
                  className={`border overflow-hidden transition-shadow ${
                    currentIndex === index
                      ? "border-primary shadow-lg ring-2 ring-primary/20"
                      : "border-border hover:shadow-md"
                  }`}
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

      {/* ═══ Sticky Audio Player ═══ */}
      {words.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-popover/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_-4px_hsl(0_0%_0%/0.15)]">
          <Progress value={progress} className="h-1 rounded-none" />
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Now playing info */}
            <div className="flex-1 min-w-0">
              {currentIndex >= 0 ? (
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {currentIndex + 1}. {words[currentIndex]?.word}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {words[currentIndex]?.meaning}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Audio 3R — {words.length} từ
                  </p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={skipPrev}
                disabled={!isPlaying || currentIndex <= 0}
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => {
                  if (isPlaying) {
                    stopPlayback();
                  } else {
                    playFrom(currentIndex >= 0 ? currentIndex : 0);
                  }
                }}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={skipNext}
                disabled={!isPlaying || currentIndex >= words.length - 1}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Word counter */}
            <div className="text-xs text-muted-foreground w-16 text-right shrink-0">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${words.length}` : ""}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default VocabListDetail;

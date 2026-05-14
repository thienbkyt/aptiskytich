import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
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
  GripVertical,
  Trash2,
  Download,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { speakWithTTS, speakAsync as speakAsyncTTS, stopTTS } from "@/lib/tts";

/* ─── TTS helpers (Google Cloud TTS via edge function) ─── */
function speak(text: string, lang: "en" | "vi") {
  void speakWithTTS(text, lang);
}

function speakAsync(text: string, lang: "en" | "vi", _rate = 0.9): Promise<void> {
  return speakAsyncTTS(text, lang);
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
  sort_order: number;
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
  const playSessionRef = useRef(0); // increments on every (re)start to invalidate older sessions

  /* ── Delete confirmation state ── */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; word: string } | null>(null);

  /* ── Download state ── */
  const [downloading, setDownloading] = useState(false);

  /* ── Add word state ── */
  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);

  /* ── Drag state ── */
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (wordsData) setWords(wordsData as any);
      setLoading(false);
    };

    fetchData();
  }, [user, listId]);

  /* ── Delete word ── */
  const deleteWord = useCallback(async (wordId: string) => {
    setWords((prev) => prev.filter((w) => w.id !== wordId));
    const { error } = await supabase.from("vocab_items").delete().eq("id", wordId);
    if (error) {
      toast({ title: "Lỗi khi xóa từ", variant: "destructive" });
    } else {
      toast({ title: "Đã xóa từ khỏi danh sách" });
    }
  }, []);

  /* ── Drag & Drop ── */
  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(async (dropIndex: number) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      dragIndexRef.current = null;
      return;
    }

    const newWords = [...words];
    const [moved] = newWords.splice(dragIndex, 1);
    newWords.splice(dropIndex, 0, moved);
    setWords(newWords);
    setDragOverIndex(null);
    dragIndexRef.current = null;

    // Persist new order
    const updates = newWords.map((w, i) => ({
      id: w.id,
      sort_order: i,
      // required fields for upsert
      user_id: w.id, // placeholder, won't change
      word: w.word,
      vocab_set_id: listId!,
    }));

    // Update each item's sort_order
    await Promise.all(
      newWords.map((w, i) =>
        supabase
          .from("vocab_items")
          .update({ sort_order: i } as any)
          .eq("id", w.id)
      )
    );
  }, [words, listId]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  }, []);

  /* ── Ám ảnh Playlist logic ── */
  const playFrom = useCallback(async (startIndex: number) => {
    // Hard-stop any previous playback and bump the session id.
    stopTTS();
    abortRef.current = false;
    const session = ++playSessionRef.current;
    setIsPlaying(true);

    const isStale = () => abortRef.current || session !== playSessionRef.current;

    for (let i = startIndex; i < words.length; i++) {
      if (isStale()) break;
      setCurrentIndex(i);
      const item = words[i];

      await speakAsync(`Number ${i + 1}`, "en");
      if (isStale()) break;

      // Read English word 3 times in a row
      for (let r = 0; r < 3; r++) {
        await speakAsync(item.word, "en");
        if (isStale()) break;
      }
      if (isStale()) break;

      // Read Vietnamese meaning 3 times in a row
      if (item.meaning) {
        for (let r = 0; r < 3; r++) {
          await speakAsync(item.meaning, "vi");
          if (isStale()) break;
        }
        if (isStale()) break;
      }

      // Read English example 3 times in a row
      if (item.example_en) {
        for (let r = 0; r < 3; r++) {
          await speakAsync(item.example_en, "en");
          if (isStale()) break;
        }
        if (isStale()) break;
      }

      await delay(1000);
    }

    // Only the most recent session is allowed to clear UI state.
    if (session === playSessionRef.current) {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  }, [words]);

  const stopPlayback = useCallback(() => {
    abortRef.current = true;
    playSessionRef.current++; // invalidate any in-flight loop
    stopTTS();
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  const skipNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= words.length - 1) return;
    abortRef.current = true;
    playSessionRef.current++;
    stopTTS();
    const next = currentIndex + 1;
    setTimeout(() => playFrom(next), 120);
  }, [currentIndex, words.length, playFrom]);

  const skipPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    abortRef.current = true;
    playSessionRef.current++;
    stopTTS();
    const prev = currentIndex - 1;
    setTimeout(() => playFrom(prev), 120);
  }, [currentIndex, playFrom]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      playSessionRef.current++;
      stopTTS();
    };
  }, []);

  /* ── Download bundled Ám ảnh audio ── */
  const downloadAudio = useCallback(async () => {
    if (!words.length || downloading) return;
    setDownloading(true);
    try {
      const segments: Array<{ text: string; lang: "en" | "vi"; rate?: number; pauseMs?: number }> = [];
      words.forEach((item, i) => {
        segments.push({ text: `Number ${i + 1}.`, lang: "en", pauseMs: 300 });
        segments.push({ text: item.word, lang: "en", pauseMs: 500 });
        if (item.meaning) segments.push({ text: item.meaning, lang: "vi", pauseMs: 500 });
        if (item.example_en) {
          segments.push({ text: item.example_en, lang: "en", pauseMs: 1500 });
          segments.push({ text: item.example_en, lang: "en", rate: 0.8, pauseMs: 1000 });
        }
      });

      const { data, error } = await supabase.functions.invoke("tts-bundle", {
        body: {
          segments,
          filename: (listName || "audio-3r").toLowerCase().replace(/\s+/g, "-"),
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || "Không lấy được file audio");
      }

      // Trigger download
      const res = await fetch(data.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${(listName || "audio-3r").replace(/[^a-zA-Z0-9_-]+/g, "-")}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      toast({ title: "Đã tải xuống audio Ám ảnh" });
    } catch (e: any) {
      console.error("[downloadAudio]", e);
      toast({
        title: "Không tải được audio",
        description: e?.message || "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }, [words, listName, downloading]);

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
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`border overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
                    currentIndex === index
                      ? "border-primary shadow-lg ring-2 ring-primary/20"
                      : dragOverIndex === index
                      ? "border-primary/50 shadow-md ring-2 ring-primary/10 scale-[1.01]"
                      : "border-border hover:shadow-md"
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Row 1 — Word, phonetic, meaning (RED accent) */}
                    <div className="px-5 py-4 border-b border-border bg-primary/5 dark:bg-primary/10">
                      <div className="flex items-center gap-2">
                        {/* Drag handle */}
                        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
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
                        <span className="text-sm font-medium text-foreground ml-auto mr-1">
                          {item.meaning || "—"}
                        </span>
                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: item.id, word: item.word });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
                    Audio Ám ảnh — {words.length} từ
                  </p>
                </div>
              )}
            </div>

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

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={downloadAudio}
              disabled={downloading || words.length === 0}
              title="Tải xuống audio Ám ảnh (MP3)"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>

            <div className="text-xs text-muted-foreground w-16 text-right shrink-0">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${words.length}` : ""}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation Dialog ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa từ "{deleteTarget?.word}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Từ này sẽ bị xóa khỏi danh sách. Bạn không thể hoàn tác thao tác này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteWord(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default VocabListDetail;

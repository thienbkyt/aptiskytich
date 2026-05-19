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
  Pencil,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import ExcelJS from "exceljs";
import { createAndDownloadExcel, readExcelFile } from "@/lib/excelUtils";

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

  /* ── Add word state (2-step flow) ── */
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addInput, setAddInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  /* ── Edit word state ── */
  const [editTarget, setEditTarget] = useState<VocabItem | null>(null);
  const [editForm, setEditForm] = useState({ word: "", meaning: "", example_en: "", example_vi: "" });
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = useCallback((item: VocabItem) => {
    setEditTarget(item);
    setEditForm({
      word: item.word || "",
      meaning: item.meaning || "",
      example_en: item.example_en || "",
      example_vi: item.example_vi || "",
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    const payload = {
      word: editForm.word.trim(),
      meaning: editForm.meaning.trim(),
      example_en: editForm.example_en.trim(),
      example_vi: editForm.example_vi.trim(),
    };
    if (!payload.word) {
      toast({ title: "Từ vựng không được để trống", variant: "destructive" });
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("vocab_items")
      .update(payload as any)
      .eq("id", editTarget.id);
    setEditSaving(false);
    if (error) {
      toast({ title: "Không lưu được", description: error.message, variant: "destructive" });
      return;
    }
    setWords((prev) => prev.map((w) => (w.id === editTarget.id ? { ...w, ...payload } : w)));
    setEditTarget(null);
    toast({ title: "✓ Đã cập nhật từ vựng" });
  }, [editTarget, editForm]);


  const resetAddDialog = useCallback(() => {
    setAddStep(1);
    setAddInput("");
    setSuggestions([]);
    setSuggestLoading(false);
    setPreviewLoading(false);
    setPreviewData(null);
  }, []);

  /* ── Debounced suggestions from datamuse ── */
  useEffect(() => {
    if (!addOpen || addStep !== 1) return;
    const q = addInput.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.map((x: any) => x.word) : []);
      } catch (e) {
        if ((e as any)?.name !== "AbortError") setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [addInput, addOpen, addStep]);

  /* ── Lookup preview (step 1 → step 2) ── */
  const lookupPreview = useCallback(async (word: string) => {
    const w = word.trim();
    if (!w) return;
    setAddStep(2);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const { data, error } = await supabase.functions.invoke("dictionary-lookup", {
        body: { word: w },
      });
      if (error || !data || (data as any).error) {
        throw new Error((data as any)?.error || error?.message || "Lookup failed");
      }
      setPreviewData({ ...(data as any), _query: w });
    } catch (e: any) {
      toast({
        title: "Không tra được từ này",
        description: e?.message || "Đã có lỗi xảy ra",
        variant: "destructive",
      });
      setAddStep(1);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

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

  /* ── Confirm add (uses previewData from step 2) ── */
  const handleAddWord = useCallback(async () => {
    if (!previewData || !user || !listId) return;
    setAdding(true);
    try {
      const d: any = previewData;
      const w = d._query || d.word || "";
      const meaning = d.meanings?.[0]?.definition_vi || "";
      const example_en = d.examples?.[0]?.en || "";
      const example_vi = d.examples?.[0]?.vi || "";
      const word_family = Array.isArray(d.wordFamily) ? d.wordFamily : [];
      const phonetic = d.phonetic || "";

      const { data: inserted, error: insErr } = await supabase
        .from("vocab_items")
        .insert({
          user_id: user.id,
          vocab_set_id: listId,
          word: d.word || w,
          phonetic,
          meaning,
          example_en,
          example_vi,
          word_family,
          sort_order: words.length,
          status: "new",
        })
        .select()
        .single();

      if (insErr || !inserted) throw new Error(insErr?.message || "Insert failed");

      setWords((prev) => [...prev, inserted as any]);
      setAddOpen(false);
      resetAddDialog();
      toast({ title: `✓ Đã thêm ${(inserted as any).word}` });
    } catch (e: any) {
      toast({
        title: "Không thể thêm từ",
        description: e?.message || "Đã có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }, [previewData, user, listId, words.length, resetAddDialog]);
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
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Thêm từ vựng
            </Button>
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
                        {/* Edit button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
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

      {/* Edit word dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (editSaving) return;
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa từ vựng</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Từ vựng</label>
              <Input
                value={editForm.word}
                onChange={(e) => setEditForm((f) => ({ ...f, word: e.target.value }))}
                disabled={editSaving}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nghĩa tiếng Việt</label>
              <Input
                value={editForm.meaning}
                onChange={(e) => setEditForm((f) => ({ ...f, meaning: e.target.value }))}
                disabled={editSaving}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Câu ví dụ tiếng Anh</label>
              <Input
                value={editForm.example_en}
                onChange={(e) => setEditForm((f) => ({ ...f, example_en: e.target.value }))}
                disabled={editSaving}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Câu ví dụ tiếng Việt</label>
              <Input
                value={editForm.example_vi}
                onChange={(e) => setEditForm((f) => ({ ...f, example_vi: e.target.value }))}
                disabled={editSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editSaving}
            >
              Huỷ
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add word dialog — 2-step flow */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (adding || previewLoading) return;
          setAddOpen(open);
          if (!open) resetAddDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addStep === 1 ? "Tìm từ vựng" : "Xem trước & xác nhận"}
            </DialogTitle>
          </DialogHeader>

          {addStep === 1 ? (
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="Gõ từ tiếng Anh..."
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addInput.trim()) {
                    e.preventDefault();
                    lookupPreview(addInput.trim());
                  }
                }}
              />
              <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                {suggestLoading && (
                  <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang tìm...
                  </div>
                )}
                {!suggestLoading && addInput.trim() && suggestions.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    Không có gợi ý. Nhấn Enter để tra trực tiếp "{addInput.trim()}".
                  </div>
                )}
                {!suggestLoading && !addInput.trim() && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    Bắt đầu gõ để xem gợi ý từ.
                  </div>
                )}
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 border-b border-border last:border-b-0 transition-colors"
                    onClick={() => lookupPreview(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {previewLoading || !previewData ? (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Đang tra từ...</span>
                </div>
              ) : (
                <Card className="border border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-primary font-heading font-bold text-xl">
                        {previewData.word || previewData._query}
                      </h3>
                      {previewData.phonetic && (
                        <span className="text-sm text-muted-foreground">
                          {previewData.phonetic}
                        </span>
                      )}
                    </div>
                    {previewData.meanings?.[0]?.definition_vi && (
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Nghĩa:</span>{" "}
                        {previewData.meanings[0].definition_vi}
                      </p>
                    )}
                    {previewData.examples?.[0]?.en && (
                      <div className="text-sm space-y-1 border-l-2 border-primary/40 pl-3">
                        <p className="italic text-foreground">
                          {previewData.examples[0].en}
                        </p>
                        {previewData.examples[0].vi && (
                          <p className="text-muted-foreground">
                            {previewData.examples[0].vi}
                          </p>
                        )}
                      </div>
                    )}
                    {Array.isArray(previewData.wordFamily) &&
                      previewData.wordFamily.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {previewData.wordFamily.map((wf: any, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs border-primary/30"
                            >
                              {wf.word}
                              {wf.partOfSpeech && (
                                <span className="ml-1 text-muted-foreground">
                                  ({wf.partOfSpeech})
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            {addStep === 2 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddStep(1);
                    setPreviewData(null);
                  }}
                  disabled={adding || previewLoading}
                >
                  ← Chọn lại
                </Button>
                <Button
                  onClick={handleAddWord}
                  disabled={!previewData || adding || previewLoading}
                >
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Thêm vào danh sách
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default VocabListDetail;

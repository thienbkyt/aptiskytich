import { useParams, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSystemVocabSets, useSystemVocabWords } from "@/hooks/useSystemVocabSets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  Check,
  BookOpen,
  ChevronLeft,
  Loader2,
  Layers,
  List,
  Brain,
  Shuffle,
  Plus,
} from "lucide-react";
import FlashcardMode from "@/components/vocab/FlashcardMode";
import QuizMode from "@/components/vocab/QuizMode";
import MatchingMode from "@/components/vocab/MatchingMode";
import { speakWithTTS } from "@/lib/tts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StudyMode = "browse" | "flashcard" | "quiz" | "matching";

function speak(text: string, lang: "en" | "vi") {
  void speakWithTTS(text, lang);
}

const VocabStudy = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get("mode") as StudyMode) || "browse";
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [userLists, setUserLists] = useState<{ id: string; name: string }[]>([]);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [mode, setMode] = useState<StudyMode>(
    ["browse", "flashcard", "quiz", "matching"].includes(initialMode) ? initialMode : "browse",
  );

  const { data: sets = [] } = useSystemVocabSets();
  const { data: words = [], isLoading: wordsLoading } = useSystemVocabWords(id);
  const set = sets.find((s) => s.id === id);

  useEffect(() => {
    if (!user || !id) {
      setLoadingStatus(false);
      return;
    }
    (async () => {
      const [learnedRes, listsRes] = await Promise.all([
        supabase
          .from("vocab_items")
          .select("word")
          .eq("user_id", user.id)
          .eq("vocab_set_id", id)
          .eq("status", "learned"),
        supabase
          .from("vocab_lists")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);
      if (learnedRes.data) setLearnedWords(new Set(learnedRes.data.map((d: any) => d.word)));
      if (listsRes.data) {
        setUserLists(listsRes.data as { id: string; name: string }[]);
        const listIds = (listsRes.data as { id: string }[]).map((l) => l.id);
        if (listIds.length > 0) {
          const { data: savedRows } = await supabase
            .from("vocab_items")
            .select("word")
            .eq("user_id", user.id)
            .in("vocab_set_id", listIds);
          if (savedRows) setSavedWords(new Set(savedRows.map((r: any) => r.word)));
        }
      }
      setLoadingStatus(false);
    })();
  }, [user, id]);

  const markLearned = useCallback(
    async (wordText: string) => {
      if (!user) {
        toast({ title: "Vui lòng đăng nhập để lưu tiến độ", variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("vocab_items").upsert(
        {
          user_id: user.id,
          word: wordText,
          vocab_set_id: id!,
          status: "learned",
          review_count: 1,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word,vocab_set_id" },
      );
      if (!error) {
        setLearnedWords((prev) => new Set(prev).add(wordText));
        toast({ title: `Đã đánh dấu "${wordText}" là đã thuộc ✓` });
      }
    },
    [user, id],
  );

  const saveToList = useCallback(
    async (
      w: { word: string; phonetic: string; meaning: string; example_en: string; example_vi: string; word_family: string[] },
      listId: string,
      listName: string,
    ) => {
      if (!user) return;
      setSavingWord(w.word);
      const { error } = await supabase.from("vocab_items").insert({
        user_id: user.id,
        vocab_set_id: listId,
        word: w.word,
        phonetic: w.phonetic ?? "",
        meaning: w.meaning ?? "",
        example_en: w.example_en ?? "",
        example_vi: w.example_vi ?? "",
        word_family: w.word_family ?? [],
        status: "new",
      });
      setSavingWord(null);
      if (error) {
        toast({ title: "Không thể lưu từ", description: error.message, variant: "destructive" });
        return;
      }
      setSavedWords((prev) => new Set(prev).add(w.word));
      toast({ title: `Đã lưu "${w.word}" vào ${listName}` });
    },
    [user],
  );

  const handleSaveSingleOrCreate = useCallback(
    async (w: { word: string; phonetic: string; meaning: string; example_en: string; example_vi: string; word_family: string[] }) => {
      if (!user) {
        toast({ title: "Vui lòng đăng nhập để lưu từ vựng", variant: "destructive" });
        return;
      }
      if (userLists.length === 0) {
        setSavingWord(w.word);
        const { data: created, error } = await supabase
          .from("vocab_lists")
          .insert({ user_id: user.id, name: "Kho từ của tôi" })
          .select("id, name")
          .single();
        setSavingWord(null);
        if (error || !created) {
          toast({ title: "Không thể tạo kho từ", description: error?.message, variant: "destructive" });
          return;
        }
        setUserLists([created as { id: string; name: string }]);
        await saveToList(w, created.id, created.name);
        return;
      }
      if (userLists.length === 1) {
        await saveToList(w, userLists[0].id, userLists[0].name);
      }
    },
    [user, userLists, saveToList],
  );

  if (wordsLoading || loadingStatus) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (words.length === 0) return <Navigate to="/vocabulary" replace />;

  const word = words[currentIndex];
  if (!word) return <Navigate to="/vocabulary" replace />;

  const total = words.length;
  const progressPct = ((currentIndex + 1) / total) * 100;
  const isLearned = learnedWords.has(word.word);

  const prev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const next = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="border-b border-border bg-card">
          <div className="section-container py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/vocabulary")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{set?.group_name ?? ""}</p>
              <h1 className="font-heading font-bold text-lg text-foreground truncate">{set?.title ?? "Bộ từ vựng"}</h1>
            </div>
            {mode === "browse" && (
              <Badge variant="outline" className="shrink-0">{currentIndex + 1} / {total}</Badge>
            )}
          </div>
          {mode === "browse" && (
            <div className="section-container pb-3">
              <Progress value={progressPct} className="h-2" />
            </div>
          )}
          {/* Mode tabs */}
          <div className="section-container pb-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setMode("browse")}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "browse"
                    ? "bg-[hsl(0,98%,40%)] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-4 h-4" /> Duyệt từ
              </button>
              <button
                onClick={() => setMode("flashcard")}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "flashcard"
                    ? "bg-[hsl(0,98%,40%)] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-4 h-4" /> Flashcard
              </button>
              <button
                onClick={() => setMode("quiz")}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "quiz"
                    ? "bg-[hsl(0,98%,40%)] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Brain className="w-4 h-4" /> Quiz
              </button>
              <button
                onClick={() => setMode("matching")}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === "matching"
                    ? "bg-[hsl(0,98%,40%)] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shuffle className="w-4 h-4" /> Matching
              </button>
            </div>
          </div>
        </div>

        {mode === "browse" ? (
          <div className="section-container py-8 max-w-2xl mx-auto">
            <Card className="border border-border overflow-hidden">
              <CardContent className="p-0">
                {/* Row 1 — Word, phonetic, meaning */}
                <div className="p-6 pb-4 border-b border-border bg-[hsl(170,50%,96%)] dark:bg-[hsl(170,25%,10%)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-3xl font-heading font-bold text-foreground">
                        {word.word} {word.word_type && <span className="text-xl font-normal text-muted-foreground">({word.word_type})</span>}
                      </h2>
                      <p className="text-muted-foreground text-sm mt-1">{word.phonetic}</p>
                    </div>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 mt-1" onClick={() => speak(word.word, "en")} title="Nghe phát âm">
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[hsl(170,55%,35%)] dark:text-[hsl(170,55%,55%)]">{word.meaning}</p>
                  <Button variant="ghost" size="sm" className="mt-1 text-xs gap-1 text-muted-foreground h-7 px-2" onClick={() => speak(word.meaning, "vi")}>
                    <Volume2 className="w-3 h-3" /> Nghe nghĩa
                  </Button>
                </div>

                {/* Row 2 — Example */}
                <div className="p-6 pb-4 border-b border-border">
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Ví dụ minh họa</p>
                  <div className="flex items-start gap-2">
                    <p className="text-foreground leading-relaxed flex-1 italic">"{word.example_en}"</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => speak(word.example_en, "en")} title="Nghe ví dụ">
                      <Volume2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 mt-2">
                    <p className="text-muted-foreground text-sm flex-1">{word.example_vi}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => speak(word.example_vi, "vi")} title="Nghe nghĩa">
                      <Volume2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Row 3 — Word family */}
                <div className="p-6">
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3">Word Family</p>
                  {word.word_family.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {word.word_family.map((wf: string) => (
                        <Badge key={wf} variant="secondary" className="text-sm font-normal cursor-pointer hover:bg-accent" onClick={() => speak(wf.split(" ")[0], "en")}>
                          <Volume2 className="w-3 h-3 mr-1.5 opacity-50" />{wf}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 gap-3">
              <Button variant="outline" onClick={prev} disabled={currentIndex === 0} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Trước
              </Button>
              <Button
                variant={isLearned ? "secondary" : "default"}
                onClick={() => markLearned(word.word)}
                disabled={isLearned}
                className={isLearned ? "" : "bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,34%)] text-white"}
              >
                {isLearned ? <><Check className="w-4 h-4 mr-1.5" /> Đã thuộc</> : <><BookOpen className="w-4 h-4 mr-1.5" /> Đánh dấu đã thuộc</>}
              </Button>
              <Button variant="outline" onClick={next} disabled={currentIndex === total - 1} className="gap-1.5">
                Tiếp <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Word dots */}
            <div className="flex justify-center flex-wrap gap-1.5 mt-6">
              {words.map((w, i) => (
                <button key={w.id} onClick={() => setCurrentIndex(i)} className={`w-3 h-3 rounded-full transition-all ${i === currentIndex ? "bg-[hsl(170,55%,40%)] scale-125" : learnedWords.has(w.word) ? "bg-[hsl(142,60%,50%)]" : "bg-muted-foreground/25"}`} title={w.word} />
              ))}
            </div>
          </div>
        ) : mode === "flashcard" ? (
          <div className="section-container py-8">
            <FlashcardMode
              words={words}
              learnedWords={learnedWords}
              onMarkLearned={markLearned}
              onBackToList={() => navigate("/vocabulary")}
            />
          </div>
        ) : mode === "quiz" ? (
          <div className="section-container py-8">
            <QuizMode
              words={words}
              onBackToList={() => navigate("/vocabulary")}
            />
          </div>
        ) : (
          <div className="section-container py-8">
            <MatchingMode
              words={words}
              onBackToList={() => navigate("/vocabulary")}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default VocabStudy;

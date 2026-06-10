import { useState, useEffect } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  BookOpen,
  Library,
  Brain,
  RotateCcw,
  GraduationCap,
  Layers,
  Eye,
  Play,
  Sparkles,
  FolderPlus,
  Loader2,
  Volume2,
  X,
} from "lucide-react";
import { useSystemVocabWords } from "@/hooks/useSystemVocabSets";
import { useSystemVocabSets } from "@/hooks/useSystemVocabSets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import FlashcardMode from "@/components/vocab/FlashcardMode";
import QuizMode from "@/components/vocab/QuizMode";
import MyMatchingMode from "@/components/vocab/MyMatchingMode";

/* ───── colour helpers ───── */
const TEAL = {
  badge: "bg-[hsl(170,60%,92%)] text-[hsl(170,60%,28%)] border-[hsl(170,60%,80%)]",
  badgeAdv: "bg-[hsl(150,50%,90%)] text-[hsl(150,50%,28%)] border-[hsl(150,50%,75%)]",
  tab: "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
};

const SkillPractice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const skill = location.pathname.replace("/", "");
  const [search, setSearch] = useState("");
  const [quickViewSetId, setQuickViewSetId] = useState<string | null>(null);

  /* ── My Vocab state ── */
  const [myLists, setMyLists] = useState<any[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, learned: 0, review: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  /* ── Flashcard fullscreen state (My Vocab) ── */
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [gameWords, setGameWords] = useState<any[]>([]);
  const [gameLearned, setGameLearned] = useState<Set<string>>(new Set());
  /* ── Quiz fullscreen state (My Vocab) ── */
  const [quizMode, setQuizMode] = useState(false);
  const [quizWords, setQuizWords] = useState<any[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingGame, setLoadingGame] = useState(false);
  /* ── Matching fullscreen state (My Vocab) ── */
  const [matchingMode, setMatchingMode] = useState(false);
  const [matchingWords, setMatchingWords] = useState<any[]>([]);
  const [loadingMatching, setLoadingMatching] = useState(false);

  /* ── Quick view words ── */
  const { data: quickViewWords = [], isLoading: quickViewLoading } = useSystemVocabWords(quickViewSetId ?? undefined);

  /* ── Fetch user lists & stats ── */
  useEffect(() => {
    if (!user) return;
    setListsLoading(true);

    const fetchAll = async () => {
      // Fetch lists
      const { data: lists } = await supabase
        .from("vocab_lists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (lists) {
        // For each list, count words
        const withCounts = await Promise.all(
          lists.map(async (list: any) => {
            const { count } = await supabase
              .from("vocab_items")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("vocab_set_id", list.id);
            return { ...list, wordCount: count || 0 };
          })
        );
        setMyLists(withCounts);
      }

      // Fetch stats
      const { count: total } = await supabase
        .from("vocab_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: learned } = await supabase
        .from("vocab_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "learned");

      const { count: review } = await supabase
        .from("vocab_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "learned");

      setStats({
        total: total || 0,
        learned: learned || 0,
        review: review || 0,
      });
      setListsLoading(false);
    };

    fetchAll();
  }, [user]);

  if (skill !== "vocabulary") {
    return <Navigate to="/" replace />;
  }

  const { data: systemSets = [], isLoading: setsLoading } = useSystemVocabSets();
  const quickViewSet = systemSets.find((s) => s.id === quickViewSetId);

  const filtered = systemSets.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.group_name.toLowerCase().includes(search.toLowerCase()),
  );

  function speak(text: string, lang: "en" | "vi") {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "en" ? "en-US" : "vi-VN";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  const handleCreateList = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("vocab_lists")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDesc.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMyLists((prev) => [{ ...data, wordCount: 0 }, ...prev]);
      toast({ title: `Đã tạo "${data.name}" ✓` });
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
    } else {
      toast({ title: "Lỗi khi tạo danh sách", variant: "destructive" });
    }
    setCreating(false);
  };

  /* ── Launch Flashcard for My Vocab ── */
  const handleLaunchMyFlashcards = async () => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập để dùng tính năng này", variant: "destructive" });
      return;
    }
    setLoadingGame(true);
    const { data, error } = await supabase
      .from("vocab_items")
      .select("id, word, phonetic, meaning, example_en, example_vi, word_family, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoadingGame(false);

    if (error) {
      toast({ title: "Không tải được kho từ", variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({
        title: "Bạn chưa lưu từ nào. Hãy tra từ khi làm bài để thêm vào kho!",
      });
      return;
    }

    setGameWords(
      data.map((w: any) => ({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic ?? "",
        meaning: w.meaning ?? "",
        example_en: w.example_en ?? "",
        example_vi: w.example_vi ?? "",
        word_family: Array.isArray(w.word_family) ? w.word_family : [],
      })),
    );
    setGameLearned(new Set(data.filter((w: any) => w.status === "learned").map((w: any) => w.word)));
    setFlashcardMode(true);
  };

  const handleMyFlashcardLearned = async (wordText: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("vocab_items")
      .update({ status: "learned", last_reviewed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("word", wordText);
    if (!error) {
      setGameLearned((prev) => new Set(prev).add(wordText));
      // Refresh stats lazily
      setStats((s) => ({ ...s, learned: s.learned + 1, review: Math.max(0, s.review - 1) }));
    }
  };

  /* ── Launch Quiz for My Vocab ── */
  const handleLaunchMyQuiz = async () => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập để dùng tính năng này", variant: "destructive" });
      return;
    }
    setLoadingQuiz(true);
    const { data, error } = await supabase
      .from("vocab_items")
      .select("id, word, meaning")
      .eq("user_id", user.id);
    setLoadingQuiz(false);

    if (error) {
      toast({ title: "Không tải được kho từ", variant: "destructive" });
      return;
    }
    if (!data || data.length < 4) {
      toast({ title: "Cần ít nhất 4 từ để làm quiz!", variant: "destructive" });
      return;
    }

    setQuizWords(
      data.map((w: any) => ({ id: w.id, word: w.word, meaning: w.meaning ?? "" })),
    );
    setQuizMode(true);
  };

  /* ── Launch Matching for My Vocab ── */
  const handleLaunchMyMatching = async () => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập để dùng tính năng này", variant: "destructive" });
      return;
    }
    setLoadingMatching(true);
    const { data, error } = await supabase
      .from("vocab_items")
      .select("id, word, meaning")
      .eq("user_id", user.id);
    setLoadingMatching(false);

    if (error) {
      toast({ title: "Không tải được kho từ", variant: "destructive" });
      return;
    }
    if (!data || data.length < 4) {
      toast({ title: "Cần ít nhất 4 từ để chơi Matching!", variant: "destructive" });
      return;
    }

    setMatchingWords(
      data.map((w: any) => ({ id: w.id, word: w.word, meaning: w.meaning ?? "" })),
    );
    setMatchingMode(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* ── Header ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 border-b border-border">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="orange" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-10 md:py-14 flex flex-col md:flex-row items-center gap-6 relative z-10">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shrink-0">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Học từ vựng Aptis
              </h1>
              <p className="text-muted-foreground mt-1 text-base md:text-lg">
                Ôn luyện từ vựng theo các chủ đề trong bộ đề thi & quản lý kho từ cá nhân
              </p>
            </div>
          </div>
        </section>


        {/* ── Tabs ── */}
        <div className="section-container py-8">
          <Tabs defaultValue="aptis" className="w-full">
            <TabsList className="w-full max-w-md mx-auto md:mx-0 h-12 p-1 bg-muted rounded-xl mb-8">
              <TabsTrigger
                value="aptis"
                className={`flex-1 h-full rounded-lg text-sm font-semibold transition-all ${TEAL.tab}`}
              >
                <Library className="w-4 h-4 mr-2" />
                Từ vựng bài thi Aptis
              </TabsTrigger>
              <TabsTrigger
                value="my"
                className={`flex-1 h-full rounded-lg text-sm font-semibold transition-all ${TEAL.tab}`}
              >
                <Brain className="w-4 h-4 mr-2" />
                Kho từ vựng của tôi
              </TabsTrigger>
            </TabsList>

            {/* ════════ TAB 1 ════════ */}
            <TabsContent value="aptis">
              <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm bộ từ vựng…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {setsLoading ? (
                <div className="py-12 flex justify-center col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((set) => (
                  <Card
                    key={set.id}
                    className="group hover:shadow-lg transition-shadow border border-border"
                  >
                    <CardContent className="p-5 flex flex-col gap-3">
                      <Badge
                        variant="outline"
                        className={
                          set.group_name.toUpperCase().includes("ADVANCED")
                            ? TEAL.badgeAdv
                            : TEAL.badge
                        }
                      >
                        {set.group_name}
                      </Badge>
                      <h3 className="font-heading font-semibold text-foreground text-base leading-snug">
                        {set.title}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {set.word_count} từ vựng
                      </span>
                      <div className="flex gap-2 mt-auto pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                          onClick={() => setQuickViewSetId(set.id)}
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem nhanh
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => navigate(`/vocabulary/${set.id}`)}
                        >
                          <Play className="w-3.5 h-3.5" /> Luyện tập
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filtered.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-12">
                    Không tìm thấy bộ từ nào phù hợp.
                  </p>
                )}
              </div>
              )}
            </TabsContent>

            {/* ════════ TAB 2 — KHO TỪ VỰNG CỦA TÔI ════════ */}
            <TabsContent value="my">
              {!user ? (
                <Card className="border border-border">
                  <CardContent className="py-14 text-center text-muted-foreground">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium text-foreground mb-1">Đăng nhập để sử dụng</p>
                    <p className="text-sm">
                      Hãy đăng nhập để tạo và quản lý kho từ vựng cá nhân.
                    </p>
                    <Button className="mt-4" onClick={() => navigate("/auth")}>
                      Đăng nhập
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    <StatCard
                      icon={<Layers className="w-6 h-6" />}
                      label="Tổng số từ"
                      value={stats.total}
                      color="hsl(var(--primary))"
                    />
                    <StatCard
                      icon={<GraduationCap className="w-6 h-6" />}
                      label="Từ đã thuộc"
                      value={stats.learned}
                      color="hsl(var(--success))"
                    />
                    <StatCard
                      icon={<RotateCcw className="w-6 h-6" />}
                      label="Từ cần ôn"
                      value={stats.review}
                      color="hsl(var(--warning))"
                    />
                  </div>

                  {/* Header + Create btn */}
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-heading font-bold text-lg text-foreground">
                      Danh sách từ vựng của tôi
                    </h2>
                    <Button
                      className="gap-1.5"
                      onClick={() => setCreateOpen(true)}
                    >
                      <FolderPlus className="w-4 h-4" />
                      Tạo danh sách mới
                    </Button>
                  </div>

                  {/* Lists grid */}
                  {listsLoading ? (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : myLists.length === 0 ? (
                    <Card className="border border-dashed border-primary/30">
                      <CardContent className="py-14 text-center text-muted-foreground">
                        <FolderPlus className="w-10 h-10 mx-auto mb-3 text-primary/40" />
                        <p className="font-medium text-foreground mb-1">Chưa có danh sách nào</p>
                        <p className="text-sm">
                          Bấm "Tạo danh sách mới" hoặc tra từ khi làm bài để bắt đầu!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {myLists.map((list) => (
                        <Card
                          key={list.id}
                          className="group hover:shadow-lg transition-all border border-border cursor-pointer hover:border-primary/30"
                          onClick={() => navigate(`/vocab/${list.id}`)}
                        >
                          <CardContent className="p-5 flex flex-col gap-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-heading font-semibold text-foreground text-base leading-snug">
                                {list.name}
                              </h3>
                              <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                                {list.wordCount} từ
                              </Badge>
                            </div>
                            {list.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {list.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-auto pt-2">
                              Tạo ngày {new Date(list.created_at).toLocaleDateString("vi-VN")}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Game buttons */}
                  <h2 className="font-heading font-bold text-lg text-foreground mb-4 mt-10">
                    Luyện tập từ vựng
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <GameCard
                      title="Flashcards"
                      description="Lật thẻ để ôn lại các từ trong kho cá nhân của bạn"
                      icon={<Sparkles className="w-7 h-7" />}
                      onClick={handleLaunchMyFlashcards}
                      loading={loadingGame}
                    />
                    <GameCard
                      title="Quiz"
                      description="Kiểm tra từ vựng bằng trắc nghiệm 4 đáp án"
                      icon={<Brain className="w-7 h-7" />}
                      onClick={handleLaunchMyQuiz}
                      loading={loadingQuiz}
                    />
                    <GameCard
                      title="Matching"
                      description="Ghép từ tiếng Anh với nghĩa tiếng Việt trong thời gian giới hạn"
                      icon={<Layers className="w-7 h-7" />}
                      onClick={handleLaunchMyMatching}
                      loading={loadingMatching}
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Flashcard fullscreen overlay (My Vocab) */}
        {flashcardMode && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
            <div className="border-b border-border bg-card">
              <div className="section-container py-4 flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlashcardMode(false)}
                  className="gap-1.5"
                >
                  <X className="w-4 h-4" /> Thoát
                </Button>
                <div className="flex-1 min-w-0 text-center">
                  <h2 className="font-heading font-bold text-lg text-foreground truncate">
                    Flashcard — {gameWords.length} từ
                  </h2>
                </div>
                <div className="w-[88px]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-8">
              <div className="section-container">
                <FlashcardMode
                  words={gameWords as any}
                  learnedWords={gameLearned}
                  onMarkLearned={handleMyFlashcardLearned}
                  onBackToList={() => setFlashcardMode(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quiz fullscreen overlay (My Vocab) */}
        {quizMode && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
            <div className="border-b border-border bg-card">
              <div className="section-container py-4 flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuizMode(false)}
                  className="gap-1.5"
                >
                  <X className="w-4 h-4" /> Thoát
                </Button>
                <div className="flex-1 min-w-0 text-center">
                  <h2 className="font-heading font-bold text-lg text-foreground truncate">Quiz</h2>
                </div>
                <div className="w-[88px]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-8">
              <div className="section-container">
                <QuizMode
                  words={quizWords as any}
                  onBackToList={() => setQuizMode(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Matching fullscreen overlay (My Vocab) */}
        {matchingMode && (
          <MyMatchingMode
            words={matchingWords as any}
            onExit={() => setMatchingMode(false)}
          />
        )}

        {/* Create List Modal */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Tạo danh sách từ vựng mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Tên danh sách <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Reading Test 1, Từ vựng IELTS..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Mô tả (tuỳ chọn)
                </label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ghi chú ngắn về danh sách này..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Huỷ
              </Button>
              <Button
                onClick={handleCreateList}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <FolderPlus className="w-4 h-4 mr-1.5" />
                )}
                Tạo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ════════ QUICK VIEW DIALOG ════════ */}
        <Dialog open={!!quickViewSetId} onOpenChange={(open) => !open && setQuickViewSetId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-6 pb-4 border-b border-border bg-[hsl(170,50%,96%)] dark:bg-[hsl(170,25%,10%)] shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{quickViewSet?.group_name}</p>
                  <DialogTitle className="font-heading text-xl">{quickViewSet?.title}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">{quickViewSet?.word_count} từ vựng</p>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-0">
              {quickViewLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {quickViewWords.map((w, i) => (
                    <div key={w.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">{i + 1}.</span>
                            <h4 className="font-heading font-bold text-foreground text-lg">
                              {w.word}
                              {w.word_type && <span className="text-sm font-normal text-muted-foreground ml-1">({w.word_type})</span>}
                            </h4>
                          </div>
                          {w.phonetic && <p className="text-xs text-muted-foreground ml-8">{w.phonetic}</p>}
                          <p className="text-sm font-medium text-[hsl(170,55%,35%)] dark:text-[hsl(170,55%,55%)] ml-8 mt-0.5">{w.meaning}</p>
                          {w.example_en && (
                            <p className="text-sm text-muted-foreground ml-8 mt-1 italic">"{w.example_en}"</p>
                          )}
                          {w.example_vi && (
                            <p className="text-xs text-muted-foreground ml-8">{w.example_vi}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1" onClick={() => speak(w.word, "en")} title="Nghe phát âm">
                          <Volume2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="p-4 border-t border-border shrink-0">
              <Button className="w-full gap-1.5" onClick={() => { setQuickViewSetId(null); navigate(`/vocabulary/${quickViewSetId}`); }}>
                <Play className="w-4 h-4" /> Bắt đầu luyện tập
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

/* ───── sub-components ───── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color, color: "white" }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCard({
  title,
  description,
  icon,
  onClick,
  disabled,
  loading,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isInactive = disabled || loading;
  return (
    <Card
      onClick={isInactive ? undefined : onClick}
      className={`border border-border transition-shadow group ${
        isInactive
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md cursor-pointer"
      }`}
    >
      <CardContent className="p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
          {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : icon}
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        {disabled && !loading && (
          <Badge variant="outline" className="text-xs shrink-0">
            Cần có bộ từ
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default SkillPractice;

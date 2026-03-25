import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Volume2,
  X,
  Plus,
  Loader2,
  BookOpen,
  ChevronDown,
  FolderPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";

/* ─── Types ─── */
interface DictMeaning {
  partOfSpeech: string;
  definition_vi: string;
  definition_en: string;
}
interface DictExample {
  en: string;
  vi: string;
}
interface DictWordFamily {
  word: string;
  partOfSpeech: string;
}
interface DictResult {
  word: string;
  phonetic: string;
  meanings: DictMeaning[];
  examples: DictExample[];
  synonyms: string[];
  wordFamily: DictWordFamily[];
}

interface DictionaryContextType {
  lookup: (word: string, rect: DOMRect) => void;
  close: () => void;
}

const DictionaryContext = createContext<DictionaryContextType | null>(null);
export const useDictionary = () => useContext(DictionaryContext);

/* ─── TTS ─── */
function speak(text: string, lang: "en" | "vi") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-US" : "vi-VN";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/* ─── English word regex ─── */
const ENGLISH_WORD_RE = /^[a-zA-Z]{2,}$/;

/* ══════════════════ Provider ══════════════════ */
export const DictionaryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [result, setResult] = useState<DictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, DictResult>>(new Map());
  const dblClickRef = useRef(false);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setResult(null);
      setPosition(null);
      setError(null);
    }, 200);
  }, []);

  const lookup = useCallback(
    async (word: string, rect: DOMRect) => {
      const clean = word.trim().toLowerCase();
      if (!ENGLISH_WORD_RE.test(clean)) return;

      // Position popup
      const x = Math.min(
        rect.left + rect.width / 2,
        window.innerWidth - 200
      );
      const y = rect.bottom + window.scrollY + 8;
      setPosition({ x, y });
      setVisible(true);
      setError(null);

      // Check cache
      if (cacheRef.current.has(clean)) {
        setResult(cacheRef.current.get(clean)!);
        setLoading(false);
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "dictionary-lookup",
          { body: { word: clean } }
        );
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        cacheRef.current.set(clean, data as DictResult);
        setResult(data as DictResult);
      } catch (e: any) {
        console.error("Dictionary lookup failed:", e);
        setError("Không thể tra từ này. Thử lại sau.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* ─── Helper: skip interactive elements ─── */
  const isInteractive = (el: HTMLElement) =>
    el.closest("button") ||
    el.closest("input") ||
    el.closest("textarea") ||
    el.closest("a") ||
    el.closest("[role='button']") ||
    el.closest(".dictionary-popup");

  /* ─── Close on outside click ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      if (visible) close();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [visible, close]);

  /* ─── Double-click: let browser select word, then lookup ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (isInteractive(target)) return;

      dblClickRef.current = true;
      // Wait for browser to finish native word selection
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && ENGLISH_WORD_RE.test(text) && sel!.rangeCount > 0) {
          const rect = sel!.getRangeAt(0).getBoundingClientRect();
          lookup(text, rect);
        }
        setTimeout(() => { dblClickRef.current = false; }, 100);
      }, 0);
    };
    document.addEventListener("dblclick", handler);
    return () => document.removeEventListener("dblclick", handler);
  }, [lookup]);

  /* ─── Text selection (mouseup): lookup selected text ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dblClickRef.current) return;
      if (popupRef.current?.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (isInteractive(target)) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (!text || !ENGLISH_WORD_RE.test(text)) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      lookup(text, rect);
    };
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, [lookup]);

  /* ─── Escape key ─── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, close]);

  return (
    <DictionaryContext.Provider value={{ lookup, close }}>
      {children}
      {position &&
        createPortal(
          <DictionaryPopup
            ref={popupRef}
            result={result}
            loading={loading}
            error={error}
            position={position}
            visible={visible}
            onClose={close}
          />,
          document.body
        )}
    </DictionaryContext.Provider>
  );
};

/* ══════════════════ Popup ══════════════════ */
interface PopupProps {
  result: DictResult | null;
  loading: boolean;
  error: string | null;
  position: { x: number; y: number };
  visible: boolean;
  onClose: () => void;
}

const DictionaryPopup = React.forwardRef<HTMLDivElement, PopupProps>(
  ({ result, loading, error, position, visible, onClose }, ref) => {
    const { user } = useAuth();
    const [addOpen, setAddOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [userLists, setUserLists] = useState<{ id: string; name: string }[]>([]);
    const [listsLoaded, setListsLoaded] = useState(false);
    const [creatingNew, setCreatingNew] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [savedListIds, setSavedListIds] = useState<Set<string>>(new Set());
    const popupWidth = 360;

    // Fetch user's vocab lists + check which already contain this word
    useEffect(() => {
      if (!addOpen || !user || listsLoaded) return;
      (async () => {
        const [listsRes, itemsRes] = await Promise.all([
          supabase
            .from("vocab_lists")
            .select("id, name")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          result
            ? supabase
                .from("vocab_items")
                .select("vocab_set_id")
                .eq("user_id", user.id)
                .eq("word", result.word)
            : Promise.resolve({ data: [] }),
        ]);
        if (listsRes.data) setUserLists(listsRes.data as any);
        if (itemsRes.data) {
          setSavedListIds(new Set((itemsRes.data as any[]).map((i: any) => i.vocab_set_id)));
        }
        setListsLoaded(true);
      })();
    }, [addOpen, user, listsLoaded, result]);

    // Reset state when popup hides
    useEffect(() => {
      if (!visible) {
        setAddOpen(false);
        setListsLoaded(false);
        setCreatingNew(false);
        setNewListName("");
        setSavedListIds(new Set());
      }
    }, [visible]);

    // Clamp x to viewport
    const clampedX = Math.max(
      12,
      Math.min(position.x - popupWidth / 2, window.innerWidth - popupWidth - 12)
    );

    // If popup would go below viewport, show above
    const spaceBelow = window.innerHeight - (position.y - window.scrollY);
    const showAbove = spaceBelow < 350;

    const addToSet = async (setId: string, listName: string) => {
      if (!user || !result) return;
      if (savedListIds.has(setId)) return; // already saved
      setAdding(true);
      const { error: dbError } = await supabase.from("vocab_items").upsert(
        {
          user_id: user.id,
          word: result.word,
          vocab_set_id: setId,
          status: "new",
          phonetic: result.phonetic || "",
          meaning: result.meanings.map((m) => m.definition_vi).join("; ") || "",
          example_en: result.examples[0]?.en || "",
          example_vi: result.examples[0]?.vi || "",
          word_family: result.wordFamily as any,
        },
        { onConflict: "user_id,word,vocab_set_id" }
      );
      setAdding(false);
      if (!dbError) {
        setSavedListIds((prev) => new Set(prev).add(setId));
        toast({ title: `Đã lưu vào "${listName}" thành công ✓` });
      } else {
        toast({ title: "Lỗi khi thêm từ", variant: "destructive" });
      }
    };

    return (
      <div
        ref={ref}
        className={`dictionary-popup fixed z-[9999] transition-all duration-200 ${
          visible
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          left: clampedX,
          top: showAbove ? undefined : position.y,
          bottom: showAbove
            ? window.innerHeight - (position.y - window.scrollY) + 16
            : undefined,
          width: popupWidth,
          transformOrigin: showAbove ? "bottom center" : "top center",
        }}
      >
        <div className="bg-popover border border-border rounded-2xl shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.25)] dark:shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.5)] overflow-hidden">
          {/* ── Loading state ── */}
          {loading && (
            <div className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Đang tra từ…</p>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div className="p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={onClose}
              >
                Đóng
              </Button>
            </div>
          )}

          {/* ── Result ── */}
          {result && !loading && (
            <>
              {/* Header */}
              <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2 border-b border-border bg-[hsl(170,50%,96%)] dark:bg-[hsl(170,25%,10%)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-heading font-bold text-foreground">
                      {result.word}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(result.word, "en");
                      }}
                    >
                      <Volume2 className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.phonetic}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 -mr-1 -mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="px-4 pt-3 pb-2">
                <Tabs defaultValue="meaning" className="w-full">
                  <TabsList className="w-full h-8 p-0.5 bg-muted rounded-lg mb-2">
                    <TabsTrigger
                      value="meaning"
                      className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Nghĩa
                    </TabsTrigger>
                    <TabsTrigger
                      value="examples"
                      className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Ví dụ
                    </TabsTrigger>
                    <TabsTrigger
                      value="synonyms"
                      className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Đồng nghĩa
                    </TabsTrigger>
                    <TabsTrigger
                      value="family"
                      className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Họ từ
                    </TabsTrigger>
                  </TabsList>

                  {/* Meanings */}
                  <TabsContent value="meaning" className="mt-0 max-h-[180px] overflow-y-auto">
                    <div className="space-y-2 py-1">
                      {result.meanings.map((m, i) => (
                        <div key={i}>
                          <Badge
                            variant="outline"
                            className="text-[10px] mb-1"
                          >
                            {m.partOfSpeech}
                          </Badge>
                          <p className="text-sm font-medium text-foreground">
                            {m.definition_vi}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.definition_en}
                          </p>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Examples */}
                  <TabsContent value="examples" className="mt-0 max-h-[180px] overflow-y-auto">
                    <div className="space-y-3 py-1">
                      {result.examples.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="text-sm text-foreground italic">
                              "{ex.en}"
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ex.vi}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              speak(ex.en, "en");
                            }}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {result.examples.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Không có ví dụ.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Synonyms */}
                  <TabsContent value="synonyms" className="mt-0 max-h-[180px] overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {result.synonyms.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-xs font-normal cursor-pointer hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(s, "en");
                          }}
                        >
                          <Volume2 className="w-2.5 h-2.5 mr-1 opacity-50" />
                          {s}
                        </Badge>
                      ))}
                      {result.synonyms.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Không có từ đồng nghĩa.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Word Family */}
                  <TabsContent value="family" className="mt-0 max-h-[180px] overflow-y-auto">
                    <div className="space-y-1.5 py-1">
                      {result.wordFamily.map((wf, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-md px-2 py-1 -mx-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(wf.word, "en");
                          }}
                        >
                          <Volume2 className="w-3 h-3 text-muted-foreground opacity-50" />
                          <span className="text-sm font-medium text-foreground">
                            {wf.word}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] ml-auto"
                          >
                            {wf.partOfSpeech}
                          </Badge>
                        </div>
                      ))}
                      {result.wordFamily.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Không có họ từ.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Footer — Add to user's list */}
              <div className="px-4 pb-4 pt-1 border-t border-border">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!user) {
                        toast({ title: "Vui lòng đăng nhập để lưu từ", variant: "destructive" });
                        return;
                      }
                      setAddOpen(!addOpen);
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Thêm vào danh sách từ vựng của tôi
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        addOpen ? "rotate-180" : ""
                      }`}
                    />
                  </Button>

                  {addOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-10">
                      {!listsLoaded && (
                        <div className="px-3 py-3 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {listsLoaded && userLists.length === 0 && !creatingNew && (
                        <p className="px-3 py-2.5 text-xs text-muted-foreground text-center">
                          Chưa có danh sách nào. Tạo mới bên dưới!
                        </p>
                      )}

                      {listsLoaded && userLists.map((list) => {
                        const isSaved = savedListIds.has(list.id);
                        return (
                          <button
                            key={list.id}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 ${isSaved ? "opacity-60 cursor-default" : "hover:bg-muted"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isSaved) addToSet(list.id, list.name);
                            }}
                            disabled={adding || isSaved}
                          >
                            <span className="truncate">{list.name}</span>
                            {isSaved ? (
                              <span className="text-[10px] text-primary font-medium shrink-0">Đã lưu</span>
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-[hsl(170,55%,40%)] shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {/* Create new list */}
                      {creatingNew ? (
                        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
                          <Input
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="Tên danh sách…"
                            className="h-7 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && newListName.trim()) {
                                (async () => {
                                  if (!user) return;
                                  setAdding(true);
                                  const { data, error: dbErr } = await supabase
                                    .from("vocab_lists")
                                    .insert({ user_id: user.id, name: newListName.trim() })
                                    .select("id, name")
                                    .single();
                                  if (!dbErr && data) {
                                    setUserLists((prev) => [data as any, ...prev]);
                                    if (result) {
                                      await supabase.from("vocab_items").upsert(
                                        {
                                          user_id: user.id,
                                          word: result.word,
                                          vocab_set_id: (data as any).id,
                                          status: "new",
                                          phonetic: result.phonetic || "",
                                          meaning: result.meanings.map((m) => m.definition_vi).join("; ") || "",
                                          example_en: result.examples[0]?.en || "",
                                          example_vi: result.examples[0]?.vi || "",
                                          word_family: result.wordFamily as any,
                                        },
                                        { onConflict: "user_id,word,vocab_set_id" }
                                      );
                                      setSavedListIds((prev) => new Set(prev).add((data as any).id));
                                    }
                                    toast({ title: `Đã lưu vào "${data.name}" thành công ✓` });
                                    setCreatingNew(false);
                                    setNewListName("");
                                  } else {
                                    toast({ title: "Lỗi khi tạo danh sách", variant: "destructive" });
                                  }
                                  setAdding(false);
                                })();
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,34%)] text-white shrink-0"
                            disabled={!newListName.trim() || adding}
                            onClick={(e) => {
                              e.stopPropagation();
                              // trigger same logic as Enter key
                              const event = new KeyboardEvent("keydown", { key: "Enter" });
                              (e.currentTarget.previousElementSibling as HTMLElement)?.dispatchEvent(event);
                            }}
                          >
                            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-muted transition-colors flex items-center gap-2 border-t border-border text-[hsl(170,55%,40%)] font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreatingNew(true);
                          }}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          + Tạo danh sách từ vựng mới
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);

DictionaryPopup.displayName = "DictionaryPopup";

export default DictionaryProvider;

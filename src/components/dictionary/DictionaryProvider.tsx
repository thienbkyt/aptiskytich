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
import { speakWithTTS } from "@/lib/tts";
import { safeLocalStorage } from "@/lib/safeStorage";

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

/* ─── TTS (Google Cloud TTS via edge function) ─── */
function speak(text: string, lang: "en" | "vi") {
  void speakWithTTS(text, lang);
}

/* ─── English word regex ─── */
const ENGLISH_WORD_RE = /^[a-zA-Z]{2,}$/;

/* ─── Rate limiter: max 1 lookup per 2 seconds ─── */
const lastLookupRef = { time: 0 };
const LOOKUP_COOLDOWN_MS = 2000;

/* ─── localStorage cache helpers (TTL 7 days, max 500 entries) ─── */
const DICT_CACHE_KEY = "dict_cache";
const DICT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const DICT_CACHE_MAX = 500;

interface CacheEntry { data: DictResult; ts: number; }

function getDictCache(): Record<string, CacheEntry> {
  try {
    const raw = safeLocalStorage.getItem(DICT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function getDictCacheEntry(word: string): DictResult | null {
  const cache = getDictCache();
  const entry = cache[word];
  if (!entry) return null;
  if (Date.now() - entry.ts > DICT_CACHE_TTL) return null;
  return entry.data;
}

function setDictCache(word: string, data: DictResult) {
  const cache = getDictCache();
  cache[word] = { data, ts: Date.now() };
  // LRU eviction: remove oldest entries if over max
  const keys = Object.keys(cache);
  if (keys.length > DICT_CACHE_MAX) {
    const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
    const toRemove = sorted.slice(0, keys.length - DICT_CACHE_MAX);
    toRemove.forEach((k) => delete cache[k]);
  }
  safeLocalStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
}

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

  // Load localStorage cache into memory on mount
  useEffect(() => {
    const stored = getDictCache();
    Object.entries(stored).forEach(([word, entry]) => {
      if (Date.now() - entry.ts < DICT_CACHE_TTL) {
        cacheRef.current.set(word, entry.data);
      }
    });
  }, []);
  const dblClickRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setVisible(false);

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setResult(null);
      setPosition(null);
      setError(null);
      closeTimeoutRef.current = null;
    }, 200);
  }, []);

  const lookup = useCallback(
    async (word: string, rect: DOMRect) => {
      const clean = word.trim().toLowerCase();
      if (!ENGLISH_WORD_RE.test(clean)) return;

      // Rate limit: skip if too frequent (unless cached)
      const now = Date.now();
      if (!cacheRef.current.has(clean) && now - lastLookupRef.time < LOOKUP_COOLDOWN_MS) return;
      lastLookupRef.time = now;

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      // Position popup (viewport-relative since we use position:fixed)
      const x = Math.min(
        rect.left + rect.width / 2,
        window.innerWidth - 200
      );
      const y = rect.bottom + 8;
      setPosition({ x, y });
      setVisible(true);
      setError(null);

      // Check in-memory cache
      if (cacheRef.current.has(clean)) {
        setResult(cacheRef.current.get(clean)!);
        setLoading(false);
        return;
      }

      // Check localStorage cache
      const cached = getDictCacheEntry(clean);
      if (cached) {
        cacheRef.current.set(clean, cached);
        setResult(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        console.log('API Dictionary Called:', clean);
        const { data, error: fnError } = await supabase.functions.invoke(
          "dictionary-lookup",
          { body: { word: clean } }
        );
        if (fnError) {
          const ctx: any = (fnError as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const b = await ctx.json();
              if (b?.error) throw new Error(b.error);
            } catch { /* fall through */ }
          }
          throw fnError;
        }
        if (data?.error) throw new Error(data.error);

        cacheRef.current.set(clean, data as DictResult);
        setDictCache(clean, data as DictResult);
        setResult(data as DictResult);
      } catch (e: any) {
        console.error("Dictionary lookup failed:", e);
        const msg = e?.message || "";
        setError(/giới hạn hôm nay/i.test(msg) ? msg : "Không thể tra từ này. Thử lại sau.");
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
      if (dblClickRef.current) return;
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

  /* ─── REMOVED mouseup auto-lookup to prevent wasteful API calls ─── */
  /* Dictionary lookup is now ONLY triggered by double-click (manual) */

  /* ─── Sentence translate: show floating "Dịch" button on multi-word selection ─── */
  const [translateBtn, setTranslateBtn] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [translatePopup, setTranslatePopup] = useState<{
    x: number;
    y: number;
    source: string;
    translation: string | null;
    loading: boolean;
    error: string | null;
    visible: boolean;
  } | null>(null);
  const translateRateRef = useRef(0);
  const sentenceCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    try {
      const raw = safeLocalStorage.getItem("sentence_translate_cache");
      if (!raw) return;
      const parsed: Record<string, { t: string; ts: number }> = JSON.parse(raw);
      const ttl = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      Object.entries(parsed).forEach(([k, v]) => {
        if (now - v.ts < ttl) sentenceCacheRef.current.set(k, v.t);
      });
    } catch {}
  }, []);

  const persistSentenceCache = useCallback((key: string, translation: string) => {
    try {
      const raw = safeLocalStorage.getItem("sentence_translate_cache");
      const parsed: Record<string, { t: string; ts: number }> = raw ? JSON.parse(raw) : {};
      parsed[key] = { t: translation, ts: Date.now() };
      const keys = Object.keys(parsed);
      const MAX = 300;
      if (keys.length > MAX) {
        const sorted = keys.sort((a, b) => parsed[a].ts - parsed[b].ts);
        sorted.slice(0, keys.length - MAX).forEach((k) => delete parsed[k]);
      }
      safeLocalStorage.setItem("sentence_translate_cache", JSON.stringify(parsed));
    } catch {}
  }, []);

  const normalizeSentence = (s: string) =>
    s.replace(/\s+/g, " ").trim().toLowerCase();

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.closest(".sentence-translate-btn")) return;
      if (target.closest(".sentence-translate-popup")) return;
      if (popupRef.current?.contains(target)) return;
      if (isInteractive(target)) {
        setTranslateBtn(null);
        return;
      }
      setTimeout(() => {
        const sel = window.getSelection();
        const raw = sel?.toString() ?? "";
        const text = raw.trim();
        if (!text || !sel || sel.rangeCount === 0) {
          setTranslateBtn(null);
          return;
        }
        const isSingleWord = ENGLISH_WORD_RE.test(text) && !/\s/.test(text);
        if (isSingleWord) {
          setTranslateBtn(null);
          return;
        }
        if (text.length > 2000) {
          setTranslateBtn(null);
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setTranslateBtn(null);
          return;
        }
        const x = Math.min(
          Math.max(40, rect.left + rect.width / 2),
          window.innerWidth - 80
        );
        const y = rect.bottom + 6;
        setTranslateBtn({ x, y, text });
      }, 0);
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text) setTranslateBtn(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const closeTranslatePopup = useCallback(() => {
    setTranslatePopup((prev) => (prev ? { ...prev, visible: false } : prev));
    setTimeout(() => setTranslatePopup(null), 200);
  }, []);

  const runTranslate = useCallback(async () => {
    if (!translateBtn) return;
    const text = translateBtn.text;
    const key = normalizeSentence(text);
    const x = translateBtn.x;
    const y = translateBtn.y;
    setTranslateBtn(null);

    const cached = sentenceCacheRef.current.get(key);
    if (cached) {
      setTranslatePopup({
        x, y, source: text, translation: cached, loading: false, error: null, visible: true,
      });
      return;
    }

    const now = Date.now();
    if (now - translateRateRef.current < 1500) {
      setTranslatePopup({
        x, y, source: text, translation: null, loading: false,
        error: "Vui lòng đợi vài giây rồi thử lại.", visible: true,
      });
      return;
    }
    translateRateRef.current = now;

    setTranslatePopup({
      x, y, source: text, translation: null, loading: true, error: null, visible: true,
    });

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "translate-text",
        { body: { text } }
      );
      if (fnError) throw fnError;
      if ((data as any)?.error) throw new Error((data as any).error);
      const translation = (data as any)?.translation as string;
      if (!translation) throw new Error("Empty translation");
      sentenceCacheRef.current.set(key, translation);
      persistSentenceCache(key, translation);
      setTranslatePopup((prev) =>
        prev ? { ...prev, translation, loading: false } : prev
      );
    } catch (e: any) {
      console.error("translate-text failed:", e);
      setTranslatePopup((prev) =>
        prev ? { ...prev, loading: false, error: "Không thể dịch. Thử lại sau." } : prev
      );
    }
  }, [translateBtn, persistSentenceCache]);

  useEffect(() => {
    if (!translatePopup?.visible) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".sentence-translate-popup")) return;
      if (t.closest(".sentence-translate-btn")) return;
      closeTranslatePopup();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTranslatePopup();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [translatePopup?.visible, closeTranslatePopup]);

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
      {translateBtn &&
        createPortal(
          <button
            type="button"
            className="sentence-translate-btn fixed z-[9998] flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg hover:opacity-90 transition-all"
            style={{
              left: translateBtn.x,
              top: translateBtn.y,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              void runTranslate();
            }}
          >
            <BookOpen className="w-3 h-3" />
            Dịch
          </button>,
          document.body
        )}
      {translatePopup &&
        createPortal(
          <SentenceTranslatePopup data={translatePopup} onClose={closeTranslatePopup} />,
          document.body
        )}
    </DictionaryContext.Provider>
  );
};

/* ══════════════════ Sentence Translate Popup ══════════════════ */
interface SentencePopupData {
  x: number;
  y: number;
  source: string;
  translation: string | null;
  loading: boolean;
  error: string | null;
  visible: boolean;
}

const SentenceTranslatePopup: React.FC<{
  data: SentencePopupData;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const width = 360;
  const clampedX = Math.max(
    12,
    Math.min(data.x - width / 2, window.innerWidth - width - 12)
  );
  const spaceBelow = window.innerHeight - data.y;
  const showAbove = spaceBelow < 240;

  return (
    <div
      className={`sentence-translate-popup fixed z-[9999] transition-all duration-200 ${
        data.visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      }`}
      style={{
        left: clampedX,
        top: showAbove ? undefined : data.y,
        bottom: showAbove ? window.innerHeight - data.y + 24 : undefined,
        width,
        transformOrigin: showAbove ? "bottom center" : "top center",
      }}
    >
      <div className="bg-popover border border-border rounded-2xl shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.25)] dark:shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.5)] overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border bg-[hsl(170,50%,96%)] dark:bg-[hsl(170,25%,10%)]">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            Dịch câu
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                void speakWithTTS(data.source, "en");
              }}
              title="Đọc câu gốc"
            >
              <Volume2 className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="px-4 py-3 space-y-2 max-h-[300px] overflow-y-auto">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
              English
            </p>
            <p className="text-sm text-foreground italic leading-relaxed">
              {data.source}
            </p>
          </div>
          <div className="border-t border-border pt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
              Tiếng Việt
            </p>
            {data.loading && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Đang dịch…</span>
              </div>
            )}
            {data.error && !data.loading && (
              <p className="text-sm text-destructive">{data.error}</p>
            )}
            {data.translation && !data.loading && (
              <p className="text-sm text-foreground font-medium leading-relaxed">
                {data.translation}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
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

    // If popup would go below viewport, show above the word
    const spaceBelow = window.innerHeight - position.y;
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
            ? window.innerHeight - position.y + 24
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

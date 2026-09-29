import { useState } from "react";
import { Volume2, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { speakWithTTS } from "@/lib/tts";

const LIST_NAME = "Từ phát âm cần luyện";

const PronunciationPractice = ({ words }: { words: { word: string; issue?: string }[] }) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const map = new Map<string, { word: string; issue: string }>();
  for (const w of words || []) {
    const word = String(w?.word ?? "").trim();
    if (!word) continue;
    const k = word.toLowerCase();
    if (!map.has(k)) map.set(k, { word, issue: String(w?.issue ?? "") });
  }
  const list = [...map.values()];
  if (!list.length) return null;

  const add = async (word: string) => {
    if (!user) return;
    setBusy(word);
    try {
      let { data: lst } = await supabase.from("vocab_lists").select("id").eq("user_id", user.id).eq("name", LIST_NAME).maybeSingle();
      if (!lst) {
        const ins = await supabase.from("vocab_lists").insert({ user_id: user.id, name: LIST_NAME }).select("id").single();
        lst = ins.data;
      }
      if (!lst) return;
      const { error } = await supabase.from("vocab_items").upsert(
        { user_id: user.id, word, vocab_set_id: lst.id, status: "new" } as any,
        { onConflict: "user_id,word,vocab_set_id" },
      );
      if (!error) setSaved((p) => new Set(p).add(word));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">🗣️ Luyện phát âm</h3>
      <div className="space-y-2">
        {list.map(({ word, issue }) => (
          <div key={word} className="flex flex-wrap items-center gap-2 border-b border-border last:border-0 pb-2 last:pb-0">
            <span className="font-semibold text-sm text-foreground">{word}</span>
            {issue && <span className="text-xs text-muted-foreground flex-1 min-w-[140px]">{issue}</span>}
            <div className="flex gap-1.5 ml-auto">
              <button onClick={() => speakWithTTS(word, "en")} className="p-1.5 rounded-lg bg-muted hover:bg-muted/70" aria-label="Nghe phát âm chuẩn">
                <Volume2 className="w-4 h-4" />
              </button>
              {user && (
                <button
                  onClick={() => add(word)}
                  disabled={saved.has(word) || busy === word}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary disabled:opacity-60"
                >
                  {saved.has(word) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {saved.has(word) ? "Đã thêm" : "Thêm vào kho từ"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PronunciationPractice;

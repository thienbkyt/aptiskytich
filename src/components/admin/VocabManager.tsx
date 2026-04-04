import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { readExcelFile } from "@/lib/excelUtils";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Download,
  FileSpreadsheet,
} from "lucide-react";

interface VocabSet {
  id: string;
  group_name: string;
  title: string;
  description: string;
  word_count: number;
  is_published: boolean;
  created_at: string;
}

interface VocabWord {
  id?: string;
  word: string;
  phonetic: string;
  meaning: string;
  example_en: string;
  example_vi: string;
  word_family: string[];
  order_index: number;
}

const VocabManager = () => {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);

  // Form state for new set
  const [newTitle, setNewTitle] = useState("");
  const [newGroup, setNewGroup] = useState("APTIS");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Excel import
  const [importing, setImporting] = useState(false);

  const fetchSets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_vocab_sets")
      .select("*")
      .order("created_at", { ascending: false });
    setSets((data as VocabSet[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSets(); }, []);

  const fetchWords = async (setId: string) => {
    setWordsLoading(true);
    const { data } = await supabase
      .from("system_vocab_words")
      .select("*")
      .eq("vocab_set_id", setId)
      .order("order_index", { ascending: true });
    setWords(
      (data ?? []).map((w: any) => ({
        ...w,
        word_family: Array.isArray(w.word_family) ? w.word_family : [],
      }))
    );
    setWordsLoading(false);
  };

  const handleSelectSet = (set: VocabSet) => {
    setSelectedSet(set);
    fetchWords(set.id);
  };

  const handleCreateSet = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("system_vocab_sets").insert({
      title: newTitle.trim(),
      group_name: newGroup.trim() || "APTIS",
      description: newDesc.trim(),
    });
    if (!error) {
      toast({ title: "Đã tạo bộ từ vựng ✓" });
      setNewTitle("");
      setNewDesc("");
      fetchSets();
    } else {
      toast({ title: "Lỗi: " + error.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const handleTogglePublish = async (set: VocabSet) => {
    const { error } = await supabase
      .from("system_vocab_sets")
      .update({ is_published: !set.is_published })
      .eq("id", set.id);
    if (!error) {
      setSets((prev) =>
        prev.map((s) => (s.id === set.id ? { ...s, is_published: !s.is_published } : s))
      );
    }
  };

  const handleDeleteSet = async (id: string) => {
    if (!confirm("Xóa bộ từ vựng này? Tất cả từ bên trong sẽ bị xóa.")) return;
    const { error } = await supabase.from("system_vocab_sets").delete().eq("id", id);
    if (!error) {
      setSets((prev) => prev.filter((s) => s.id !== id));
      if (selectedSet?.id === id) setSelectedSet(null);
      toast({ title: "Đã xóa ✓" });
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const { sheetNames, sheets } = await readExcelFile(buffer);

      let totalImported = 0;

      for (const sheetName of sheetNames) {
        const rows = sheets[sheetName];
        if (!rows || rows.length === 0) continue;

        // Create the set
        const { data: setData, error: setErr } = await supabase
          .from("system_vocab_sets")
          .insert({
            title: sheetName,
            group_name: newGroup.trim() || "APTIS",
            description: `Imported from ${file.name}`,
            word_count: rows.length,
          })
          .select()
          .single();

        if (setErr || !setData) continue;

        // Map rows to words
        const wordsToInsert = rows.map((row: any, idx: number) => ({
          vocab_set_id: setData.id,
          word: String(row.word || row.Word || "").trim(),
          phonetic: String(row.phonetic || row.Phonetic || "").trim(),
          meaning: String(row.meaning || row.Meaning || "").trim(),
          example_en: String(row.example_en || row.example || row.Example || "").trim(),
          example_vi: String(row.example_vi || row.ExampleVi || "").trim(),
          word_family: parseWordFamily(row.word_family || row.WordFamily || ""),
          order_index: idx,
        })).filter((w: any) => w.word);

        if (wordsToInsert.length > 0) {
          await supabase.from("system_vocab_words").insert(wordsToInsert);
          // Update word_count
          await supabase.from("system_vocab_sets").update({ word_count: wordsToInsert.length }).eq("id", setData.id);
          totalImported += wordsToInsert.length;
        }
      }

      toast({ title: `Đã import ${totalImported} từ từ ${sheetNames.length} sheet ✓` });
      fetchSets();
    } catch (err: any) {
      toast({ title: "Lỗi đọc file: " + err.message, variant: "destructive" });
    }

    setImporting(false);
    e.target.value = "";
  };

  function parseWordFamily(val: any): string[] {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim()) {
      return val.split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  }

  // ─── Word detail view ───
  if (selectedSet) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSet(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-heading font-bold text-foreground">{selectedSet.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedSet.group_name} · {selectedSet.word_count} từ</p>
          </div>
        </div>

        {/* Add word form */}
        <AddWordForm setId={selectedSet.id} onAdded={() => {
          fetchWords(selectedSet.id);
          // Update count
          setSets(prev => prev.map(s => s.id === selectedSet.id ? { ...s, word_count: s.word_count + 1 } : s));
          setSelectedSet(prev => prev ? { ...prev, word_count: prev.word_count + 1 } : prev);
        }} />

        {wordsLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : words.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có từ nào. Thêm từ hoặc import Excel.</p>
        ) : (
          <div className="space-y-2">
            {words.map((w, i) => (
              <Card key={w.id || i} className="border border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{w.word} <span className="text-muted-foreground font-normal text-sm">{w.phonetic}</span></p>
                    <p className="text-sm text-muted-foreground truncate">{w.meaning}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                    onClick={async () => {
                      if (!w.id) return;
                      await supabase.from("system_vocab_words").delete().eq("id", w.id);
                      setWords(prev => prev.filter(x => x.id !== w.id));
                      const { count } = await supabase
                        .from("system_vocab_words")
                        .select("*", { count: "exact", head: true })
                        .eq("vocab_set_id", selectedSet.id);
                      const newCount = count ?? 0;
                      await supabase.from("system_vocab_sets").update({ word_count: newCount }).eq("id", selectedSet.id);
                      setSelectedSet(prev => prev ? { ...prev, word_count: newCount } : prev);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Set list view ───
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-foreground">Quản lý bộ từ vựng hệ thống</h2>
      </div>

      {/* Create new set */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold text-sm text-foreground">Tạo bộ từ vựng mới</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nhóm</Label>
              <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="APTIS" />
            </div>
            <div>
              <Label className="text-xs">Tiêu đề *</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Test 1 – Animals" />
            </div>
            <div>
              <Label className="text-xs">Mô tả</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Mô tả ngắn" />
            </div>
          </div>
          <Button onClick={handleCreateSet} disabled={!newTitle.trim() || creating} className="gap-1.5">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tạo
          </Button>
        </CardContent>
      </Card>

      {/* Excel import */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <p className="font-semibold text-sm text-foreground">Import từ Excel</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Mỗi sheet = 1 bộ từ vựng. Cột: <code>word</code>, <code>phonetic</code>, <code>meaning</code>, <code>example_en</code>, <code>example_vi</code>, <code>word_family</code> (ngăn bởi dấu phẩy)
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-1.5 relative" disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Đang import..." : "Chọn file Excel"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleExcelImport}
                disabled={importing}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => {
                import("@/lib/excelUtils").then(({ createAndDownloadExcel }) => {
                  createAndDownloadExcel("vocab_template.xlsx", [
                    {
                      name: "Animals & Nature",
                      cols: [
                        { word: "habitat", phonetic: "/ˈhæb.ɪ.tæt/", meaning: "môi trường sống", example_en: "The forest is a natural habitat.", example_vi: "Rừng là môi trường sống tự nhiên.", word_family: "habitation (n), habitable (adj)" },
                      ],
                    },
                  ]);
                });
              }}
            >
              <Download className="w-3.5 h-3.5" /> Tải template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sets list */}
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : sets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Chưa có bộ từ vựng nào.</p>
      ) : (
        <div className="space-y-2">
          {sets.map((set) => (
            <Card key={set.id} className="border border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSelectSet(set)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{set.title}</h3>
                    <Badge variant="outline" className="text-xs">{set.group_name}</Badge>
                    {set.is_published && <Badge className="text-xs bg-green-500/10 text-green-600 border-green-300">Published</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{set.word_count} từ · {new Date(set.created_at).toLocaleDateString("vi-VN")}</p>
                </div>
                <Switch checked={set.is_published} onCheckedChange={() => handleTogglePublish(set)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSet(set.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSelectSet(set)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Add single word form ─── */
function AddWordForm({ setId, onAdded }: { setId: string; onAdded: () => void }) {
  const [word, setWord] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [meaning, setMeaning] = useState("");
  const [exampleEn, setExampleEn] = useState("");
  const [exampleVi, setExampleVi] = useState("");
  const [wordFamily, setWordFamily] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!word.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("system_vocab_words").insert({
      vocab_set_id: setId,
      word: word.trim(),
      phonetic: phonetic.trim(),
      meaning: meaning.trim(),
      example_en: exampleEn.trim(),
      example_vi: exampleVi.trim(),
      word_family: wordFamily.split(/[,;|]/).map(s => s.trim()).filter(Boolean),
    });
    if (!error) {
      // Update word_count in DB
      const { count } = await supabase
        .from("system_vocab_words")
        .select("*", { count: "exact", head: true })
        .eq("vocab_set_id", setId);
      if (count !== null) {
        await supabase.from("system_vocab_sets").update({ word_count: count }).eq("id", setId);
      }
      toast({ title: `Đã thêm "${word.trim()}" ✓` });
      setWord(""); setPhonetic(""); setMeaning(""); setExampleEn(""); setExampleVi(""); setWordFamily("");
      onAdded();
    } else {
      toast({ title: "Lỗi: " + error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Card className="border border-dashed border-primary/30">
      <CardContent className="p-4 space-y-3">
        <p className="font-semibold text-sm text-foreground">Thêm từ mới</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input placeholder="word *" value={word} onChange={e => setWord(e.target.value)} />
          <Input placeholder="phonetic" value={phonetic} onChange={e => setPhonetic(e.target.value)} />
          <Input placeholder="meaning" value={meaning} onChange={e => setMeaning(e.target.value)} />
          <Input placeholder="example (EN)" value={exampleEn} onChange={e => setExampleEn(e.target.value)} />
          <Input placeholder="example (VI)" value={exampleVi} onChange={e => setExampleVi(e.target.value)} />
          <Input placeholder="word family (phẩy ngăn)" value={wordFamily} onChange={e => setWordFamily(e.target.value)} />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!word.trim() || saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Thêm từ
        </Button>
      </CardContent>
    </Card>
  );
}

export default VocabManager;

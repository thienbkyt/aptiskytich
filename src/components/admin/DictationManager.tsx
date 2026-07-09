import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2, Plus, ListMusic } from "lucide-react";

type DictationSet = {
  id: string;
  title: string;
  level: number | null;
  sort: number | null;
  sentence_count?: number;
};

type Sentence = {
  id: string;
  set_id: string;
  text: string;
  sort: number | null;
};

const DictationManager = () => {
  const [sets, setSets] = useState<DictationSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DictationSet | null>(null);

  const loadSets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dictation_sets")
      .select("id, title, level, sort")
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Lỗi tải bộ", description: error.message, variant: "destructive" });
      setSets([]);
      setLoading(false);
      return;
    }
    const list = (data || []) as DictationSet[];
    if (list.length) {
      const { data: counts } = await supabase
        .from("dictation_sentences")
        .select("set_id")
        .in("set_id", list.map((s) => s.id));
      const map = new Map<string, number>();
      (counts || []).forEach((r: any) => map.set(r.set_id, (map.get(r.set_id) || 0) + 1));
      list.forEach((s) => (s.sentence_count = map.get(s.id) || 0));
    }
    setSets(list);
    setLoading(false);
  };

  useEffect(() => {
    loadSets();
  }, []);

  if (selected) {
    return (
      <SentenceManager
        set={selected}
        onBack={() => {
          setSelected(null);
          loadSets();
        }}
      />
    );
  }

  return (
    <SetsList
      sets={sets}
      loading={loading}
      onReload={loadSets}
      onOpen={(s) => setSelected(s)}
    />
  );
};

/* -------------------- Sets List -------------------- */
const SetsList = ({
  sets,
  loading,
  onReload,
  onOpen,
}: {
  sets: DictationSet[];
  loading: boolean;
  onReload: () => void;
  onOpen: (s: DictationSet) => void;
}) => {
  const [editing, setEditing] = useState<DictationSet | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DictationSet | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("dictation_sets").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Xoá thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã xoá bộ luyện" });
      setDeleteTarget(null);
      onReload();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Quản lý Nghe chép chính tả</h2>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Tạo bộ mới
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : sets.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Chưa có bộ luyện nào.</Card>
      ) : (
        <div className="grid gap-3">
          {sets.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{s.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    Level {s.level ?? 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Sort: {s.sort ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.sentence_count ?? 0} câu
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpen(s)}>
                  Câu trong bộ
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(s)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SetDialog
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onReload();
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bộ luyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Xoá "{deleteTarget?.title}" và toàn bộ câu bên trong. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const SetDialog = ({
  initial,
  onClose,
  onSaved,
}: {
  initial: DictationSet | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [level, setLevel] = useState<number>(initial?.level ?? 1);
  const [sort, setSort] = useState<number>(initial?.sort ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Nhập tiêu đề", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { title: title.trim(), level, sort };
    const q = initial
      ? supabase.from("dictation_sets").update(payload).eq("id", initial.id)
      : supabase.from("dictation_sets").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: initial ? "Đã cập nhật bộ" : "Đã tạo bộ" });
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa bộ luyện" : "Tạo bộ luyện"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tiêu đề</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bộ 1 - Câu ngắn cơ bản" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Level</Label>
              <Input
                type="number"
                value={level}
                min={1}
                onChange={(e) => setLevel(parseInt(e.target.value || "1", 10))}
              />
            </div>
            <div>
              <Label>Thứ tự (sort)</Label>
              <Input
                type="number"
                value={sort}
                onChange={(e) => setSort(parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu…" : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------- Sentence Manager -------------------- */
const SentenceManager = ({ set, onBack }: { set: DictationSet; onBack: () => void }) => {
  const [items, setItems] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sentence | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sentence | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dictation_sentences")
      .select("id, set_id, text, sort")
      .eq("set_id", set.id)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Lỗi tải câu", description: error.message, variant: "destructive" });
    }
    setItems((data || []) as Sentence[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [set.id]);

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[index];
    const b = items[j];
    const aSort = a.sort ?? index;
    const bSort = b.sort ?? j;
    // swap sort values
    const { error: e1 } = await supabase.from("dictation_sentences").update({ sort: bSort }).eq("id", a.id);
    const { error: e2 } = await supabase.from("dictation_sentences").update({ sort: aSort }).eq("id", b.id);
    if (e1 || e2) {
      toast({ title: "Sắp xếp thất bại", description: (e1 || e2)?.message, variant: "destructive" });
    }
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("dictation_sentences").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Xoá thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã xoá câu" });
      setDeleteTarget(null);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{set.title}</h2>
            <p className="text-xs text-muted-foreground">Level {set.level ?? 1} · {items.length} câu</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Thêm câu
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Chưa có câu nào trong bộ.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <Card key={it.id} className="p-3 flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground w-10 shrink-0">#{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground">{it.text}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(it)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(it)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SentenceDialog
          setId={set.id}
          initial={editing}
          nextSort={items.length ? (Math.max(...items.map((i) => i.sort ?? 0)) + 1) : 0}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá câu?</AlertDialogTitle>
            <AlertDialogDescription>Hành động không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const SentenceDialog = ({
  setId,
  initial,
  nextSort,
  onClose,
  onSaved,
}: {
  setId: string;
  initial: Sentence | null;
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [text, setText] = useState(initial?.text ?? "");
  const [sort, setSort] = useState<number>(initial?.sort ?? nextSort);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      toast({ title: "Nhập câu tiếng Anh", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { set_id: setId, text: text.trim(), sort };
    const q = initial
      ? supabase.from("dictation_sentences").update({ text: payload.text, sort: payload.sort }).eq("id", initial.id)
      : supabase.from("dictation_sentences").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: initial ? "Đã cập nhật câu" : "Đã thêm câu" });
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa câu" : "Thêm câu"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Câu tiếng Anh</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="e.g. The library opens at nine every morning."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Trang luyện sẽ tự phát bằng TTS — không cần upload audio.
            </p>
          </div>
          <div>
            <Label>Thứ tự (sort)</Label>
            <Input
              type="number"
              value={sort}
              onChange={(e) => setSort(parseInt(e.target.value || "0", 10))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu…" : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DictationManager;

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HeartHandshake, Plus, Trash2, Pencil, Flag, Loader2, Search, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SkillKey = "speaking" | "listening" | "reading" | "writing" | "grammar_vocab";

const SKILLS: { key: SkillKey; label: string; parts: string[] }[] = [
  { key: "speaking", label: "Speaking", parts: ["Part 1", "Part 2", "Part 3", "Part 4"] },
  { key: "listening", label: "Listening", parts: ["Part 1", "Part 2", "Part 3", "Part 4"] },
  { key: "reading", label: "Reading", parts: ["Part 1", "Part 2", "Part 3", "Part 4", "Part 5"] },
  { key: "writing", label: "Writing", parts: ["Part 1", "Part 2", "Part 3", "Part 4"] },
  { key: "grammar_vocab", label: "Grammar & Vocabulary", parts: ["Grammar", "Vocabulary"] },
];

const skillLabel = (k: string) => SKILLS.find((s) => s.key === k)?.label || k;
const partsOf = (k: SkillKey) => SKILLS.find((s) => s.key === k)?.parts || ["Part 1"];

/* 18 ô nhập trải sẵn, gom theo 5 khối kỹ năng */
const SLOT_GROUPS: { skill: SkillKey; label: string; slots: { part: string; label: string }[] }[] = [
  {
    skill: "speaking",
    label: "Speaking",
    slots: [
      { part: "Part 1", label: "Part 1 — Personal" },
      { part: "Part 2", label: "Part 2 — Describe a picture" },
      { part: "Part 3", label: "Part 3 — Compare pictures" },
      { part: "Part 4", label: "Part 4 — Opinion" },
    ],
  },
  {
    skill: "listening",
    label: "Listening",
    slots: [
      { part: "Part 1", label: "Part 1 — Word recognition" },
      { part: "Part 2", label: "Part 2 — Matching" },
      { part: "Part 3", label: "Part 3 — Conversations" },
      { part: "Part 4", label: "Part 4 — Monologues" },
    ],
  },
  {
    skill: "grammar_vocab",
    label: "Grammar & Vocabulary",
    slots: [
      { part: "Grammar", label: "Grammar" },
      { part: "Vocabulary", label: "Vocabulary" },
    ],
  },
  {
    skill: "reading",
    label: "Reading",
    slots: [
      { part: "Part 1", label: "Part 1 — Sentence" },
      { part: "Part 2", label: "Part 2 — Cohesion" },
      { part: "Part 3", label: "Part 3 — Gap fill" },
      { part: "Part 4", label: "Part 4 — Long text" },
    ],
  },
  {
    skill: "writing",
    label: "Writing",
    slots: [
      { part: "Part 1", label: "Part 1 — Short answers" },
      { part: "Part 2", label: "Part 2 — Social media" },
      { part: "Part 3", label: "Part 3 — Three questions" },
      { part: "Part 4", label: "Part 4 — Emails" },
    ],
  },
];

const slotKey = (skill: string, part: string) => `${skill}|${part}`;
const emptySlots = (): Record<string, string> => ({});


type Item = { id?: string; skill: SkillKey; part: string; topic: string };
type ReviewRow = {
  id: string;
  exam_date: string;
  note: string | null;
  created_at: string;
  user_id: string;
  author_name: string | null;
  hidden_at?: string | null;
  hidden_reason?: string | null;
  items: Item[];
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const ReviewsPage = () => {
  usePageMeta({
    title: "Review tích đức — Học viên chia sẻ lại sau khi thi | Aptis Kỳ Tích",
    description:
      "Khu vực Review tích đức: học viên chia sẻ lại trải nghiệm sau buổi thi cho cộng đồng Aptis Kỳ Tích. Chỉ dành cho thành viên đã đăng nhập.",
    path: "/reviews",
    noindex: true,
  });

  const { user, isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState<"all" | SkillKey>("all");
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [examDate, setExamDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"free" | "parts">("free");
  const [freeText, setFreeText] = useState("");
  const [slots, setSlots] = useState<Record<string, string>>(emptySlots());
  const [saving, setSaving] = useState(false);

  /* Admin moderation state */
  const [hideTarget, setHideTarget] = useState<ReviewRow | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [delTarget, setDelTarget] = useState<ReviewRow | null>(null);
  const [modBusy, setModBusy] = useState(false);


  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("list_exam_reviews");
    if (error) toast.error("Không tải được danh sách review.");
    setRows(((data as any[]) || []) as ReviewRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Switch to edit mode automatically when the chosen date already has a review
  const existingForDate = useMemo(
    () => rows.find((r) => r.user_id === user?.id && r.exam_date === examDate) || null,
    [rows, user, examDate],
  );

  const hydrate = useCallback((r: ReviewRow) => {
    const nextSlots = emptySlots();
    (r.items || []).forEach((i) => {
      if (i.topic?.trim()) nextSlots[slotKey(i.skill, i.part)] = i.topic;
    });
    setSlots(nextSlots);
    if ((r.items || []).length > 0) {
      setMode("parts");
      setFreeText("");
      setNote(r.note || "");
    } else {
      setMode("free");
      setFreeText(r.note || "");
      setNote("");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (existingForDate && editingId !== existingForDate.id) {
      setEditingId(existingForDate.id);
      hydrate(existingForDate);
    } else if (!existingForDate && editingId) {
      setEditingId(null);
    }
  }, [open, existingForDate, editingId, hydrate]);

  const openCreate = () => {
    setExamDate(todayISO());
    setEditingId(null);
    setNote("");
    setMode("free");
    setFreeText("");
    setSlots(emptySlots());
    setOpen(true);
  };

  const openEdit = (r: ReviewRow) => {
    setExamDate(r.exam_date);
    setEditingId(r.id);
    hydrate(r);
    setOpen(true);
  };

  const filledSlots = useMemo(
    () =>
      SLOT_GROUPS.flatMap((g) =>
        g.slots.map((s) => ({ skill: g.skill, part: s.part, topic: (slots[slotKey(g.skill, s.part)] || "").trim() })),
      ).filter((s) => s.topic.length > 0),
    [slots],
  );

  const canSubmit = mode === "free" ? freeText.trim().length > 0 : filledSlots.length > 0;

  const save = async () => {
    if (!user) return;
    const clean: Item[] = mode === "parts" ? (filledSlots as Item[]) : [];
    const finalNote =
      mode === "free"
        ? [freeText.trim(), note.trim()].filter(Boolean).join("\n\n")
        : note.trim();

    if (mode === "free" && !freeText.trim()) {
      toast.error("Bạn hãy gõ lại nội dung đề bạn còn nhớ nhé.");
      return;
    }
    if (mode === "parts" && !clean.length) {
      toast.error("Cần điền ít nhất một part.");
      return;
    }
    setSaving(true);
    try {
      let reviewId = editingId;
      if (reviewId) {
        const { error } = await supabase
          .from("exam_reviews")
          .update({ note: finalNote || null })
          .eq("id", reviewId);
        if (error) throw error;
        await supabase.from("exam_review_items").delete().eq("review_id", reviewId);
      } else {
        const { data, error } = await supabase
          .from("exam_reviews")
          .insert({ user_id: user.id, exam_date: examDate, note: finalNote || null })
          .select("id")
          .single();
        if (error) throw error;
        reviewId = data.id;
      }
      if (clean.length) {
        const { error: itemsErr } = await supabase
          .from("exam_review_items")
          .insert(clean.map((i) => ({ review_id: reviewId, skill: i.skill, part: i.part, topic: i.topic })));
        if (itemsErr) throw itemsErr;
      }
      toast.success(editingId ? "Đã cập nhật review của bạn." : "Đã chia sẻ, cảm ơn bạn nhiều!");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Không lưu được, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  };


  const remove = async (r: ReviewRow) => {
    if (!confirm("Xoá review này?")) return;
    const { error } = await supabase.from("exam_reviews").delete().eq("id", r.id);
    if (error) return toast.error("Không xoá được.");
    toast.success("Đã xoá review.");
    load();
  };

  const report = async (r: ReviewRow) => {
    if (!user) return;
    const { error } = await supabase.from("question_reports").insert({
      user_id: user.id,
      reason: "Nội dung review không phù hợp",
      report_category: "review_abuse",
      note: r.id,
      section: "reviews",
      page_url: window.location.href,
    });
    if (error) return toast.error("Không gửi được báo cáo.");
    toast.success("Đã gửi báo cáo, đội ngũ sẽ kiểm tra.");
  };

  const applyHidden = async (r: ReviewRow, hidden: boolean, reason?: string) => {
    setModBusy(true);
    const { error } = await supabase.rpc("admin_set_review_hidden", {
      p_review_id: r.id,
      p_hidden: hidden,
      p_reason: reason?.trim() || null,
    });
    setModBusy(false);
    if (error) return toast.error(error.message || "Không thực hiện được.");
    toast.success(hidden ? "Đã ẩn review." : "Đã bỏ ẩn review.");
    setHideTarget(null);
    setHideReason("");
    load();
  };

  const adminDelete = async (r: ReviewRow) => {
    setModBusy(true);
    const { error } = await supabase.rpc("admin_delete_review", { p_review_id: r.id });
    setModBusy(false);
    if (error) return toast.error(error.message || "Không xoá được.");
    toast.success("Đã xoá vĩnh viễn review.");
    setDelTarget(null);
    load();
  };



  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((r) => ({
        ...r,
        items: (r.items || []).filter(
          (i) =>
            (skillFilter === "all" || i.skill === skillFilter) &&
            (!q || i.topic.toLowerCase().includes(q)),
        ),
      }))
      .filter((r) => r.items.length > 0 || (skillFilter === "all" && !q));
  }, [rows, skillFilter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ReviewRow[]>();
    filtered.forEach((r) => {
      const arr = map.get(r.exam_date) || [];
      arr.push(r);
      map.set(r.exam_date, arr);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-[112px] md:pt-16">
          <div className="section-container py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <HeartHandshake className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold mt-5">Review tích đức</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
              Khu vực này chỉ dành cho thành viên đã đăng nhập. Đăng nhập để xem phần chia sẻ của học viên
              và gửi review của bạn.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Đăng nhập</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5 text-primary" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                    Review tích đức
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Học viên chia sẻ lại sau khi thi về để giúp các bạn thi sau ôn đúng hướng. Admin sẽ tổng
                  hợp lại và làm dự đoán đề free cho tất cả mọi người kể cả không ôn luyện tại web.
                </p>
              </div>
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Review tích đức
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <div className="w-full sm:w-56">
                <Select value={skillFilter} onValueChange={(v) => setSkillFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kỹ năng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả kỹ năng</SelectItem>
                    {SKILLS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo topic…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="section-container py-8 space-y-8">
          {loading ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Chưa có review nào phù hợp.
            </div>
          ) : (
            groups.map(([date, list]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-heading font-bold text-foreground">Ngày thi {formatDate(date)}</h2>
                  <Badge variant="outline">{list.length} review</Badge>
                </div>
                <div className="space-y-4">
                  {list.map((r) => (
                    <article key={r.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{r.author_name || "Học viên"}</span>
                          <span className="text-muted-foreground">· gửi lúc {formatTime(r.created_at)}</span>
                          {r.hidden_at && (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">
                              {r.user_id === user?.id && !isAdmin
                                ? "Đang ẩn - chỉ mình bạn thấy"
                                : r.hidden_reason
                                  ? `Đang ẩn · ${r.hidden_reason}`
                                  : "Đang ẩn"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.user_id === user?.id && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(r)}>
                                <Pencil className="w-3.5 h-3.5" /> Sửa
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => remove(r)}>
                                <Trash2 className="w-3.5 h-3.5" /> Xoá
                              </Button>
                            </>
                          )}
                          {r.user_id !== user?.id && (
                            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => report(r)}>
                              <Flag className="w-3.5 h-3.5" /> Báo cáo nội dung
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              {r.hidden_at ? (
                                <Button size="sm" variant="outline" className="gap-1" disabled={modBusy} onClick={() => applyHidden(r, false)}>
                                  <Eye className="w-3.5 h-3.5" /> Bỏ ẩn
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setHideReason("");
                                    setHideTarget(r);
                                  }}
                                >
                                  <EyeOff className="w-3.5 h-3.5" /> Ẩn
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="gap-1 text-primary" onClick={() => setDelTarget(r)}>
                                <Trash2 className="w-3.5 h-3.5" /> Xoá
                              </Button>
                            </>
                          )}
                        </div>
                      </div>


                      {r.items && r.items.length > 0 && (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase text-muted-foreground">
                                <th className="py-2 pr-4 font-medium">Kỹ năng</th>
                                <th className="py-2 pr-4 font-medium">Part</th>
                                <th className="py-2 font-medium">Topic</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((i, idx) => (
                                <tr key={i.id || idx} className="border-t border-border/60">
                                  <td className="py-2 pr-4 whitespace-nowrap">{skillLabel(i.skill)}</td>
                                  <td className="py-2 pr-4 whitespace-nowrap">{i.part}</td>
                                  <td className="py-2">{i.topic}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}


                      {r.note && (
                        <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap border-t border-border/60 pt-3">
                          {r.note}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
      <Footer />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa review của bạn" : "Review tích đức"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Ngày thi</div>
              <Input
                type="date"
                value={examDate}
                max={todayISO()}
                disabled={!!editingId}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-48"
              />
              {editingId && (
                <p className="text-xs text-[#B26A00] mt-2">
                  Bạn đã chia sẻ đề ngày này rồi — đang sửa lại.
                </p>
              )}
            </div>

            {/* Hai chế độ */}
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setMode("free")}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  mode === "free" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                Gõ tự do
              </button>
              <button
                type="button"
                onClick={() => setMode("parts")}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  mode === "parts" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                Review theo từng part
              </button>
            </div>

            {mode === "free" ? (
              <Textarea
                rows={9}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="VD: Speaking Part 2 mình được tả cái ảnh nhóm bạn đi biển, Part 4 hỏi về thói quen đọc sách. Reading Part 4 bài về môi trường hơi dài…"
              />
            ) : (
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  Nhớ được part nào điền part đó, bỏ trống phần không nhớ cũng được.
                </p>
                {SLOT_GROUPS.map((g) => (
                  <div key={g.skill} className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">{g.label}</div>
                    {g.slots.map((s) => {
                      const k = slotKey(g.skill, s.part);
                      return (
                        <div key={k} className="grid gap-2 sm:grid-cols-[13rem_1fr] items-center">
                          <div className="text-sm text-muted-foreground">{s.label}</div>
                          <Input
                            placeholder="điền nội dung bạn nhớ, không nhớ thì để trống nha..."
                            value={slots[k] || ""}
                            onChange={(e) => setSlots((prev) => ({ ...prev, [k]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
                <p className="text-xs font-medium text-primary">Đã điền {filledSlots.length} part</p>
              </div>
            )}


            <div>
              <div className="text-sm font-medium mb-2">Ghi chú chung (không bắt buộc)</div>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cảm nhận chung, lưu ý cho bạn thi sau…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={saving || !canSubmit} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Lưu thay đổi" : "Chia sẻ ngay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewsPage;

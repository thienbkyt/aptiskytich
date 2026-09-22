import { useEffect, useMemo, useState } from "react";
import { Trophy, EyeOff, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { showcasePartLabel, showcaseSkillLabel } from "@/lib/showcase";

type Row = {
  id: string;
  user_id: string;
  test_result_id: string;
  skill: string;
  part_type: string;
  band: string;
  raw_part: number;
  status: string;
  display_name: string | null;
  content_text: string;
  question_texts: unknown;
  ai_check: any;
  extraction: any;
  created_at: string | null;
  approved_at: string | null;
  exam_sets?: { title: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  checking: "Đang kiểm",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  withdrawn: "Đã rút",
  hidden: "Đã ẩn",
};

const statusClass = (s: string) =>
  s === "approved"
    ? "bg-success/15 text-success border-0"
    : s === "rejected" || s === "hidden"
    ? "bg-destructive/15 text-destructive border-0"
    : "bg-muted text-muted-foreground border-0";

const ShowcaseAdminManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [skill, setSkill] = useState("all");
  const [band, setBand] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("showcase_entries")
        .select(
          "id,user_id,test_result_id,skill,part_type,band,raw_part,status,display_name,content_text,question_texts,ai_check,extraction,created_at,approved_at,exam_sets(title)",
        )
        .order("raw_part", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      toast({ title: "Không tải được danh sách", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (skill === "all" || r.skill === skill) &&
          (band === "all" || r.band === band),
      ),
    [rows, status, skill, band],
  );

  const hide = async (r: Row) => {
    setBusyId(r.id);
    try {
      const { error } = await (supabase as any)
        .from("showcase_entries")
        .update({ status: "hidden" })
        .eq("id", r.id);
      if (error) throw error;
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "hidden" } : x)));
      toast({ title: "Đã ẩn bài" });
    } catch (e: any) {
      toast({ title: "Không ẩn được bài", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const recheck = async (r: Row) => {
    setBusyId(r.id);
    try {
      const { error } = await (supabase as any)
        .from("showcase_entries")
        .update({ status: "checking", ai_check: null, approved_at: null })
        .eq("id", r.id);
      if (error) throw error;
      const { data } = await supabase.functions.invoke("showcase-review", {
        body: { entry_id: r.id },
      });
      const next = String((data as any)?.status || "checking");
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
      toast({
        title: "Đã duyệt lại",
        description: `Kết quả: ${STATUS_LABELS[next] || next}`,
      });
      void load();
    } catch (e: any) {
      toast({ title: "Không duyệt lại được", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Trophy className="w-4 h-4 text-primary" /> Bảng Kỳ Tích
          <span className="text-xs font-normal text-muted-foreground">({filtered.length} bài)</span>
        </div>
        <div className="flex-1" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={skill} onValueChange={setSkill}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cả 2 kỹ năng</SelectItem>
            <SelectItem value="writing">Writing</SelectItem>
            <SelectItem value="speaking">Speaking</SelectItem>
          </SelectContent>
        </Select>
        <Select value={band} onValueChange={setBand}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả band</SelectItem>
            <SelectItem value="C">C</SelectItem>
            <SelectItem value="B2">B2</SelectItem>
            <SelectItem value="B1">B1</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
          <RefreshCw className="w-3.5 h-3.5" /> Tải lại
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có bài nào khớp bộ lọc.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const open = openId === r.id;
            return (
              <Card key={r.id} className="p-4 bg-card border-border">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={statusClass(r.status)}>{STATUS_LABELS[r.status] || r.status}</Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {showcaseSkillLabel(r.skill)} · {showcasePartLabel(r.part_type)}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">Band {r.band}</Badge>
                      <span className="text-xs font-semibold text-foreground">{Number(r.raw_part)}/30</span>
                    </div>
                    <div className="mt-1 text-sm text-foreground truncate">
                      {r.exam_sets?.title || "Không rõ đề"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.display_name || "Ẩn danh"} · {r.created_at ? new Date(r.created_at).toLocaleString("vi-VN") : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Nội dung
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === r.id || r.status === "hidden"}
                      onClick={() => void hide(r)}
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Ẩn bài
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === r.id}
                      onClick={() => void recheck(r)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {busyId === r.id ? "Đang xử lý…" : "Duyệt lại"}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Đề bài</p>
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/50 rounded-md p-3">
                        {JSON.stringify(r.question_texts ?? [], null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Bài của học viên</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                        {r.content_text}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Kết quả AI kiểm (ai_check)</p>
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/50 rounded-md p-3">
                        {r.ai_check ? JSON.stringify(r.ai_check, null, 2) : "—"}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Phần trích (extraction)</p>
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-sans bg-muted/50 rounded-md p-3">
                        {r.extraction ? JSON.stringify(r.extraction, null, 2) : "—"}
                      </pre>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShowcaseAdminManager;

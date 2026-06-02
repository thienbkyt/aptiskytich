import { useState, useEffect } from "react";
import { Plus, BookOpen, Trash2, Eye, EyeOff, Pencil, Layers, FileSpreadsheet, Upload, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExamType, FULL_EXAM_SHEETS, SKILL_LABELS, Skill } from "./types";
import { readExcelFile, createAndDownloadExcel } from "@/lib/excelUtils";
import { parseSheet } from "./excelParsers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FullTestGroup {
  full_test_id: string;
  full_test_title: string;
  exam_type: string;
  parts: {
    id: string;
    skill: string;
    part: string;
    title: string;
    is_published: boolean;
    question_count?: number;
  }[];
}

interface Props {
  examType: ExamType;
  refreshKey: number;
  onRefresh: () => void;
}

const FullTestManager = ({ examType, refreshKey, onRefresh }: Props) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<FullTestGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [parsedSummary, setParsedSummary] = useState<{ label: string; count: number; skill: string }[] | null>(null);
  const [parsedFile, setParsedFile] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, title, skill, part, is_published, full_test_id, full_test_title, exam_type")
        .eq("exam_type", examType)
        .not("full_test_category", "is", null)
        .order("created_at", { ascending: false });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by full_test_id
      const map = new Map<string, FullTestGroup>();
      for (const row of data as any[]) {
        const ftId = row.full_test_id;
        if (!map.has(ftId)) {
          map.set(ftId, {
            full_test_id: ftId,
            full_test_title: row.full_test_title || "Full Test",
            exam_type: row.exam_type,
            parts: [],
          });
        }
        map.get(ftId)!.parts.push({
          id: row.id,
          skill: row.skill,
          part: row.part,
          title: row.title,
          is_published: row.is_published,
        });
      }

      // Load question counts
      const allIds = data.map((r: any) => r.id);
      if (allIds.length > 0) {
        const { data: counts } = await supabase
          .from("exam_questions")
          .select("exam_set_id")
          .in("exam_set_id", allIds);
        if (counts) {
          const countMap = new Map<string, number>();
          for (const c of counts) {
            countMap.set(c.exam_set_id, (countMap.get(c.exam_set_id) || 0) + 1);
          }
          for (const group of map.values()) {
            for (const p of group.parts) {
              p.question_count = countMap.get(p.id) || 0;
            }
          }
        }
      }

      setGroups(Array.from(map.values()));
      setLoading(false);
    };
    load();
  }, [examType, refreshKey]);

  const handleDeleteFullTest = async () => {
    if (!deleteId) return;
    const group = groups.find((g) => g.full_test_id === deleteId);
    if (!group) return;

    for (const part of group.parts) {
      await supabase.from("exam_questions").delete().eq("exam_set_id", part.id);
      await supabase.from("exam_sets").delete().eq("id", part.id);
    }
    setGroups((g) => g.filter((x) => x.full_test_id !== deleteId));
    setDeleteId(null);
    toast({ title: "Đã xóa Full Test và tất cả câu hỏi liên quan" });
    onRefresh();
  };

  const togglePublishAll = async (group: FullTestGroup, publish: boolean) => {
    for (const part of group.parts) {
      await supabase.from("exam_sets").update({ is_published: publish }).eq("id", part.id);
    }
    setGroups((gs) =>
      gs.map((g) =>
        g.full_test_id === group.full_test_id
          ? { ...g, parts: g.parts.map((p) => ({ ...p, is_published: publish })) }
          : g
      )
    );
    toast({ title: publish ? "Đã xuất bản Full Test" : "Đã ẩn Full Test" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { sheetNames, sheets } = await readExcelFile(buffer);

      const summary: { label: string; count: number; skill: string; questions: any[]; part: string }[] = [];

      for (const name of sheetNames) {
        const rows = sheets[name];
        if (!rows || rows.length === 0) continue;
        const parsed = parseSheet(name, rows);
        if (!parsed.mapping) continue;
        summary.push({
          label: parsed.mapping.label,
          count: parsed.questions.length,
          skill: parsed.mapping.skill,
          part: parsed.mapping.part,
          questions: parsed.questions,
        });
      }

      if (summary.length === 0) {
        toast({ title: "Không tìm thấy tab hợp lệ", variant: "destructive" });
        return;
      }

      setParsedSummary(summary);
      setParsedFile(summary);
    } catch {
      toast({ title: "Lỗi đọc file", variant: "destructive" });
    }
  };

  const handleImportFullTest = async () => {
    if (!importTitle.trim() || !parsedFile) return;
    setImporting(true);

    const fullTestId = crypto.randomUUID();
    let totalQuestions = 0;
    let setsCreated = 0;

    for (const sheet of parsedFile) {
      if (sheet.questions.length === 0) continue;

      const { data: setData, error: setErr } = await supabase
        .from("exam_sets")
        .insert({
          title: `${importTitle} - ${sheet.label}`,
          exam_type: examType,
          skill: sheet.skill,
          part: sheet.part,
          full_test_id: fullTestId,
          full_test_title: importTitle,
        } as any)
        .select("id")
        .single();

      if (setErr || !setData) continue;
      setsCreated++;

      const toInsert = sheet.questions.map((q: any) => ({
        ...q,
        exam_set_id: setData.id,
      }));

      const { error } = await supabase.from("exam_questions").insert(toInsert as any);
      if (!error) totalQuestions += toInsert.length;
    }

    setImporting(false);
    setParsedSummary(null);
    setParsedFile(null);
    setImportTitle("");
    setShowImport(false);
    toast({ title: `Đã tạo Full Test với ${setsCreated} parts, ${totalQuestions} câu hỏi!` });
    onRefresh();
  };

  const skillOrder = ["speaking", "listening", "grammar_vocab", "reading", "writing"];

  if (loading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Full Test — {examType === "general" ? "General" : "Advanced"}
        </h2>
        <Button onClick={() => setShowImport(!showImport)} className="gap-2">
          <Plus className="w-4 h-4" /> Tạo Full Test mới
        </Button>
      </div>

      {/* Import section */}
      {showImport && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-bold text-foreground">Import Full Test từ Excel</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload file Excel với đầy đủ các tab (Core_Grammar, V_Part1-5, R_Part1-4, L_Part1-4, S_Part1-4, W_Part1-4) để tạo trọn bộ đề thi.
          </p>

          <div>
            <Label>Tên đề Full Test</Label>
            <Input
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="VD: Aptis Full Test #1"
              className="mt-1"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".xlsx,.xls";
              input.onchange = (e) => handleFileSelect(e as any);
              input.click();
            }}>
              <Upload className="w-4 h-4" /> Chọn file Excel
            </Button>
          </div>

          {/* Preview Summary */}
          {parsedSummary && (
            <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
              <h4 className="font-semibold text-foreground text-sm">📋 Tổng quan đề Full Test:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {parsedSummary.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant={s.count > 0 ? "default" : "secondary"} className="text-xs">
                      {s.count}
                    </Badge>
                    <span className="text-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground">
                  Tổng: <span className="text-primary font-bold">{parsedSummary.reduce((s, x) => s + x.count, 0)}</span> câu hỏi
                  trong <span className="text-primary font-bold">{parsedSummary.length}</span> parts
                </p>
              </div>
              <Button
                onClick={handleImportFullTest}
                disabled={importing || !importTitle.trim()}
                className="w-full gap-2"
              >
                {importing ? "Đang nhập..." : <><Upload className="w-4 h-4" /> Lưu Full Test</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Full Test Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Chưa có đề Full Test nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedId === group.full_test_id;
            const allPublished = group.parts.every((p) => p.is_published);
            const totalQs = group.parts.reduce((s, p) => s + (p.question_count || 0), 0);
            const sortedParts = [...group.parts].sort(
              (a, b) => skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill)
            );

            return (
              <div key={group.full_test_id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : group.full_test_id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Layers className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{group.full_test_title}</h3>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                          Full Test
                        </Badge>
                        <Badge variant={allPublished ? "default" : "secondary"} className="text-xs">
                          {allPublished ? "Đã xuất bản" : "Nháp"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.parts.length} parts · {totalQs} câu hỏi
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); togglePublishAll(group, !allPublished); }}
                      title={allPublished ? "Ẩn tất cả" : "Xuất bản tất cả"}
                    >
                      {allPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(group.full_test_id); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Parts */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {sortedParts.map((part) => (
                      <div key={part.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {SKILL_LABELS[part.skill as Skill] || part.skill}
                          </Badge>
                          <span className="text-sm text-foreground">{part.part}</span>
                          <span className="text-xs text-muted-foreground">({part.question_count || 0} câu)</span>
                        </div>
                        <Badge variant={part.is_published ? "default" : "secondary"} className="text-xs">
                          {part.is_published ? "✓" : "Nháp"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ Full Test?</AlertDialogTitle>
            <AlertDialogDescription>
              Tất cả các parts và câu hỏi trong bộ đề này sẽ bị xóa vĩnh viễn. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFullTest} className="bg-destructive text-destructive-foreground">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FullTestManager;

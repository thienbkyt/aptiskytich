import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, Sparkles, BookOpen, FolderOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExamType, Skill, SKILL_LABELS, SKILL_PARTS, ExamSetRow, ExcelImportRow } from "./types";
import ExamSetList from "./ExamSetList";
import SmartForm from "./SmartForm";
import ExcelImport from "./ExcelImport";
import AiParser from "./AiParser";
import MediaLibrary from "./MediaLibrary";
import FullTestManager from "./FullTestManager";

const ImportCenter = () => {
  const [examType, setExamType] = useState<ExamType>("general");
  const [skill, setSkill] = useState<Skill>("grammar_vocab");
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingSet, setEditingSet] = useState<ExamSetRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prefillQuestions, setPrefillQuestions] = useState<ExcelImportRow[] | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const editSetId = searchParams.get("editSet");
    if (!editSetId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("exam_sets")
        .select("*")
        .eq("id", editSetId)
        .single();
      if (cancelled || error || !data) return;
      setSkill(data.skill as Skill);
      setExamType(data.exam_type as ExamType);
      setEditingSet(data as ExamSetRow);
      setPrefillQuestions(null);
      setMode("form");
      // dọn param để bấm Back / refresh không mở lại editor
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("editSet");
        return p;
      }, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (set: ExamSetRow) => {
    setEditingSet(set);
    setPrefillQuestions(null);
    setMode("form");
  };

  const handleCreateNew = () => {
    setEditingSet(null);
    setPrefillQuestions(null);
    setMode("form");
  };

  const handleBack = () => {
    setMode("list");
    setEditingSet(null);
    setPrefillQuestions(null);
  };

  const handleSaved = () => {
    setMode("list");
    setEditingSet(null);
    setPrefillQuestions(null);
    setRefreshKey((k) => k + 1);
  };

  const handleAiParsed = (questions: ExcelImportRow[], parsedSkill: Skill) => {
    setSkill(parsedSkill);
    setPrefillQuestions(questions);
    setEditingSet(null);
    setMode("form");
  };

  const isFullTest = skill === "full_test";

  return (
    <div className="space-y-6">
      {/* Filters */}
      {mode === "list" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Loại đề</Label>
            <Select value={examType} onValueChange={(v) => setExamType(v as ExamType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Kỹ năng</Label>
            <Select value={skill} onValueChange={(v) => setSkill(v as Skill)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SKILL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === "list" ? (
        isFullTest ? (
          <FullTestManager examType={examType} refreshKey={refreshKey} onRefresh={() => setRefreshKey((k) => k + 1)} />
        ) : (
          <Tabs defaultValue="browse" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="browse" className="gap-1.5 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Danh sách</span>
              </TabsTrigger>
              <TabsTrigger value="excel" className="gap-1.5 text-xs sm:text-sm">
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5 text-xs sm:text-sm">
                <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">AI Parser</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-1.5 text-xs sm:text-sm">
                <FolderOpen className="w-4 h-4" /> <span className="hidden sm:inline">Media</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse">
              <ExamSetList
                examType={examType}
                skill={skill}
                onSelect={handleSelect}
                onCreateNew={handleCreateNew}
                refreshKey={refreshKey}
              />
            </TabsContent>

            <TabsContent value="excel">
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h2 className="font-heading font-bold text-foreground">Nhập từ Excel</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload file Excel với các tab: Grammar_Vocab, Reading, Listening, Speaking, Writing.
                </p>
                <ExcelImport examType={examType} onImportComplete={() => setRefreshKey((k) => k + 1)} />
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <AiParser onParsed={handleAiParsed} />
            </TabsContent>

            <TabsContent value="media">
              <MediaLibrary />
            </TabsContent>
          </Tabs>
        )
      ) : (
        <SmartForm
          examSet={editingSet}
          skill={skill}
          examType={examType}
          onBack={handleBack}
          onSaved={handleSaved}
          prefillQuestions={prefillQuestions}
        />
      )}
    </div>
  );
};

export default ImportCenter;

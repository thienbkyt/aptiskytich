import { useState } from "react";
import { Shield, FileSpreadsheet, PenTool, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExamType, Skill, SKILL_LABELS, ExamSetRow } from "./types";
import ExamSetList from "./ExamSetList";
import SmartForm from "./SmartForm";
import ExcelImport from "./ExcelImport";

const ImportCenter = () => {
  const [examType, setExamType] = useState<ExamType>("general");
  const [skill, setSkill] = useState<Skill>("grammar_vocab");
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingSet, setEditingSet] = useState<ExamSetRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelect = (set: ExamSetRow) => {
    setEditingSet(set);
    setMode("form");
  };

  const handleCreateNew = () => {
    setEditingSet(null);
    setMode("form");
  };

  const handleBack = () => {
    setMode("list");
    setEditingSet(null);
  };

  const handleSaved = () => {
    setMode("list");
    setEditingSet(null);
    setRefreshKey((k) => k + 1);
  };

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
        <Tabs defaultValue="browse" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse" className="gap-2">
              <BookOpen className="w-4 h-4" /> Danh sách đề
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
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
                Hệ thống tự nhận diện tab và hiển thị preview trước khi lưu.
              </p>
              <ExcelImport examType={examType} onImportComplete={() => setRefreshKey((k) => k + 1)} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <SmartForm
          examSet={editingSet}
          skill={skill}
          examType={examType}
          onBack={handleBack}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default ImportCenter;

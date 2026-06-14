import { useState, useEffect, useCallback, useMemo } from "react";
import { Shield, CheckCircle2, RotateCcw, Loader2, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ReportRow = {
  id: string;
  exam_question_id: string | null;
  exam_set_id: string | null;
  user_id: string | null;
  skill: string;
  part_type: string | null;
  question_number: number | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  wrong_answer: "Sai đáp án",
  audio: "Lỗi audio",
  image: "Lỗi hình ảnh",
  content: "Lỗi nội dung",
  other: "Khác",
};

const SKILL_OPTIONS = [
  { value: "all", label: "Tất cả kỹ năng" },
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "grammar_vocab", label: "Grammar & Vocab" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "Chưa xử lý" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "all", label: "Tất cả" },
];

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminReports = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("new");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("question_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (skillFilter !== "all") {
      query = query.eq("skill", skillFilter);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Lỗi tải dữ liệu", description: error.message, variant: "destructive" });
      setReports([]);
    } else {
      setReports((data || []) as ReportRow[]);
    }
    setLoading(false);
  }, [skillFilter, statusFilter, toast]);

  useEffect(() => {
    if (user && isAdmin) loadReports();
  }, [user, isAdmin, loadReports]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "new" ? "resolved" : "new";
    setUpdatingId(id);
    const { error } = await supabase
      .from("question_reports")
      .update({ status: nextStatus })
      .eq("id", id);
    setUpdatingId(null);

    if (error) {
      toast({ title: "Lỗi cập nhật", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: nextStatus === "resolved" ? "Đã đánh dấu đã xử lý" : "Đã mở lại báo lỗi" });
    loadReports();
  };

  const filteredReports = useMemo(() => reports, [reports]);

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {authLoading ? <p>Đang tải...</p> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Báo lỗi câu hỏi</h1>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin">
                <FileText className="w-4 h-4" />
                Về Admin
              </Link>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="w-full sm:w-56">
              <Select value={skillFilter} onValueChange={setSkillFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc theo kỹ năng" />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc theo trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Đang tải...</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Không có báo lỗi nào phù hợp bộ lọc.</p>
              </Card>
            ) : (
              filteredReports.map((r) => {
                const isResolved = r.status === "resolved";
                return (
                  <Card
                    key={r.id}
                    className={`p-5 transition-opacity ${isResolved ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant={isResolved ? "secondary" : "default"}>
                            {REASON_LABELS[r.reason] || r.reason}
                          </Badge>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            {r.skill}
                            {r.part_type ? ` • ${r.part_type}` : ""}
                            {r.question_number ? ` • Câu ${r.question_number}` : ""}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          Ghi chú: {r.note?.trim() ? r.note.trim() : "(không có ghi chú)"}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {r.exam_question_id && (
                            <span>Question ID: <code className="text-foreground bg-muted rounded px-1">{r.exam_question_id}</code></span>
                          )}
                          {r.exam_set_id && (
                            <span>Set ID: <code className="text-foreground bg-muted rounded px-1">{r.exam_set_id}</code></span>
                          )}
                          <span>Thời gian: {fmtDate(r.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={isResolved ? "secondary" : "outline"} className={isResolved ? "" : "border-destructive text-destructive"}>
                          {isResolved ? "Đã xử lý" : "Chưa xử lý"}
                        </Badge>
                        <Button
                          size="sm"
                          variant={isResolved ? "outline" : "default"}
                          className="gap-1.5"
                          disabled={updatingId === r.id}
                          onClick={() => handleToggleStatus(r.id, r.status)}
                        >
                          {updatingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isResolved ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {isResolved ? "Mở lại" : "Đánh dấu đã xử lý"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminReports;

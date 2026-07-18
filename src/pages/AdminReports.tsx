import { useState, useEffect, useCallback, useMemo } from "react";
import { Shield, CheckCircle2, RotateCcw, Loader2, AlertTriangle, FileText, ExternalLink, Pencil, MailCheck } from "lucide-react";
import { toast as sonnerToast } from "sonner";
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
  skill: string | null;
  part_type: string | null;
  question_number: number | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  report_category: string | null;
  page_url: string | null;
  device_info: string | null;
  section: string | null;
};

type ReporterInfo = { email: string; display_name: string | null };

const CONTENT_REASON_LABELS: Record<string, string> = {
  wrong_answer: "Sai đáp án",
  audio: "Lỗi audio",
  image: "Lỗi hình ảnh",
  content: "Lỗi nội dung",
  other: "Khác",
};

const FUNCTIONAL_REASON_LABELS: Record<string, string> = {
  cant_nav: "Không bấm được Next/Previous",
  cant_exit: "Không thoát được",
  button_broken: "Nút không hoạt động",
  page_frozen: "Trang bị đứng/treo",
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

const CATEGORY_OPTIONS = [
  { value: "all", label: "Tất cả loại" },
  { value: "content", label: "Lỗi nội dung" },
  { value: "functional", label: "Lỗi chức năng" },
];

const SKILL_ROUTE: Record<string, string> = {
  reading: "/reading",
  listening: "/listening",
  grammar_vocab: "/grammar",
  speaking: "/speaking",
  writing: "/writing",
};

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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Map exam_question_id -> { setId, setTitle }
  const [questionSetMap, setQuestionSetMap] = useState<
    Record<string, { setId: string | null; setTitle: string | null }>
  >({});
  const [reporterMap, setReporterMap] = useState<Record<string, ReporterInfo>>({});

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

    if (skillFilter !== "all") query = query.eq("skill", skillFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (categoryFilter !== "all") query = query.eq("report_category", categoryFilter);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Lỗi tải dữ liệu", description: error.message, variant: "destructive" });
      setReports([]);
      setQuestionSetMap({});
      setLoading(false);
      return;
    }

    const rows = (data || []) as ReportRow[];
    setReports(rows);

    // Lookup exam set titles for content reports
    const qIds = Array.from(
      new Set(
        rows
          .filter((r) => r.exam_question_id)
          .map((r) => r.exam_question_id as string)
      )
    );

    if (qIds.length > 0) {
      const { data: qData, error: qErr } = await supabase
        .from("exam_questions")
        .select("id, exam_set_id, exam_sets:exam_set_id ( id, title )")
        .in("id", qIds);
      if (!qErr && qData) {
        const map: Record<string, { setId: string | null; setTitle: string | null }> = {};
        for (const row of qData as any[]) {
          map[row.id] = {
            setId: row.exam_set_id ?? row.exam_sets?.id ?? null,
            setTitle: row.exam_sets?.title ?? null,
          };
        }
        setQuestionSetMap(map);
      } else {
        setQuestionSetMap({});
      }
    } else {
      setQuestionSetMap({});
    }

    // Load reporter emails via list-students (admin-only edge function)
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
    if (userIds.length > 0) {
      try {
        const { data: sData, error: sErr } = await supabase.functions.invoke("list-students");
        if (!sErr && sData?.students) {
          const map: Record<string, ReporterInfo> = {};
          for (const s of sData.students as any[]) {
            if (userIds.includes(s.user_id)) {
              map[s.user_id] = { email: s.email ?? "", display_name: s.display_name ?? null };
            }
          }
          setReporterMap(map);
        } else {
          setReporterMap({});
        }
      } catch {
        setReporterMap({});
      }
    } else {
      setReporterMap({});
    }

    setLoading(false);
  }, [skillFilter, statusFilter, categoryFilter, toast]);

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

  const handleResolveAndNotify = async (id: string) => {
    if (!window.confirm("Gửi thông báo + email cảm ơn cho những người đã báo lỗi câu này?")) return;
    setResolvingId(id);
    const { data, error } = await supabase.rpc("resolve_question_report", { p_report_id: id });
    setResolvingId(null);
    if (error) {
      sonnerToast.error("Không gửi được: " + error.message);
      return;
    }
    sonnerToast.success(`Đã đánh dấu đã fix và gửi thông báo + email cho ${data ?? 0} người dùng`);
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lọc theo loại báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                const category = (r.report_category ?? "content") as "content" | "functional";
                const isFunctional = category === "functional";
                const reasonLabel = isFunctional
                  ? FUNCTIONAL_REASON_LABELS[r.reason] || r.reason
                  : CONTENT_REASON_LABELS[r.reason] || r.reason;

                const lookup = r.exam_question_id ? questionSetMap[r.exam_question_id] : undefined;
                const setIdForLink = lookup?.setId || r.exam_set_id;
                const setTitle = lookup?.setTitle;

                const examUrl =
                  r.skill && SKILL_ROUTE[r.skill] && setIdForLink
                    ? `${SKILL_ROUTE[r.skill]}?set=${setIdForLink}&jump=1`
                    : r.page_url;

                return (
                  <Card
                    key={r.id}
                    className={`p-5 transition-opacity ${isResolved ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={
                              isFunctional
                                ? "border-amber-500 text-amber-700 dark:text-amber-400"
                                : "border-primary text-primary"
                            }
                          >
                            {isFunctional ? "Lỗi chức năng" : "Lỗi nội dung"}
                          </Badge>
                          <Badge variant={isResolved ? "secondary" : "default"}>
                            {reasonLabel}
                          </Badge>
                          {(r.skill || r.part_type || r.question_number) && (
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              {r.skill || ""}
                              {r.part_type ? ` • ${r.part_type}` : ""}
                              {r.question_number ? ` • Câu ${r.question_number}` : ""}
                            </span>
                          )}
                        </div>

                        {!isFunctional && setTitle && (
                          <p className="text-sm font-medium text-foreground mb-1">
                            Bộ đề: {setTitle}
                          </p>
                        )}

                        <p className="text-sm text-muted-foreground mb-2">
                          Ghi chú: {r.note?.trim() ? r.note.trim() : "(không có ghi chú)"}
                        </p>

                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          {(() => {
                            const hasContentLoc = !!(r.skill || r.part_type || r.question_number);
                            let sectionText: string | null = null;
                            if (hasContentLoc) {
                              sectionText = [
                                r.skill || "",
                                r.part_type ? r.part_type : "",
                                r.question_number ? `Câu ${r.question_number}` : "",
                              ].filter(Boolean).join(" • ");
                            } else if (r.section) {
                              sectionText = r.section;
                            }
                            return sectionText ? (
                              <span>Phần: <span className="text-foreground font-medium">{sectionText}</span></span>
                            ) : null;
                          })()}
                          {(() => {
                            if (!r.user_id) {
                              return <span>Người báo lỗi: <span className="text-foreground">Ẩn danh</span></span>;
                            }
                            const info = reporterMap[r.user_id];
                            if (!info) {
                              return <span>Người báo lỗi: <code className="text-foreground bg-muted rounded px-1">{r.user_id}</code></span>;
                            }
                            const label = info.display_name
                              ? `${info.display_name} (${info.email})`
                              : info.email || r.user_id;
                            return <span>Người báo lỗi: <span className="text-foreground">{label}</span></span>;
                          })()}
                          {isFunctional && r.page_url && (
                            <span>
                              Trang: <code className="text-foreground bg-muted rounded px-1 break-all">{r.page_url}</code>
                            </span>
                          )}
                          {isFunctional && r.device_info && (
                            <span className="break-all">
                              Thiết bị: <span className="text-foreground">{r.device_info}</span>
                            </span>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {!isFunctional && r.exam_question_id && (
                              <span>Question ID: <code className="text-foreground bg-muted rounded px-1">{r.exam_question_id}</code></span>
                            )}
                            {!isFunctional && setIdForLink && (
                              <span>Set ID: <code className="text-foreground bg-muted rounded px-1">{setIdForLink}</code></span>
                            )}
                            <span>Thời gian: {fmtDate(r.created_at)}</span>
                          </div>
                        </div>


                        {(examUrl || (!isFunctional && setIdForLink)) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {examUrl && (
                              <Button asChild size="sm" variant="outline" className="gap-1.5">
                                <a href={examUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Mở trang gặp lỗi
                                </a>
                              </Button>
                            )}
                            {!isFunctional && setIdForLink && (
                              <Button asChild size="sm" variant="outline" className="gap-1.5">
                                <Link to={`/admin?editSet=${setIdForLink}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                  Sửa câu
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
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

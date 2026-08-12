import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, AlertTriangle, Lightbulb, Loader2, FileSpreadsheet, ExternalLink, Save } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";

type ReportRow = {
  id: string;
  user_id: string | null;
  skill: string | null;
  part_type: string | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  report_category: string | null;
  page_url: string | null;
  device_type: string | null;
};

type Attachment =
  | { type: "image" | "file"; path: string; name: string }
  | { type: "link"; url: string; name: string };

type SuggestionRow = {
  id: string;
  user_id: string;
  content: string;
  attachments: Attachment[];
  status: string;
  admin_note: string | null;
  created_at: string;
};

type UserInfo = { email: string; display_name: string | null };

const REPORT_STATUSES = [
  { value: "new", label: "Mới" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "resolved", label: "Đã xử lý" },
];

const SUGGESTION_STATUSES = [
  { value: "new", label: "Mới" },
  { value: "planned", label: "Đã lên kế hoạch" },
  { value: "done", label: "Đã làm" },
  { value: "rejected", label: "Từ chối" },
];

const SKILL_OPTIONS = [
  { value: "all", label: "Tất cả kỹ năng" },
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "grammar_vocab", label: "Grammar & Vocab" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
];

const CATEGORY_LABELS: Record<string, string> = {
  content: "Lỗi nội dung",
  functional: "Lỗi chức năng",
  review_abuse: "Báo cáo review",
};

const REASON_LABELS: Record<string, string> = {
  wrong_answer: "Sai đáp án",
  audio: "Lỗi audio",
  image: "Lỗi hình ảnh",
  content: "Lỗi nội dung",
  cant_nav: "Không bấm được Next/Previous",
  cant_exit: "Không thoát được",
  button_broken: "Nút không hoạt động",
  page_frozen: "Trang bị đứng/treo",
  other: "Khác",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  desktop: "Máy tính",
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminInbox = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  usePageMeta({
    title: "Hộp thư quản trị | Aptis Kỳ Tích",
    description: "Tổng hợp báo lỗi câu hỏi và đề xuất tính năng từ học viên.",
    noindex: true,
  });

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [people, setPeople] = useState<Record<string, UserInfo>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [reportStatus, setReportStatus] = useState("open");
  const [reportSkill, setReportSkill] = useState("all");
  const [reportCategory, setReportCategory] = useState("all");
  const [suggestionStatus, setSuggestionStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([
      supabase
        .from("question_reports")
        .select("id,user_id,skill,part_type,reason,note,status,created_at,report_category,page_url,device_type")
        .order("created_at", { ascending: false }),
      supabase
        .from("feature_suggestions")
        .select("id,user_id,content,attachments,status,admin_note,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (r.error || s.error) {
      toast({
        title: "Lỗi tải dữ liệu",
        description: r.error?.message || s.error?.message,
        variant: "destructive",
      });
    }

    const reportRows = (r.data || []) as ReportRow[];
    const suggestionRows = ((s.data || []) as any[]).map((row) => ({
      ...row,
      attachments: Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [],
    })) as SuggestionRow[];

    setReports(reportRows);
    setSuggestions(suggestionRows);
    setNoteDrafts(
      Object.fromEntries(suggestionRows.map((row) => [row.id, row.admin_note ?? ""]))
    );

    const ids = Array.from(
      new Set([
        ...reportRows.map((row) => row.user_id).filter(Boolean) as string[],
        ...suggestionRows.map((row) => row.user_id),
      ])
    );
    if (ids.length > 0) {
      const { data } = await supabase.rpc("admin_emails_by_ids", { p_user_ids: ids });
      const map: Record<string, UserInfo> = {};
      for (const row of (data || []) as any[]) {
        map[row.user_id] = { email: row.email ?? "", display_name: row.display_name ?? null };
      }
      setPeople(map);
    } else {
      setPeople({});
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user && isAdmin) load();
  }, [user, isAdmin, load]);

  const pendingReports = useMemo(
    () => reports.filter((r) => r.status !== "resolved").length,
    [reports]
  );
  const pendingSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === "new").length,
    [suggestions]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((r) => {
        if (reportStatus === "open" && r.status === "resolved") return false;
        if (reportStatus !== "open" && reportStatus !== "all" && r.status !== reportStatus) return false;
        if (reportSkill !== "all" && r.skill !== reportSkill) return false;
        if (reportCategory !== "all" && r.report_category !== reportCategory) return false;
        return true;
      }),
    [reports, reportStatus, reportSkill, reportCategory]
  );

  const filteredSuggestions = useMemo(
    () =>
      suggestions.filter((s) => suggestionStatus === "all" || s.status === suggestionStatus),
    [suggestions, suggestionStatus]
  );

  const personLabel = (id: string | null) => {
    if (!id) return "Khách (chưa đăng nhập)";
    const p = people[id];
    if (!p) return "—";
    return p.email || p.display_name || "—";
  };

  const updateReportStatus = async (id: string, status: string) => {
    setSavingId(id);
    const { error } = await supabase.from("question_reports").update({ status }).eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Không cập nhật được", description: error.message, variant: "destructive" });
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const updateSuggestion = async (id: string, patch: { status?: string; admin_note?: string }) => {
    setSavingId(id);
    const { error } = await supabase.from("feature_suggestions").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Không cập nhật được", description: error.message, variant: "destructive" });
      return;
    }
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    toast({ title: "Đã lưu" });
  };

  const openAttachment = async (a: Attachment) => {
    if (a.type === "link") {
      window.open(a.url, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage
      .from("suggestion-files")
      .createSignedUrl(a.path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Không mở được tệp", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const exportReports = async () => {
    const { createAndDownloadExcel } = await import("@/lib/excelUtils");
    await createAndDownloadExcel("bao-loi.xlsx", [
      {
        name: "Bao loi",
        cols: filteredReports.map((r) => ({
          "Thời gian": fmtDate(r.created_at),
          "Người gửi": personLabel(r.user_id),
          "Kỹ năng": r.skill ?? "",
          Part: r.part_type ?? "",
          "Lý do": REASON_LABELS[r.reason] ?? r.reason,
          "Ghi chú": r.note ?? "",
          Trang: r.page_url ?? "",
          "Thiết bị": DEVICE_LABELS[r.device_type ?? ""] ?? r.device_type ?? "",
          "Phân loại": CATEGORY_LABELS[r.report_category ?? ""] ?? r.report_category ?? "",
          "Trạng thái": REPORT_STATUSES.find((s) => s.value === r.status)?.label ?? r.status,
        })),
      },
    ]);
  };

  const exportSuggestions = async () => {
    const { createAndDownloadExcel } = await import("@/lib/excelUtils");
    await createAndDownloadExcel("de-xuat-tinh-nang.xlsx", [
      {
        name: "De xuat",
        cols: filteredSuggestions.map((s) => ({
          "Thời gian": fmtDate(s.created_at),
          "Người gửi": personLabel(s.user_id),
          "Nội dung": s.content,
          "Đính kèm": s.attachments
            .map((a) => (a.type === "link" ? a.url : a.name))
            .join(" | "),
          "Trạng thái": SUGGESTION_STATUSES.find((x) => x.value === s.status)?.label ?? s.status,
          "Ghi chú admin": s.admin_note ?? "",
        })),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-[144px] md:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <Inbox className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">Hộp thư quản trị</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Báo lỗi chưa xử lý</p>
                <p className="text-2xl font-bold text-foreground">{pendingReports}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Đề xuất mới</p>
                <p className="text-2xl font-bold text-foreground">{pendingSuggestions}</p>
              </div>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <Tabs defaultValue="reports" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reports" className="gap-2">
                  <AlertTriangle className="w-4 h-4" /> Báo lỗi
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="gap-2">
                  <Lightbulb className="w-4 h-4" /> Đề xuất tính năng
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reports" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={reportStatus} onValueChange={setReportStatus}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Chưa xử lý</SelectItem>
                      {REPORT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={reportSkill} onValueChange={setReportSkill}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SKILL_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={reportCategory} onValueChange={setReportCategory}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả phân loại</SelectItem>
                      {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={exportReports} className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                  </Button>
                  <span className="text-sm text-muted-foreground">{filteredReports.length} dòng</span>
                </div>

                <div className="space-y-3">
                  {filteredReports.length === 0 && (
                    <p className="text-sm text-muted-foreground">Không có báo lỗi nào.</p>
                  )}
                  {filteredReports.map((r) => (
                    <Card key={r.id} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{fmtDate(r.created_at)}</span>
                        <span>·</span>
                        <span className="text-foreground font-medium">{personLabel(r.user_id)}</span>
                        {r.skill && <Badge variant="secondary">{r.skill}{r.part_type ? ` · ${r.part_type}` : ""}</Badge>}
                        <Badge variant="outline">{CATEGORY_LABELS[r.report_category ?? ""] ?? r.report_category ?? "—"}</Badge>
                        {r.device_type && <Badge variant="outline">{DEVICE_LABELS[r.device_type] ?? r.device_type}</Badge>}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {REASON_LABELS[r.reason] ?? r.reason}
                      </p>
                      {r.note && <p className="text-sm text-foreground whitespace-pre-wrap">{r.note}</p>}
                      <div className="flex flex-wrap items-center gap-3">
                        {r.page_url && (
                          <a
                            href={r.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> {r.page_url}
                          </a>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {savingId === r.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                          <Select value={r.status} onValueChange={(v) => updateReportStatus(r.id, v)}>
                            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REPORT_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={suggestionStatus} onValueChange={setSuggestionStatus}>
                    <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      {SUGGESTION_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={exportSuggestions} className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                  </Button>
                  <span className="text-sm text-muted-foreground">{filteredSuggestions.length} dòng</span>
                </div>

                <div className="space-y-3">
                  {filteredSuggestions.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có đề xuất nào.</p>
                  )}
                  {filteredSuggestions.map((s) => (
                    <Card key={s.id} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{fmtDate(s.created_at)}</span>
                        <span>·</span>
                        <span className="text-foreground font-medium">{personLabel(s.user_id)}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{s.content}</p>
                      {s.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {s.attachments.map((a, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => openAttachment(a)}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {a.name || (a.type === "link" ? a.url : "Tệp")}
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={s.status} onValueChange={(v) => updateSuggestion(s.id, { status: v })}>
                          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SUGGESTION_STATUSES.map((x) => (
                              <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={noteDrafts[s.id] ?? ""}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          placeholder="Ghi chú admin..."
                          className="flex-1 min-w-[200px]"
                        />
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={savingId === s.id || (noteDrafts[s.id] ?? "") === (s.admin_note ?? "")}
                          onClick={() => updateSuggestion(s.id, { admin_note: noteDrafts[s.id] ?? "" })}
                        >
                          {savingId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Lưu ghi chú
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminInbox;

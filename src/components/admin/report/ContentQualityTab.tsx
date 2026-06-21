import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, AlertTriangle, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type ReportRow = { exam_question_id: string | null; exam_set_id: string | null; created_at: string };
type ResultRow = { exam_question_id: string | null; is_correct: boolean | null; created_at: string };
type TestResultRow = { exam_set_id: string | null; created_at: string };

const RANGE_OPTIONS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tùy chọn (từ - đến)" },
];

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";

const truncate = (s: string | null | undefined, n = 60) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
};

const ContentQualityTab = () => {
  const [range, setRange] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [testResults, setTestResults] = useState<TestResultRow[]>([]);
  const [qMap, setQMap] = useState<Record<string, { question_text: string | null; exam_set_id: string | null }>>({});
  const [setMap, setSetMap] = useState<Record<string, string>>({});

  const now = useMemo(() => new Date(), []);
  const bounds = useMemo<{ gte: string | null; lte: string | null }>(() => {
    if (range === "custom") {
      if (customFrom && customTo) {
        return {
          gte: new Date(`${customFrom}T00:00:00`).toISOString(),
          lte: new Date(`${customTo}T23:59:59.999`).toISOString(),
        };
      }
      return { gte: null, lte: null };
    }
    if (range === "all") return { gte: null, lte: null };
    const d = new Date(now);
    d.setDate(d.getDate() - Number(range));
    return { gte: d.toISOString(), lte: null };
  }, [range, customFrom, customTo, now]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rq = supabase.from("question_reports").select("exam_question_id, exam_set_id, created_at");
      const rr = supabase
        .from("exam_question_results")
        .select("exam_question_id, is_correct, created_at")
        .not("is_correct", "is", null);
      const rt = supabase.from("test_results").select("exam_set_id, created_at");

      if (bounds.gte) {
        rq.gte("created_at", bounds.gte);
        rr.gte("created_at", bounds.gte);
        rt.gte("created_at", bounds.gte);
      }
      if (bounds.lte) {
        rq.lte("created_at", bounds.lte);
        rr.lte("created_at", bounds.lte);
        rt.lte("created_at", bounds.lte);
      }

      const [a, b, c] = await Promise.all([rq, rr, rt]);
      if (cancelled) return;
      const rep = (a.data as ReportRow[]) || [];
      const res = (b.data as ResultRow[]) || [];
      const tr = (c.data as TestResultRow[]) || [];
      setReports(rep);
      setResults(res);
      setTestResults(tr);

      // collect ids for lookups
      const qIds = new Set<string>();
      for (const r of rep) if (r.exam_question_id) qIds.add(r.exam_question_id);
      for (const r of res) if (r.exam_question_id) qIds.add(r.exam_question_id);

      const setIds = new Set<string>();
      for (const t of tr) if (t.exam_set_id) setIds.add(t.exam_set_id);

      let qm: Record<string, { question_text: string | null; exam_set_id: string | null }> = {};
      if (qIds.size > 0) {
        const { data: qd } = await supabase
          .from("exam_questions")
          .select("id, question_text, exam_set_id")
          .in("id", Array.from(qIds));
        if (qd) {
          for (const row of qd as any[]) {
            qm[row.id] = { question_text: row.question_text, exam_set_id: row.exam_set_id };
            if (row.exam_set_id) setIds.add(row.exam_set_id);
          }
        }
      }

      let sm: Record<string, string> = {};
      if (setIds.size > 0) {
        const { data: sd } = await supabase
          .from("exam_sets")
          .select("id, title")
          .in("id", Array.from(setIds));
        if (sd) {
          for (const row of sd as any[]) sm[row.id] = row.title;
        }
      }

      if (cancelled) return;
      setQMap(qm);
      setSetMap(sm);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bounds.gte, bounds.lte]);

  // Top reported questions
  const topReported = useMemo(() => {
    const cnt = new Map<string, number>();
    for (const r of reports) {
      if (!r.exam_question_id) continue;
      cnt.set(r.exam_question_id, (cnt.get(r.exam_question_id) ?? 0) + 1);
    }
    return Array.from(cnt.entries())
      .map(([qid, count]) => {
        const q = qMap[qid];
        const setId = q?.exam_set_id ?? null;
        return {
          qid,
          count,
          text: q?.question_text ?? null,
          setId,
          setTitle: setId ? setMap[setId] ?? null : null,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [reports, qMap, setMap]);

  // Suspect wrong-answer questions
  const suspectWrong = useMemo(() => {
    const agg = new Map<string, { total: number; wrong: number }>();
    for (const r of results) {
      if (!r.exam_question_id) continue;
      const cur = agg.get(r.exam_question_id) ?? { total: 0, wrong: 0 };
      cur.total += 1;
      if (r.is_correct === false) cur.wrong += 1;
      agg.set(r.exam_question_id, cur);
    }
    return Array.from(agg.entries())
      .filter(([, v]) => v.total >= 5 && v.wrong / v.total >= 0.7)
      .map(([qid, v]) => {
        const q = qMap[qid];
        const setId = q?.exam_set_id ?? null;
        return {
          qid,
          total: v.total,
          wrong: v.wrong,
          rate: v.wrong / v.total,
          text: q?.question_text ?? null,
          setId,
          setTitle: setId ? setMap[setId] ?? null : null,
        };
      })
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 15);
  }, [results, qMap, setMap]);

  // Hot / cold exam sets
  const { hotSets, coldSets } = useMemo(() => {
    const cnt = new Map<string, number>();
    for (const t of testResults) {
      if (!t.exam_set_id) continue;
      cnt.set(t.exam_set_id, (cnt.get(t.exam_set_id) ?? 0) + 1);
    }
    const arr = Array.from(cnt.entries())
      .filter(([, n]) => n > 0)
      .map(([setId, count]) => ({
        setId,
        count,
        title: setMap[setId] ?? setId.slice(0, 8),
      }));
    const sorted = [...arr].sort((a, b) => b.count - a.count);
    return {
      hotSets: sorted.slice(0, 10),
      coldSets: [...arr].sort((a, b) => a.count - b.count).slice(0, 10),
    };
  }, [testResults, setMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Khoảng thời gian:</span>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {range === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" aria-label="Từ ngày" />
            <span className="text-sm text-muted-foreground">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" aria-label="Đến ngày" />
          </>
        )}
      </div>

      {/* Top reported */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" style={{ color: COLOR_PRIMARY }} />
          <h3 className="text-lg font-heading font-bold">Câu bị báo lỗi nhiều nhất</h3>
        </div>
        {topReported.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Câu hỏi</TableHead>
                  <TableHead>Bộ đề</TableHead>
                  <TableHead className="text-right">Báo lỗi</TableHead>
                  <TableHead className="text-right w-[120px]">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topReported.map((r) => (
                  <TableRow key={r.qid}>
                    <TableCell className="font-medium">{truncate(r.text) || <span className="text-muted-foreground">(không có nội dung)</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.setTitle ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold" style={{ color: COLOR_PRIMARY }}>{r.count}</TableCell>
                    <TableCell className="text-right">
                      {r.setId ? (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link to={`/admin?editSet=${r.setId}`}>
                            <Pencil className="w-3.5 h-3.5" /> Sửa câu
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Suspect wrong answers */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" style={{ color: COLOR_ACCENT }} />
          <h3 className="text-lg font-heading font-bold">Câu nghi sai đáp án</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Lọc: tối thiểu 5 lượt trả lời và ≥ 70% sai.</p>
        {suspectWrong.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Câu hỏi</TableHead>
                  <TableHead>Bộ đề</TableHead>
                  <TableHead className="text-right">% sai</TableHead>
                  <TableHead className="text-right">Lượt</TableHead>
                  <TableHead className="text-right w-[120px]">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspectWrong.map((r) => (
                  <TableRow key={r.qid}>
                    <TableCell className="font-medium">{truncate(r.text) || <span className="text-muted-foreground">(không có nội dung)</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.setTitle ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold" style={{ color: COLOR_PRIMARY }}>{(r.rate * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-right text-sm">{r.wrong}/{r.total}</TableCell>
                    <TableCell className="text-right">
                      {r.setId ? (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link to={`/admin?editSet=${r.setId}`}>
                            <Pencil className="w-3.5 h-3.5" /> Sửa câu
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Hot / Cold sets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5" style={{ color: COLOR_PRIMARY }} />
            <h3 className="text-lg font-heading font-bold">Bộ đề hot (nhiều lượt)</h3>
          </div>
          {hotSets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bộ đề</TableHead>
                    <TableHead className="text-right">Lượt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotSets.map((s) => (
                    <TableRow key={s.setId}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: COLOR_PRIMARY }}>{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" style={{ color: COLOR_ACCENT }} />
            <h3 className="text-lg font-heading font-bold">Bộ đề ế (ít lượt nhất, &gt; 0)</h3>
          </div>
          {coldSets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bộ đề</TableHead>
                    <TableHead className="text-right">Lượt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coldSets.map((s) => (
                    <TableRow key={s.setId}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: COLOR_ACCENT }}>{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ContentQualityTab;

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { RANGE_OPTIONS, resolveBounds } from "./rangeHelpers";

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";

interface Reported { qid: string; count: number; text: string | null; set_id: string | null; set_title: string | null }
interface Suspect  { qid: string; total: number; wrong: number; rate: number; text: string | null; set_id: string | null; set_title: string | null }
interface SetRow   { set_id: string; count: number; title: string | null }

const truncate = (s: string | null | undefined, n = 60) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
};

const ContentQualityTab = () => {
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [topReported, setTopReported] = useState<Reported[]>([]);
  const [suspectWrong, setSuspectWrong] = useState<Suspect[]>([]);
  const [hotSets, setHotSets] = useState<SetRow[]>([]);
  const [coldSets, setColdSets] = useState<SetRow[]>([]);

  const bounds = useMemo(
    () => resolveBounds(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("admin_content_quality", {
      p_from: bounds.gte,
      p_to: bounds.lte,
    });
    const d = (data as any) || {};
    setTopReported((d.top_reported || []).slice(0, 15));
    setSuspectWrong((d.suspect_wrong || []).slice(0, 15));
    setHotSets((d.hot_sets || []).slice(0, 10));
    setColdSets((d.cold_sets || []).slice(0, 10));
    setLoading(false);
  }, [bounds.gte, bounds.lte]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                    <TableCell className="text-sm text-muted-foreground">{r.set_title ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold" style={{ color: COLOR_PRIMARY }}>{r.count}</TableCell>
                    <TableCell className="text-right">
                      {r.set_id ? (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link to={`/admin?editSet=${r.set_id}`}>
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
                    <TableCell className="text-sm text-muted-foreground">{r.set_title ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold" style={{ color: COLOR_PRIMARY }}>{(r.rate * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-right text-sm">{r.wrong}/{r.total}</TableCell>
                    <TableCell className="text-right">
                      {r.set_id ? (
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link to={`/admin?editSet=${r.set_id}`}>
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
                    <TableRow key={s.set_id}>
                      <TableCell className="font-medium">{s.title ?? s.set_id.slice(0, 8)}</TableCell>
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
                    <TableRow key={s.set_id}>
                      <TableCell className="font-medium">{s.title ?? s.set_id.slice(0, 8)}</TableCell>
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

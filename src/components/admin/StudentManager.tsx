import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  User as UserIcon,
  Eye,
  Flame,
  Calendar,
  Play,
  Pause,
  Loader2,
  Shield,
  ShieldOff,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { resolveAudioUrl } from "@/lib/audioUrl";
import { cn } from "@/lib/utils";

interface Student {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_activity_date: string | null;
  current_streak: number;
  total_attempts: number;
  latest_level: string | null;
  is_admin: boolean;
}


interface HistoryRow {
  id: string;
  created_at: string;
  score: number;
  total: number;
  level: string;
  exam_set_id: string | null;
  title: string;
  skill: string;
  part: string;
}

interface Recording {
  exam_set_id: string | null;
  part: string;
  audio_url: string;
}

const SKILLS = ["grammar", "reading", "listening", "speaking", "writing"] as const;
const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const daysSince = (iso?: string | null) => {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const StudentManager = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<Student | null>(null);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke("list-students");
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setStudents((data as any)?.students ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirmRole = async () => {
    if (!roleTarget) return;
    const target = roleTarget;
    const action = target.is_admin ? "revoke" : "grant";
    setRoleTarget(null);
    setRoleLoadingId(target.user_id);
    const { data, error } = await supabase.functions.invoke("set-user-role", {
      body: { user_id: target.user_id, action },
    });
    setRoleLoadingId(null);
    if (error || (data as any)?.error) {
      toast.error(
        (data as any)?.error || error?.message || "Không thể cập nhật quyền"
      );
      return;
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.user_id === target.user_id ? { ...s, is_admin: action === "grant" } : s
      )
    );
    toast.success(
      action === "grant" ? "Đã cấp quyền admin" : "Đã gỡ quyền admin"
    );
  };


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.display_name ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {loading ? "..." : `${filtered.length} người dùng`}
        </Badge>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Lỗi tải dữ liệu: {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead className="hidden md:table-cell">Đăng ký</TableHead>
              <TableHead className="hidden md:table-cell">Hoạt động cuối</TableHead>
              <TableHead className="text-center">Streak</TableHead>
              <TableHead className="text-center">Bài đã làm</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Band</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Không có người dùng nào.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const inactive = daysSince(s.last_activity_date) > 7;
                return (
                  <TableRow
                    key={s.user_id}
                    className={cn(inactive && "text-muted-foreground/70")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={s.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(s.display_name || s.email || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="font-medium text-foreground truncate">
                              {s.display_name || s.email.split("@")[0]}
                            </div>
                            {s.is_admin && (
                              <Badge className="h-4 px-1.5 text-[9px] bg-primary/15 text-primary hover:bg-primary/20 border-0 shrink-0">
                                ADMIN
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.email}
                          </div>
                        </div>

                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {formatDate(s.created_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {formatDate(s.last_activity_date)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Flame className="w-3.5 h-3.5 text-primary" />
                        {s.current_streak}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {s.total_attempts}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {s.latest_level ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {s.latest_level}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setSelected(s)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Xem lịch sử</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && <StudentHistoryPanel student={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const StudentHistoryPanel = ({ student }: { student: Student }) => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [resultsRes, recRes] = await Promise.all([
        supabase
          .from("test_results")
          .select("id,created_at,score,total,level,exam_set_id,skill_scores")
          .eq("user_id", student.user_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("speaking_recordings")
          .select("exam_set_id,part,audio_url,created_at")
          .eq("user_id", student.user_id)
          .order("created_at", { ascending: false }),
      ]);

      const results = resultsRes.data ?? [];
      const setIds = Array.from(
        new Set(results.map((r: any) => r.exam_set_id).filter(Boolean))
      );
      const setsMap: Record<string, { title: string; skill: string; part: string }> = {};
      if (setIds.length > 0) {
        const { data: sets } = await supabase
          .from("exam_sets")
          .select("id,title,skill,part")
          .in("id", setIds);
        (sets ?? []).forEach((s: any) => {
          setsMap[s.id] = { title: s.title, skill: s.skill, part: s.part };
        });
      }

      const merged: HistoryRow[] = results.map((r: any) => {
        const si = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
        return {
          id: r.id,
          created_at: r.created_at,
          score: r.score,
          total: r.total,
          level: r.level,
          exam_set_id: r.exam_set_id,
          title: si?.title || "Đề mẫu",
          skill:
            si?.skill ||
            (r.skill_scores && (r.skill_scores as any).skill) ||
            "unknown",
          part: si?.part || "",
        };
      });

      if (!cancelled) {
        setRows(merged);
        setRecordings(recRes.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.user_id]);

  const perSkill = useMemo(() => {
    const map = new Map<string, { score: number; total: number; count: number }>();
    SKILLS.forEach((sk) => map.set(sk, { score: 0, total: 0, count: 0 }));
    rows.forEach((r) => {
      const cur = map.get(r.skill);
      if (!cur) return;
      cur.score += r.score;
      cur.total += r.total;
      cur.count += 1;
    });
    return map;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.skill === filter)),
    [rows, filter]
  );

  return (
    <>
      <SheetHeader className="space-y-0 text-left">
        <SheetTitle className="sr-only">Lịch sử người dùng</SheetTitle>
      </SheetHeader>

      {/* Summary */}
      <div className="space-y-4 pb-6 border-b border-border">
        <div className="flex items-start gap-3">
          <Avatar className="w-14 h-14">
            <AvatarImage src={student.avatar_url ?? undefined} />
            <AvatarFallback>
              {(student.display_name || student.email || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg text-foreground truncate">
              {student.display_name || student.email.split("@")[0]}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{student.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Flame className="w-3.5 h-3.5" /> Streak hiện tại
            </div>
            <div className="text-xl font-bold text-foreground">
              {student.current_streak} ngày
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="w-3.5 h-3.5" /> Tổng bài đã làm
            </div>
            <div className="text-xl font-bold text-foreground">
              {student.total_attempts}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tiến bộ theo kỹ năng
          </p>
          {SKILLS.map((sk) => {
            const v = perSkill.get(sk)!;
            const pct = v.total > 0 ? Math.round((v.score / v.total) * 100) : 0;
            return (
              <div key={sk}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{SKILL_LABELS[sk]}</span>
                  <span className="text-muted-foreground">
                    {v.count > 0 ? `${pct}% • ${v.count} bài` : "Chưa làm"}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-heading font-semibold text-foreground">
            Lịch sử làm bài
          </h4>
          <Badge variant="secondary" className="text-xs">
            {filtered.length}
          </Badge>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1">
            <TabsTrigger value="all" className="flex-1 text-xs min-w-[60px]">
              Tất cả
            </TabsTrigger>
            {SKILLS.map((sk) => (
              <TabsTrigger
                key={sk}
                value={sk}
                className="flex-1 text-xs min-w-[60px]"
              >
                {SKILL_LABELS[sk]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Chưa có bài làm nào.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
              const isSpeaking = r.skill === "speaking";
              const matchingRecs = isSpeaking
                ? recordings.filter(
                    (rc) => rc.exam_set_id === r.exam_set_id
                  )
                : [];
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-border p-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {SKILL_LABELS[r.skill] || r.skill}
                        </Badge>
                        {r.part && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {r.part}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-foreground">
                        {r.score}/{r.total}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{pct}%</div>
                      <Badge className="mt-1 text-[10px] h-5 bg-primary/10 text-primary hover:bg-primary/15 border-0">
                        {r.level}
                      </Badge>
                    </div>
                  </div>
                  {isSpeaking && matchingRecs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
                      {matchingRecs.map((rc, i) => (
                        <RecordingPlayer key={i} rec={rc} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

const RecordingPlayer = ({ rec }: { rec: Recording }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = async () => {
    if (audio) {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        audio.play();
        setPlaying(true);
      }
      return;
    }
    setLoading(true);
    const resolved = await resolveAudioUrl(rec.audio_url);
    setLoading(false);
    if (!resolved) return;
    setUrl(resolved);
    const a = new Audio(resolved);
    a.onended = () => setPlaying(false);
    a.onpause = () => setPlaying(false);
    a.onplay = () => setPlaying(true);
    setAudio(a);
    a.play();
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={handlePlay}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : playing ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </Button>
      <span className="text-muted-foreground">Ghi âm – {rec.part}</span>
    </div>
  );
};

export default StudentManager;

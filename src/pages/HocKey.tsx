import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { usePageMeta } from "@/hooks/usePageMeta";
import { resolveAudioUrl } from "@/lib/audioUrl";
import { mountHocKey } from "@/features/hockey/engine";
import MASCOTS from "@/features/hockey/mascots";
import "@/features/hockey/engine.css";

// Học Key Thần Tốc: Listening câu 15 (Part 3), 16–17 (Part 4) · Reading Part 2–3 (Text cohesion), Part 5 (Long text — DB "Part 4").
const PARTS: Record<string, [string, string]> = {
  l3: ["listening", "Part 3%"],
  l4: ["listening", "Part 4%"],
  r2: ["reading", "Part 2%"],
  r5: ["reading", "Part 4%"],
};
const sb = supabase as any;

async function loadPart(skill: string, like: string) {
  const { data: sets, error } = await sb
    .from("exam_sets").select("id,title,part")
    .eq("is_published", true).eq("skill", skill).ilike("part", like);
  if (error) throw error;
  const ids = (sets || []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data: qs, error: e2 } = await sb
    .from("exam_questions")
    .select("exam_set_id,order_index,question_text,options,correct_answer,explanation,audio_url,extra_data")
    .in("exam_set_id", ids).order("order_index");
  if (e2) throw e2;
  const by = new Map<string, any[]>();
  (qs || []).forEach((q: any) => { if (!by.has(q.exam_set_id)) by.set(q.exam_set_id, []); by.get(q.exam_set_id)!.push(q); });
  return (sets || []).map((s: any) => ({ ...s, qs: by.get(s.id) || [] }));
}

const HocKey = () => {
  usePageMeta({
    title: "Học Key Thần Tốc — Aptis Kỳ Tích",
    description: "Học thuộc key Aptis thần tốc: Listening câu 15, 16–17 và Reading Part 2–3, Part 5 — bảng mã, flashcard, kiểm tra và game.",
    path: "/hoc-key",
  });
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { isPro, loading: tierLoading } = useIsPro();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const allowed = !!(isPro || isAdmin);

  useEffect(() => {
    if (authLoading || tierLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [raw, notesRes, prioRes, learnedRes] = await Promise.all([
          allowed
            ? Promise.all(Object.entries(PARTS).map(async ([k, [skill, like]]) => [k, await loadPart(skill, like)] as const))
                .then((rows) => Object.fromEntries(rows))
            : Promise.resolve({ l3: [], l4: [], r2: [], r5: [] }),
          sb.from("key_notes").select("kind,ref,data"),
          sb.rpc("get_current_key_labels"),
          sb.from("key_learned").select("exam_set_id,part").eq("user_id", user.id),
        ]);
        const notes: Record<string, any> = {};
        (notesRes.data || []).forEach((n: any) => { notes[`${n.kind}::${n.ref}`] = n.data; });
        const prio: Record<string, string> = {};
        const rank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
        (prioRes.data || []).forEach((r: any) => {
          const p = r.priority === "backup" ? "low" : r.priority;
          if (!r.exam_set_id || !p) return;
          if (!prio[r.exam_set_id] || rank(p) < rank(prio[r.exam_set_id])) prio[r.exam_set_id] = p;
        });
        if (!cancelled) setPayload({ raw, notes, prio, learned: learnedRes.data || [] });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Không tải được dữ liệu");
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, tierLoading, user, allowed]);

  useEffect(() => {
    if (!payload || !hostRef.current) return;
    const inst = mountHocKey(hostRef.current, {
      ...payload,
      mascots: MASCOTS,
      locked: !allowed,
      isAdmin,
      getAudio: (p: string) => resolveAudioUrl(p),
      onUpgrade: () => navigate("/pricing"),
      onToggleLearned: async (part: string, setId: string, on: boolean) => {
        if (!user) return;
        if (on) await sb.from("key_learned").upsert({ user_id: user.id, exam_set_id: setId, part }, { onConflict: "user_id,exam_set_id" });
        else await sb.from("key_learned").delete().eq("user_id", user.id).eq("exam_set_id", setId);
      },
      onEditNote: async (kind: string, ref: string, data: any) => {
        const { error } = await sb.from("key_notes").upsert(
          { kind, ref, data, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
          { onConflict: "kind,ref" },
        );
        if (error) throw error;
      },
    });
    return () => inst.destroy();
  }, [payload, allowed, isAdmin, navigate, user]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8F2] dark:bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {!authLoading && !user ? (
          <div className="max-w-lg mx-auto text-center py-24 px-4">
            <div className="text-4xl mb-3">🚀</div>
            <h1 className="text-2xl font-extrabold mb-2">Học Key Thần Tốc</h1>
            <p className="text-muted-foreground mb-6">Đăng nhập để học thuộc key Listening câu 15–17 và Reading Part 2–3, Part 5.</p>
            <Link to="/auth" className="inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold">Đăng nhập</Link>
          </div>
        ) : err ? (
          <div className="max-w-lg mx-auto text-center py-24 px-4 text-muted-foreground">Không tải được dữ liệu: {err}. Thử tải lại trang nhé.</div>
        ) : !payload ? (
          <div className="py-24 text-center text-muted-foreground">Đang tải key…</div>
        ) : null}
        <div ref={hostRef} />
      </main>
    </div>
  );
};

export default HocKey;

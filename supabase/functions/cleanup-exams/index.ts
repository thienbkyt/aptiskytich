import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAdmin(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const skills = ["speaking", "listening", "reading", "grammar_vocab", "full_test"];

  const { data: rows, error: qErr } = await supabase
    .from("exam_questions")
    .select("audio_url, image_url, exam_sets!inner(skill)")
    .in("exam_sets.skill", skills);
  if (qErr) return new Response(JSON.stringify({ step: "query", error: qErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const audioPaths = new Set<string>();
  const imagePaths = new Set<string>();
  const extractPath = (url: string | null, bucket: string): string | null => {
    if (!url) return null;
    if (url.startsWith("http")) {
      const m = url.match(new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`));
      return m ? decodeURIComponent(m[1]) : null;
    }
    return url;
  };
  for (const r of rows ?? []) {
    const a = extractPath((r as any).audio_url, "audio");
    if (a) audioPaths.add(a);
    const i = extractPath((r as any).image_url, "exam-images");
    if (i) imagePaths.add(i);
  }

  const chunk = <T,>(arr: T[], n: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  let audioRemoved = 0, imageRemoved = 0;
  const errs: string[] = [];
  for (const batch of chunk([...audioPaths], 100)) {
    const { data, error } = await supabase.storage.from("audio").remove(batch);
    if (error) errs.push("audio: " + error.message);
    audioRemoved += data?.length ?? 0;
  }
  for (const batch of chunk([...imagePaths], 100)) {
    const { data, error } = await supabase.storage.from("exam-images").remove(batch);
    if (error) errs.push("image: " + error.message);
    imageRemoved += data?.length ?? 0;
  }

  const { data: targetSets, error: sErr } = await supabase
    .from("exam_sets")
    .select("id")
    .in("skill", skills);
  if (sErr) return new Response(JSON.stringify({ step: "list sets", error: sErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const setIds = (targetSets ?? []).map((s: any) => s.id);

  let questionsDeleted = 0;
  if (setIds.length) {
    const { error: dqErr, count } = await supabase
      .from("exam_questions")
      .delete({ count: "exact" })
      .in("exam_set_id", setIds);
    if (dqErr) errs.push("delete q: " + dqErr.message);
    questionsDeleted = count ?? 0;
  }

  const { error: dsErr, count: setsDeleted } = await supabase
    .from("exam_sets")
    .delete({ count: "exact" })
    .in("skill", skills);
  if (dsErr) errs.push("delete sets: " + dsErr.message);

  return new Response(
    JSON.stringify({
      audioFiles: audioPaths.size,
      imageFiles: imagePaths.size,
      audioRemoved,
      imageRemoved,
      questionsDeleted,
      setsDeleted: setsDeleted ?? 0,
      errors: errs,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

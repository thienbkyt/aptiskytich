import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ExamHeader from "@/components/exam/ExamHeader";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  userId: string;
  examSetId: string;
  attemptCreatedAt: string; // ISO of test_results.created_at
  testTitle: string;
  partLabel: string;
  onExit: () => void;
}

interface Rec {
  id: string;
  part: string;
  audio_url: string;
  duration_seconds: number | null;
  signed_url?: string;
}

const SpeakingReviewPage = ({ userId, examSetId, attemptCreatedAt, testTitle, partLabel, onExit }: Props) => {
  const [recs, setRecs] = useState<Rec[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("speaking_recordings")
        .select("id,part,audio_url,duration_seconds,created_at")
        .eq("user_id", userId)
        .eq("exam_set_id", examSetId)
        .order("created_at", { ascending: true });
      const target = new Date(attemptCreatedAt).getTime();
      const sameAttempt = (data || []).filter(
        (r: any) => Math.abs(new Date(r.created_at).getTime() - target) < 2 * 60 * 60 * 1000,
      );
      const signed = await Promise.all(
        sameAttempt.map(async (r: any) => {
          const { data: s } = await supabase.storage
            .from("speaking-recordings")
            .createSignedUrl(r.audio_url, 3600);
          return { ...r, signed_url: s?.signedUrl } as Rec;
        }),
      );
      signed.sort((a, b) => (a.part > b.part ? 1 : -1));
      if (!cancelled) setRecs(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, examSetId, attemptCreatedAt]);

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Speaking" partLabel={partLabel} onExit={onExit} />
      <div className="flex-1 px-4 pt-8 pb-28 max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-heading font-bold text-foreground mb-4">{testTitle} – {partLabel}</h2>
          {!recs ? (
            <Skeleton className="h-32 w-full" />
          ) : recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có file ghi âm cho lần thi này.</p>
          ) : (
            <div className="space-y-4">
              {recs.map((rec) => (
                <div key={rec.id} className="p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{rec.part.toUpperCase()}</span>
                    {rec.duration_seconds != null && (
                      <span className="text-xs text-muted-foreground">{rec.duration_seconds}s</span>
                    )}
                  </div>
                  {rec.signed_url ? (
                    <audio controls src={rec.signed_url} className="w-full" />
                  ) : (
                    <p className="text-xs text-muted-foreground">Không tải được file ghi âm.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingReviewPage;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trophy, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  fetchShowcaseDetail,
  showcasePartLabel,
  showcaseQuestionList,
  showcaseSkillLabel,
  type ShowcaseDetail,
} from "@/lib/showcase";

interface Props {
  id: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hidePractice?: boolean;
}

const ShowcaseDetailDialog = ({ id, open, onOpenChange, hidePractice = false }: Props) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !id) return;
    let alive = true;
    setLoading(true);
    setError("");
    setDetail(null);
    fetchShowcaseDetail(id)
      .then((d) => {
        if (!alive) return;
        if (!d) setError("Không tìm thấy bài này.");
        setDetail(d);
      })
      .catch(() => alive && setError("Không tải được bài, bạn thử lại sau nhé."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, id]);

  const questions = showcaseQuestionList(detail?.question_texts);
  const vocab = detail?.extraction?.vocabulary ?? [];
  const practiceHref =
    detail?.exam_set_id
      ? `/${detail.skill === "speaking" ? "speaking" : "writing"}?set=${detail.exam_set_id}&jump=1`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            <Trophy className="h-5 w-5 text-primary" />
            {detail
              ? `${showcaseSkillLabel(detail.skill)} ${showcasePartLabel(detail.part_type)}`
              : "Bài Kỳ Tích"}
            {detail ? <Badge className="bg-primary text-primary-foreground">{detail.band}</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bài...
          </div>
        ) : error ? (
          <p className="py-8 text-sm text-destructive">{error}</p>
        ) : detail ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {detail.display_name || "Học viên ẩn danh"}
              {detail.exam_set_title ? ` · ${detail.exam_set_title}` : ""}
            </p>

            {questions.length > 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">Đề bài</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                {detail.skill === "speaking" ? "Nội dung bài nói (bản chữ)" : "Bài viết"}
              </h4>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {detail.content_text}
              </div>
            </div>

            {detail.extraction?.why_band ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">Vì sao bài này đạt band {detail.band}</h4>
                <p className="text-sm text-muted-foreground">{detail.extraction.why_band}</p>
              </div>
            ) : null}

            {vocab.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" /> Từ và cấu trúc đáng học
                </h4>
                <ul className="space-y-2 text-sm">
                  {vocab.map((v, i) => (
                    <li key={i} className="text-foreground">
                      <span className="font-semibold">{v.word}</span>
                      {v.meaning ? <span className="text-muted-foreground"> — {v.meaning}</span> : null}
                      {v.example ? (
                        <div className="text-muted-foreground italic">{v.example}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {practiceHref && !hidePractice ? (
              <Button asChild className="w-full sm:w-auto">
                <Link to={practiceHref} onClick={() => onOpenChange(false)}>
                  Luyện đề này
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ShowcaseDetailDialog;

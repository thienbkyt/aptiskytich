import { useState } from "react";
import { Trophy, Loader2, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  consentShowcase,
  dismissShowcase,
  isShowcaseDismissed,
  isShowcasePart,
  reviewShowcaseEntry,
  showcaseBandFor,
  showcaseErrorMessage,
} from "@/lib/showcase";

interface Props {
  skill: "writing" | "speaking";
  partType: string | null | undefined;
  testResultId: string | null | undefined;
  rawPart: number | null | undefined;
}

type Phase = "idle" | "sending" | "checking" | "approved" | "rejected" | "pending" | "error";

const ShowcaseConsentCard = ({ skill, partType, testResultId, rawPart }: Props) => {
  const { user } = useAuth();
  const band = showcaseBandFor(rawPart);
  const eligible = !!testResultId && !!user && isShowcasePart(partType) && !!band;

  const defaultName =
    (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || "";

  const [dismissed, setDismissed] = useState(false);
  const hidden =
    dismissed || (eligible && isShowcaseDismissed(testResultId as string, partType as string));
  const [name, setName] = useState(defaultName);
  const [anonymous, setAnonymous] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  if (!eligible || hidden) return null;

  const handleLater = () => {
    dismissShowcase(testResultId as string, partType as string);
    setHidden(true);
  };

  const handleSubmit = async () => {
    setPhase("sending");
    setMessage("");
    try {
      const entryId = await consentShowcase(
        testResultId as string,
        partType as string,
        anonymous ? null : name.trim() || null,
      );
      setPhase("checking");
      const outcome = await reviewShowcaseEntry(entryId);
      if (outcome.status === "approved") {
        setPhase("approved");
      } else if (outcome.status === "rejected") {
        setPhase("rejected");
        setMessage(outcome.reason || "Bài chưa đạt tiêu chí trưng bày.");
      } else {
        setPhase("pending");
      }
    } catch (e) {
      setPhase("error");
      setMessage(showcaseErrorMessage(e));
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold text-foreground">Bài này đủ điểm lên Bảng Kỳ Tích</h4>
            <Badge className="bg-primary text-primary-foreground">{band}</Badge>
          </div>

          {phase === "approved" ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Bài của bạn đã lên Bảng Kỳ Tích. Cảm ơn bạn đã chia sẻ!
            </p>
          ) : phase === "pending" ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" /> Đã nhận bài, hệ thống đang kiểm tra. Bài sẽ xuất hiện trên bảng sau ít phút.
            </p>
          ) : phase === "rejected" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Bài chưa được trưng bày lần này. {message}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Bạn có muốn chia sẻ bài này để các bạn khác đọc tham khảo không? Bài sẽ hiển thị công khai kèm tên bạn
                chọn, không kèm email hay thông tin liên hệ.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={anonymous ? "" : name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  disabled={anonymous || phase === "sending" || phase === "checking"}
                  placeholder="Tên hiển thị"
                  className="sm:max-w-[220px]"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Ẩn tên (Học viên ẩn danh)
                </label>
              </div>

              {message && phase === "error" ? (
                <p className="mt-2 text-sm text-destructive">{message}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={handleSubmit} disabled={phase === "sending" || phase === "checking"}>
                  {phase === "sending" || phase === "checking" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {phase === "checking" ? "Đang kiểm tra bài..." : "Đang gửi..."}
                    </>
                  ) : (
                    "Đồng ý chia sẻ"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLater}
                  disabled={phase === "sending" || phase === "checking"}
                >
                  Để sau
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowcaseConsentCard;

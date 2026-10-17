import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PATH_SKILLS, SKILL_VI, type LearningPathData, type PathSkill } from "@/hooks/useLearningPath";
import { mascotSrc } from "./pathText";

const FULL_PART_MIN: Record<PathSkill, string> = { reading: "35 phút", listening: "40 phút", writing: "50 phút", speaking: "12 phút" };

interface Props {
  milestone: string | null;
  data: LearningPathData;
  onClose: () => void;
}

/** Màn chúc mừng khi làm xong đề key của 1 kỹ năng / cả lộ trình (mỗi mốc hiện 1 lần). */
const MilestoneDialog = ({ milestone, data: d, onClose }: Props) => {
  const open = !!milestone;
  const sk = milestone?.startsWith("skill:") ? (milestone.slice(6) as PathSkill) : null;
  const next = sk ? PATH_SKILLS[PATH_SKILLS.indexOf(sk) + 1] : null;
  const st = sk ? d.skills[sk] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <div className="text-2xl tracking-[6px]">🎉✨🎉</div>
        <img src={mascotSrc(sk ? "trophy" : "cheer")} alt="" className="mx-auto h-28 w-auto" />
        <DialogTitle className="font-heading text-xl">{sk ? `Xong ${SKILL_VI[sk]} rồi! 🥳` : "Bạn đã ôn hết lộ trình! 🏁"}</DialogTitle>
        <DialogDescription className="text-[13.5px]">
          {sk && st
            ? st.locked > 0
              ? <>Bạn đã làm hết <b className="text-foreground">đề key miễn phí</b> của {SKILL_VI[sk]}. Thử 1 Full Part để quen áp lực thời gian nhé.</>
              : <>Bạn đã làm hết <b className="text-foreground">{st.done}/{st.total} đề key {SKILL_VI[sk]}</b>. Thử 1 Full Part {SKILL_VI[sk]} để quen áp lực thời gian trước khi sang kỹ năng tiếp nhé.</>
            : <>Bạn đã làm hết đề key 4 kỹ năng. Giờ làm <b className="text-foreground">thi thử full</b> để đo band trước ngày thi nha!</>}
        </DialogDescription>
        <div className="mt-2 flex flex-col gap-2">
          {sk ? (
            <>
              <Button asChild onClick={onClose}><Link to={`/${sk}?tab=full`}>Làm Full Part {SKILL_VI[sk]} ({FULL_PART_MIN[sk]})</Link></Button>
              <Button variant="outline" onClick={onClose}>{next ? `Sang ${SKILL_VI[next]} luôn →` : "Để sau"}</Button>
            </>
          ) : (
            <>
              <Button asChild onClick={onClose}><Link to="/thi-thu">Làm thi thử full 🏁</Link></Button>
              <Button variant="outline" onClick={onClose}>Để sau</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneDialog;

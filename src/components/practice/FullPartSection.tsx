import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillFullSetItem } from "@/hooks/useSkillFullSets";

interface FullPartSectionProps {
  skillName: string;
  sets: SkillFullSetItem[];
  loading: boolean;
  onStart: (set: SkillFullSetItem) => void;
}

const FullPartSection = ({ skillName, sets, loading, onStart }: FullPartSectionProps) => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Luyện tập full part kỹ năng {skillName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hoàn thành tất cả các Part của kỹ năng này trong một lượt thi liên tục để đánh giá năng lực chính xác nhất.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : sets.length === 0 ? (
        <div className="text-center py-10 bg-card border border-dashed border-border rounded-xl mb-8">
          <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium text-sm">Chưa có bộ đề full part nào</p>
          <p className="text-xs text-muted-foreground mt-1">Các bộ đề liên kết Full Test sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
          {sets.map((set, index) => (
            <motion.div
              key={set.fullTestId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
            >
              <div className="group relative bg-card border-2 border-[#CC1C01] rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                <Badge className="w-fit text-[11px] font-medium mb-3 bg-[#CC1C01]/10 text-[#CC1C01] border-0">
                  Full Part
                </Badge>
                <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                  {set.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Full {skillName} • {set.partCount} Parts
                </p>
                <div className="mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    Chưa bắt đầu
                  </span>
                </div>
                <div className="flex-1" />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStart(set)}
                    className="text-[#CC1C01] hover:text-[#CC1C01] hover:bg-[#CC1C01]/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                  >
                    Bắt đầu luyện tập
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FullPartSection;

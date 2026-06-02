import { Layers, ClipboardCheck, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MergeFullPart from "./MergeFullPart";
import MergeFullTest from "./MergeFullTest";
import MergedExamsList from "./MergedExamsList";

const MergeManager = () => {
  return (
    <Tabs defaultValue="full-part" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="full-part" className="gap-1.5">
          <Layers className="w-4 h-4" /> Ghép Full Part
        </TabsTrigger>
        <TabsTrigger value="full-test" className="gap-1.5">
          <ClipboardCheck className="w-4 h-4" /> Ghép Full Test
        </TabsTrigger>
        <TabsTrigger value="merged-list" className="gap-1.5">
          <ListChecks className="w-4 h-4" /> Đề đã ghép
        </TabsTrigger>
      </TabsList>

      <TabsContent value="full-part">
        <MergeFullPart />
      </TabsContent>

      <TabsContent value="full-test">
        <MergeFullTest />
      </TabsContent>

      <TabsContent value="merged-list">
        <MergedExamsList />
      </TabsContent>
    </Tabs>
  );
};

export default MergeManager;

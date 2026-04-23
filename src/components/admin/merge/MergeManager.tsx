import { useState } from "react";
import { Layers, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MergeFullPart from "./MergeFullPart";
import MergeFullTest from "./MergeFullTest";

const MergeManager = () => {
  return (
    <Tabs defaultValue="full-part" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="full-part" className="gap-1.5">
          <Layers className="w-4 h-4" /> Ghép Full Part (theo kỹ năng)
        </TabsTrigger>
        <TabsTrigger value="full-test" className="gap-1.5">
          <ClipboardCheck className="w-4 h-4" /> Ghép Full Test (5 kỹ năng)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="full-part">
        <MergeFullPart />
      </TabsContent>

      <TabsContent value="full-test">
        <MergeFullTest />
      </TabsContent>
    </Tabs>
  );
};

export default MergeManager;

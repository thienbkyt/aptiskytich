import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Clock, Shuffle, ArrowRight, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface PartConfig {
  id: string;
  label: string;
  subtitle: string;
  dbPart: string; // matches the part value in DB
}

interface SkillPageProps {
  skill: string;
  title: string;
  description: string;
  timeLimit: string;
  icon: LucideIcon;
  accentColor: string; // e.g. "orange"
  parts: PartConfig[];
  questionEmoji: string;
  questionLabel: string;
  searchPlaceholder: string;
}

interface DBTest {
  id: string;
  title: string;
  skill: string;
  part: string;
  time_limit: number;
  question_count: number;
}

const SkillPageLayout = ({
  skill, title, description, timeLimit, icon: Icon, accentColor,
  parts, questionEmoji, questionLabel, searchPlaceholder,
}: SkillPageProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(parts[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbTests, setDbTests] = useState<DBTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: tests } = await supabase
        .from("tests")
        .select("*")
        .eq("skill", skill)
        .order("created_at");

      if (tests) {
        const { data: counts } = await supabase.from("questions").select("test_id");
        const countMap: Record<string, number> = {};
        counts?.forEach((q: any) => { if (q.test_id) countMap[q.test_id] = (countMap[q.test_id] || 0) + 1; });
        setDbTests(tests.map((t: any) => ({ ...t, question_count: countMap[t.id] || 0 })));
      }
      setLoading(false);
    };
    load();
  }, [skill]);

  const activePart = parts.find(p => p.id === activeTab);

  const filteredTests = useMemo(() => {
    if (!activePart) return [];
    return dbTests
      .filter(t => t.part.includes(activePart.label) || t.part === activePart.dbPart)
      .filter(t => searchQuery.trim() ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, dbTests, activePart]);

  const handleRandomPractice = () => {
    if (dbTests.length === 0) return;
    const randomTest = dbTests[Math.floor(Math.random() * dbTests.length)];
    navigate(`/exam/${randomTest.id}`);
  };

  const handleStartTest = (testId: string) => {
    navigate(`/exam/${testId}`);
  };

  const accentBg = `bg-${accentColor}-500/10`;
  const accentText = `text-${accentColor}-500`;
  const accentBgSolid = `bg-${accentColor}-500`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl ${accentBg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${accentText}`} />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />
                  {timeLimit}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">{title}</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
            </div>
          </div>
        </section>

        {/* Random practice */}
        <section className="border-b border-border">
          <div className="section-container py-6">
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-${accentColor}-500/5 to-${accentColor}-500/10 dark:from-${accentColor}-500/10 dark:to-${accentColor}-500/5 border border-${accentColor}-500/20 rounded-xl p-5 md:p-6`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${accentColor}-500/15 flex items-center justify-center shrink-0`}>
                  <Shuffle className={`w-5 h-5 ${accentText}`} />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground text-base">
                    Luyện {title.replace("Phần thi ", "")} ngẫu nhiên
                  </h2>
                  <p className="text-sm text-muted-foreground">Luyện 1 bộ đề ngẫu nhiên</p>
                </div>
              </div>
              <Button onClick={handleRandomPractice} className={`${accentBgSolid} hover:opacity-90 text-white shrink-0`} disabled={dbTests.length === 0}>
                Bắt đầu <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </section>

        {/* Search + Tabs + Cards */}
        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {parts.map((part) => (
                <TabsTrigger key={part.id} value={part.id} className={`flex-1 min-w-[140px] text-xs sm:text-sm py-2.5 data-[state=active]:bg-${accentColor}-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all`}>
                  <span className="font-semibold">{part.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {part.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activePart && (
            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                {activePart.label} – {activePart.subtitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{filteredTests.length} bộ đề luyện tập</p>
            </div>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground py-10">Đang tải...</p>
          ) : filteredTests.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Chưa có bộ đề nào. Vui lòng liên hệ admin để thêm đề thi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredTests.map((test, index) => (
                <motion.div key={test.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
                  <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                    <Badge variant="secondary" className={`w-fit text-[11px] font-medium mb-3 ${accentBg} ${accentText} border-0`}>
                      {test.part.split("–")[0]?.trim() || test.part}
                    </Badge>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-3">{test.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1.5">{questionEmoji} {test.question_count} câu hỏi</span>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Chưa bắt đầu</span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleStartTest(test.id)} className={`${accentText} hover:${accentBg} font-semibold gap-1 group-hover:gap-2 transition-all`}>
                        Luyện tập <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default SkillPageLayout;

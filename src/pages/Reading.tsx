import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search, Clock, Shuffle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const PARTS = [
  { id: "part1", label: "Part 1", subtitle: "Sentence comprehension" },
  { id: "part2", label: "Part 2", subtitle: "Text cohesion" },
  { id: "part3", label: "Part 3", subtitle: "Opinion matching" },
  { id: "part4", label: "Part 4", subtitle: "Long reading" },
];

const TESTS_PER_PART = 9;

interface TestCard {
  partId: string;
  partLabel: string;
  testNumber: number;
}

const generateTests = (): TestCard[] => {
  const tests: TestCard[] = [];
  PARTS.forEach((part) => {
    for (let i = 1; i <= TESTS_PER_PART; i++) {
      tests.push({ partId: part.id, partLabel: part.label, testNumber: i });
    }
  });
  return tests;
};

const allTests = generateTests();

const Reading = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("part1");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTests = useMemo(() => {
    return allTests
      .filter((t) => t.partId === activeTab)
      .filter((t) =>
        searchQuery.trim()
          ? `TEST ${t.testNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      );
  }, [activeTab, searchQuery]);

  const handleRandomPractice = () => {
    const randomTest = allTests[Math.floor(Math.random() * allTests.length)];
    console.log("Starting random practice:", randomTest);
  };

  const handleStartTest = (test: TestCard) => {
    console.log("Starting test:", test);
  };

  const activePartInfo = PARTS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-emerald-500" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />
                  30 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
                Phần thi Reading
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện đọc hiểu theo format bài thi Aptis Reading. Làm quen với các dạng câu hỏi và nâng cao kỹ năng đọc nhanh.
              </p>
            </div>
          </div>
        </section>

        {/* Random practice block */}
        <section className="border-b border-border">
          <div className="section-container py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Shuffle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground text-base">
                    Luyện Reading ngẫu nhiên
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Luyện 1 bộ đề Aptis Reading ngẫu nhiên
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRandomPractice}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
              >
                Bắt đầu
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </section>

        {/* Search + Tabs + Cards */}
        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm bộ đề Reading..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {PARTS.map((part) => (
                <TabsTrigger
                  key={part.id}
                  value={part.id}
                  className="flex-1 min-w-[140px] text-xs sm:text-sm py-2.5 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <span className="font-semibold">{part.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {part.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activePartInfo && (
            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                {activePartInfo.label} – {activePartInfo.subtitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredTests.length} bộ đề luyện tập
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredTests.map((test, index) => (
              <motion.div
                key={`${test.partId}-${test.testNumber}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                  <Badge
                    variant="secondary"
                    className="w-fit text-[11px] font-medium mb-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0"
                  >
                    {test.partLabel}
                  </Badge>

                  <h3 className="text-xl font-heading font-bold text-foreground mb-3">
                    TEST {test.testNumber}
                  </h3>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1.5">📖 10 câu hỏi</span>
                  </div>

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
                      onClick={() => handleStartTest(test)}
                      className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                    >
                      Luyện tập
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredTests.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Không tìm thấy bộ đề nào phù hợp.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Reading;

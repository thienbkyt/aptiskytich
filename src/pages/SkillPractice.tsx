import { useState } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  BookOpen,
  Library,
  Brain,
  RotateCcw,
  GraduationCap,
  Layers,
  Eye,
  Play,
  Sparkles,
} from "lucide-react";

import { VOCAB_SETS } from "@/data/vocabSets";

/* ───── colour helpers (teal / green) ───── */
const TEAL = {
  badge: "bg-[hsl(170,60%,92%)] text-[hsl(170,60%,28%)] border-[hsl(170,60%,80%)]",
  badgeAdv: "bg-[hsl(150,50%,90%)] text-[hsl(150,50%,28%)] border-[hsl(150,50%,75%)]",
  accent: "hsl(170,60%,38%)",
  ring: "ring-[hsl(170,60%,50%)]",
  tab: "data-[state=active]:bg-[hsl(170,55%,40%)] data-[state=active]:text-white",
};

const SkillPractice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const skill = location.pathname.replace("/", "");
  const [search, setSearch] = useState("");

  // only vocabulary uses the new layout
  if (skill !== "vocabulary") {
    return <Navigate to="/" replace />;
  }

  const filtered = VOCAB_SETS.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.group.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* ── Header ── */}
        <section className="bg-gradient-to-br from-[hsl(170,50%,96%)] to-[hsl(170,40%,90%)] dark:from-[hsl(170,30%,10%)] dark:to-[hsl(170,20%,14%)] border-b border-border">
          <div className="section-container py-10 md:py-14 flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(170,55%,40%)] text-white shrink-0">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
                Học từ vựng Aptis
              </h1>
              <p className="text-muted-foreground mt-1 text-base md:text-lg">
                Ôn luyện từ vựng theo bộ đề thi & quản lý kho từ cá nhân
              </p>
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div className="section-container py-8">
          <Tabs defaultValue="aptis" className="w-full">
            <TabsList className="w-full max-w-md mx-auto md:mx-0 h-12 p-1 bg-muted rounded-xl mb-8">
              <TabsTrigger
                value="aptis"
                className={`flex-1 h-full rounded-lg text-sm font-semibold transition-all ${TEAL.tab}`}
              >
                <Library className="w-4 h-4 mr-2" />
                Từ vựng bài thi Aptis
              </TabsTrigger>
              <TabsTrigger
                value="my"
                className={`flex-1 h-full rounded-lg text-sm font-semibold transition-all ${TEAL.tab}`}
              >
                <Brain className="w-4 h-4 mr-2" />
                Kho từ vựng của tôi
              </TabsTrigger>
            </TabsList>

            {/* ════════ TAB 1 ════════ */}
            <TabsContent value="aptis">
              {/* search */}
              <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm bộ từ vựng…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((set) => (
                  <Card
                    key={set.id}
                    className="group hover:shadow-lg transition-shadow border border-border"
                  >
                    <CardContent className="p-5 flex flex-col gap-3">
                      <Badge
                        variant="outline"
                        className={
                          set.group === "APTIS ADVANCED"
                            ? TEAL.badgeAdv
                            : TEAL.badge
                        }
                      >
                        {set.group}
                      </Badge>
                      <h3 className="font-heading font-semibold text-foreground text-base leading-snug">
                        {set.title}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {set.words.length} từ vựng
                      </span>
                      <div className="flex gap-2 mt-auto pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 border-[hsl(170,50%,60%)] text-[hsl(170,55%,35%)] hover:bg-[hsl(170,50%,95%)]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem nhanh
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,34%)] text-white"
                          onClick={() => navigate(`/vocabulary/${set.id}`)}
                        >
                          <Play className="w-3.5 h-3.5" /> Luyện tập
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filtered.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-12">
                    Không tìm thấy bộ từ nào phù hợp.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ════════ TAB 2 ════════ */}
            <TabsContent value="my">
              {/* stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                <StatCard
                  icon={<GraduationCap className="w-6 h-6" />}
                  label="Từ đã thuộc"
                  value={0}
                  color="hsl(170,55%,40%)"
                />
                <StatCard
                  icon={<RotateCcw className="w-6 h-6" />}
                  label="Từ cần ôn"
                  value={0}
                  color="hsl(35,90%,50%)"
                />
                <StatCard
                  icon={<Layers className="w-6 h-6" />}
                  label="Tổng từ đã học"
                  value={0}
                  color="hsl(200,70%,50%)"
                />
              </div>

              {/* game buttons */}
              <h2 className="font-heading font-bold text-lg text-foreground mb-4">
                Luyện tập từ vựng
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
                <GameCard
                  title="Flashcards"
                  description="Lật thẻ để ôn lại nghĩa và cách dùng từ"
                  icon={<Sparkles className="w-7 h-7" />}
                />
                <GameCard
                  title="Matching"
                  description="Ghép từ với nghĩa đúng trong thời gian giới hạn"
                  icon={<Layers className="w-7 h-7" />}
                />
              </div>

              {/* saved words placeholder */}
              <h2 className="font-heading font-bold text-lg text-foreground mb-4">
                Từ vựng đã lưu
              </h2>
              <Card className="border border-border">
                <CardContent className="py-14 text-center text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>Bạn chưa lưu từ vựng nào.</p>
                  <p className="text-sm mt-1">
                    Khi làm bài, nhấn vào từ để tra cứu và lưu vào kho.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

/* ───── sub-components ───── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color, color: "white" }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border border-border hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-[hsl(170,50%,94%)] dark:bg-[hsl(170,30%,18%)] flex items-center justify-center text-[hsl(170,55%,40%)] shrink-0 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          Sắp ra mắt
        </Badge>
      </CardContent>
    </Card>
  );
}

export default SkillPractice;

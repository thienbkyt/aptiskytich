import { useState, useEffect } from "react";
import { Shield, Database, FileSpreadsheet, BookOpen, Combine, AlertTriangle, Bell, Sparkles, Newspaper, ListMusic } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TestManager from "@/components/admin/TestManager";
import QuestionManager from "@/components/admin/QuestionManager";
import ImportCenter from "@/components/admin/import/ImportCenter";
import VocabManager from "@/components/admin/VocabManager";
import MergeManager from "@/components/admin/merge/MergeManager";
import BlogManager from "@/components/admin/blog/BlogManager";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface SelectedTest {
  id: string;
  title: string;
  skill: string;
}

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedTest, setSelectedTest] = useState<SelectedTest | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {authLoading ? <p>Đang tải...</p> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Admin Import Center</h1>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                to="/admin/notifications"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Bell className="w-4 h-4" />
                Thông báo người dùng
              </Link>
              <Link
                to="/admin/prediction"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Key Dự Đoán
              </Link>
              <Link
                to="/admin/nghe-chep"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <ListMusic className="w-4 h-4" />
                Nghe chép chính tả
              </Link>
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Xem báo lỗi câu hỏi
              </Link>
            </div>
          </div>

          <Tabs defaultValue="import-center" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="import-center" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Import Center
              </TabsTrigger>
              <TabsTrigger value="merge" className="gap-2">
                <Combine className="w-4 h-4" /> Ghép đề
              </TabsTrigger>
              <TabsTrigger value="vocab" className="gap-2">
                <BookOpen className="w-4 h-4" /> Từ vựng
              </TabsTrigger>
              <TabsTrigger value="blog" className="gap-2">
                <Newspaper className="w-4 h-4" /> Blog
              </TabsTrigger>
              <TabsTrigger value="legacy" className="gap-2">
                <Database className="w-4 h-4" /> Quản lý bộ đề cũ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import-center">
              <ImportCenter />
            </TabsContent>

            <TabsContent value="merge">
              <MergeManager />
            </TabsContent>

            <TabsContent value="vocab">
              <VocabManager />
            </TabsContent>

            <TabsContent value="blog">
              <BlogManager />
            </TabsContent>

            <TabsContent value="legacy">
              {selectedTest ? (
                <QuestionManager
                  testId={selectedTest.id}
                  testTitle={selectedTest.title}
                  testSkill={selectedTest.skill}
                  onBack={() => setSelectedTest(null)}
                />
              ) : (
                <TestManager
                  onSelectTest={(t) => setSelectedTest({ id: t.id, title: t.title, skill: t.skill })}
                  selectedTestId={selectedTest?.id}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;

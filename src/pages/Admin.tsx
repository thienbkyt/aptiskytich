import { useState, useEffect } from "react";
import { Shield, FileSpreadsheet, Database, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkImport from "@/components/admin/BulkImport";
import TestManager from "@/components/admin/TestManager";
import QuestionManager from "@/components/admin/QuestionManager";
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Render nothing until auth is confirmed AND user is verified as admin server-side
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
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">Quản trị đề thi</h1>
          </div>

          <Tabs defaultValue="tests" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tests" className="gap-2">
                <Database className="w-4 h-4" /> Quản lý bộ đề
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Import Excel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tests">
              {selectedTest ? (
                <QuestionManager
                  testId={selectedTest.id}
                  testTitle={selectedTest.title}
                  testSkill={selectedTest.skill}
                  onBack={() => setSelectedTest(null)}
                />
              ) : (
                <TestManager
                  key={refreshKey}
                  onSelectTest={(t) => setSelectedTest({ id: t.id, title: t.title, skill: t.skill })}
                  selectedTestId={selectedTest?.id}
                />
              )}
            </TabsContent>

            <TabsContent value="import">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h2 className="font-heading font-bold text-foreground">Nhập liệu hàng loạt từ Excel</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload file Excel để tự động tạo bộ đề và nhập câu hỏi. Các câu hỏi cùng test_title + skill + part sẽ được gom vào một bộ đề.
                </p>
                <BulkImport onImportComplete={() => setRefreshKey((k) => k + 1)} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;

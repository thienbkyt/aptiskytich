import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Shield, FileText, HelpCircle, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminTestManager from "@/components/admin/AdminTestManager";
import AdminQuestionManager from "@/components/admin/AdminQuestionManager";
import AdminImport from "@/components/admin/AdminImport";

const SIDEBAR_ITEMS = [
  { id: "tests", label: "Quản lý đề thi", icon: FileText },
  { id: "questions", label: "Quản lý câu hỏi", icon: HelpCircle },
  { id: "import", label: "Import dữ liệu", icon: Upload },
];

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("tests");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p>Đang tải...</p></div>;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 shrink-0`}>
        <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <Shield className="w-5 h-5 text-sidebar-primary shrink-0" />
          {!sidebarCollapsed && <span className="font-heading font-bold text-sidebar-foreground text-sm">Admin Panel</span>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full text-sidebar-foreground/50" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="h-16 flex items-center px-6 border-b border-border bg-card">
          <h1 className="font-heading font-bold text-foreground">
            {SIDEBAR_ITEMS.find(i => i.id === activeSection)?.label}
          </h1>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate("/")}>
            ← Về trang chủ
          </Button>
        </div>
        <div className="p-6">
          {activeSection === "tests" && <AdminTestManager />}
          {activeSection === "questions" && <AdminQuestionManager />}
          {activeSection === "import" && <AdminImport />}
        </div>
      </main>
    </div>
  );
};

export default Admin;

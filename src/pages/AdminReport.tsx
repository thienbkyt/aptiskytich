import { useEffect } from "react";
import { Shield, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AutoCostTab from "@/components/admin/report/AutoCostTab";
import OutcomesTab from "@/components/admin/report/OutcomesTab";
import ActivityTab from "@/components/admin/report/ActivityTab";
import ContentQualityTab from "@/components/admin/report/ContentQualityTab";
import OpsTab from "@/components/admin/report/OpsTab";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const AdminReport = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
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
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Admin Report</h1>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/report/pricing">
                <Settings className="w-4 h-4" />
                Quản lý đơn giá
              </Link>
            </Button>
          </div>

          <Tabs defaultValue="outcomes" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="outcomes">Học tập</TabsTrigger>
              <TabsTrigger value="activity">Người dùng</TabsTrigger>
              <TabsTrigger value="content">Nội dung</TabsTrigger>
              <TabsTrigger value="ops">Vận hành</TabsTrigger>
              <TabsTrigger value="auto">Chi phí</TabsTrigger>
            </TabsList>

            <TabsContent value="outcomes" className="mt-0"><OutcomesTab /></TabsContent>
            <TabsContent value="activity" className="mt-0"><ActivityTab /></TabsContent>
            <TabsContent value="content" className="mt-0"><ContentQualityTab /></TabsContent>
            <TabsContent value="ops" className="mt-0"><OpsTab /></TabsContent>
            <TabsContent value="auto" className="mt-0"><AutoCostTab /></TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminReport;

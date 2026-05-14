import { Shield } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const AdminReport = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">Admin Report</h1>
          </div>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground text-lg">Đang xây dựng...</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminReport;

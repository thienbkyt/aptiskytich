import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ListMusic } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import DictationManager from "@/components/admin/DictationManager";

const AdminDictation = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, loading, navigate]);

  if (loading || !user || !isAdmin) {
    return <div className="min-h-screen bg-background flex items-center justify-center">{loading ? <p>Đang tải...</p> : null}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-[144px] md:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Admin
            </Button>
            <ListMusic className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">Nghe chép chính tả</h1>
          </div>
          <DictationManager />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminDictation;

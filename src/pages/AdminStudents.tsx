import { useEffect } from "react";
import { Users } from "lucide-react";
import StudentManager from "@/components/admin/StudentManager";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const AdminStudents = () => {
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
      <div className="pt-[144px] md:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-3 mb-8">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">Người dùng</h1>
          </div>
          <StudentManager />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminStudents;

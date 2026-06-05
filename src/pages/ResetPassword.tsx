import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowRight, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("password should be at least") || m.includes("password should contain")) return "Mật khẩu phải có ít nhất 6 ký tự";
  if (m.includes("same password") || m.includes("new password should be different")) return "Mật khẩu mới phải khác mật khẩu cũ";
  if (m.includes("session") || m.includes("expired") || m.includes("invalid")) return "Phiên đặt lại đã hết hạn, vui lòng yêu cầu lại email";
  if (m.includes("rate limit") || m.includes("too many")) return "Bạn thao tác quá nhanh, vui lòng thử lại sau";
  return "Đã có lỗi xảy ra, vui lòng thử lại";
};

const GradientBg = ({ children }: { children: React.ReactNode }) => (
  <div
    className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
    style={{ background: "linear-gradient(180deg, #4D0D0D 0%, #CC1C01 100%)" }}
  >
    <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: "#FEAD5F" }} />
    <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20" style={{ background: "#FEAD5F" }} />
    {children}
  </div>
);

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check URL for explicit Supabase errors (expired/invalid link)
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const errCode = params.get("error") || params.get("error_code");
    const errDesc = params.get("error_description");
    if (errCode) {
      setLinkError(errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "Link không hợp lệ hoặc đã hết hạn");
      setChecking(false);
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    // Also accept an existing session (event may have fired before mount)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmError("");

    if (password !== confirmPassword) {
      setConfirmError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: translateError(error.message), variant: "destructive" });
    } else {
      toast({ title: "Thành công!", description: "Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại." });
      await supabase.auth.signOut();
      navigate("/auth");
    }
  };

  if (linkError) {
    return (
      <GradientBg>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Aptis Kỳ Tích" className="h-28 w-28 object-contain mx-auto mb-3" />
            <h1 className="text-3xl font-heading font-extrabold text-white drop-shadow-sm">Đặt lại mật khẩu</h1>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="font-heading font-bold text-foreground text-lg mb-2">Link không hợp lệ hoặc đã hết hạn</h2>
            <p className="text-sm text-muted-foreground mb-6">Vui lòng yêu cầu gửi lại email đặt lại mật khẩu.</p>
            <Button onClick={() => navigate("/auth")} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              Về trang đăng nhập <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </GradientBg>
    );
  }

  if (checking || !ready) {
    return (
      <GradientBg>
        <p className="text-white relative z-10">Đang xác thực link...</p>
      </GradientBg>
    );
  }

  return (
    <GradientBg>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Aptis Kỳ Tích" className="h-28 w-28 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-heading font-extrabold text-white drop-shadow-sm">Đặt lại mật khẩu</h1>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPw ? "text" : "password"}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPw ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError("");
                  }}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
              </div>
              {confirmError && <p className="text-xs text-destructive mt-1">{confirmError}</p>}
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
              {loading ? "Đang xử lý..." : (<>Đặt lại mật khẩu <ArrowRight className="w-4 h-4" /></>)}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </div>
      </motion.div>
    </GradientBg>
  );
};

export default ResetPassword;

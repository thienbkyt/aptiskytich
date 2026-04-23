import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Đăng nhập thất bại", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Đăng ký thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đăng ký thành công!", description: "Kiểm tra email để xác nhận tài khoản." });
      setMode("login");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã gửi email!", description: "Kiểm tra hộp thư để đặt lại mật khẩu." });
    }
  };

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast({ title: "Đăng nhập Google thất bại", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  };

  const subtitle =
    mode === "login"
      ? "Chào mừng trở lại 👋"
      : mode === "signup"
      ? "Ôn Luyện Và Làm Bài Thi Thử Aptis Miễn Phí Giống Bài Thi Thật 100%"
      : "Đặt lại mật khẩu";

  const showSocialProof = mode !== "forgot";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #4D0D0D 0%, #CC1C01 100%)",
      }}
    >
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ background: "#FEAD5F" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20"
        style={{ background: "#FEAD5F" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20"
        style={{ background: "#CC1C01" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-6">
          <img src="/9154f592-dfc4-4450-bbe4-e708202f75b4.png" alt="Aptis Kỳ Tích" className="h-32 w-32 mx-auto mb-3 object-contain my-0" />
          <h1 className="text-3xl font-heading font-extrabold text-white drop-shadow-sm">
            Aptis <span style={{ color: "#FEAD5F" }}>Kỳ Tích</span>
          </h1>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <p className="text-foreground font-semibold text-base">{subtitle}</p>
            {showSocialProof && (
              <p className="text-xs text-muted-foreground mt-2">
                🔥 5,000+ học viên đã tin dùng
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" && (
              <motion.form
                key="login"
                onSubmit={handleLogin}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
                  {loading ? "Đang xử lý..." : (<>Đăng nhập <ArrowRight className="w-4 h-4" /></>)}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">hoặc</span>
                  </div>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
                  Đăng nhập với Google
                </Button>
                <div className="flex justify-between text-sm pt-1">
                  <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">Quên mật khẩu?</button>
                  <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">Tạo tài khoản</button>
                </div>
              </motion.form>
            )}

            {mode === "signup" && (
              <motion.form
                key="signup"
                onSubmit={handleSignup}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Họ tên</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="name" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email2" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="password2" type="password" placeholder="Tối thiểu 6 ký tự" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
                  {loading ? "Đang xử lý..." : (<>Đăng ký <ArrowRight className="w-4 h-4" /></>)}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">hoặc</span>
                  </div>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
                  Đăng ký với Google
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-1">
                  Đã có tài khoản?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Đăng nhập</button>
                </p>
              </motion.form>
            )}

            {mode === "forgot" && (
              <motion.form
                key="forgot"
                onSubmit={handleForgot}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email3">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email3" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
                  {loading ? "Đang xử lý..." : (<>Gửi link đặt lại <ArrowRight className="w-4 h-4" /></>)}
                </Button>
                <p className="text-center text-sm">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">← Quay lại đăng nhập</button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Về trang chủ
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;

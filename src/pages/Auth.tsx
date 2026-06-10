import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ParticlesBackground from "@/components/ui/particles-background";

type AuthMode = "login" | "signup" | "forgot";

// Dịch thông báo lỗi Supabase sang tiếng Việt
const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Email này đã được đăng ký";
  if (m.includes("email not confirmed")) return "Email chưa được xác nhận, vui lòng kiểm tra hộp thư";
  if (m.includes("password should be at least") || m.includes("password should contain")) return "Mật khẩu phải có ít nhất 6 ký tự";
  if (m.includes("invalid email")) return "Email không hợp lệ";
  if (m.includes("rate limit") || m.includes("too many")) return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút";
  if (m.includes("network")) return "Lỗi kết nối mạng, vui lòng thử lại";
  return "Đã có lỗi xảy ra, vui lòng thử lại";
};

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const getPasswordStrength = (pw: string): { label: string; level: 0 | 1 | 2 | 3; color: string } => {
  if (!pw) return { label: "", level: 0, color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[A-Z]/.test(pw) && /[0-9]/.test(pw))) score++;
  if (score <= 1) return { label: "Yếu", level: 1, color: "bg-destructive" };
  if (score === 2) return { label: "Trung bình", level: 2, color: "bg-yellow-500" };
  return { label: "Mạnh", level: 3, color: "bg-green-500" };
};

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginErr(null);
    setNeedsConfirm(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const viMsg = translateError(error.message);
      setLoginErr(viMsg);
      if (error.message.toLowerCase().includes("email not confirmed")) setNeedsConfirm(true);
      toast({ title: "Đăng nhập thất bại", description: viMsg, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  const handleResendConfirm = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      toast({ title: "Lỗi", description: translateError(error.message), variant: "destructive" });
    } else {
      toast({ title: "Đã gửi lại email xác nhận", description: "Vui lòng kiểm tra hộp thư." });
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
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Đăng ký thất bại", description: translateError(error.message), variant: "destructive" });
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
      toast({ title: "Lỗi", description: translateError(error.message), variant: "destructive" });
    } else {
      setForgotSentTo(email);
      setResendIn(60);
    }
  };

  const handleResendForgot = async () => {
    if (resendIn > 0 || !forgotSentTo) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotSentTo, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: translateError(error.message), variant: "destructive" });
    } else {
      toast({ title: "Đã gửi lại email", description: forgotSentTo });
      setResendIn(60);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      setGoogleLoading(false);
      toast({ title: "Đăng nhập Google thất bại", description: translateError(result.error.message), variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    setGoogleLoading(false);
    navigate("/dashboard");
  };

  const subtitle =
    mode === "login"
      ? "Chào mừng trở lại 👋"
      : mode === "signup"
      ? "Ôn Luyện Và Làm Bài Thi Thử Aptis Miễn Phí Giống Bài Thi Thật 100%"
      : "Đặt lại mật khẩu";

  const showSocialProof = mode !== "forgot";

  const PasswordInput = ({ id, value, onChange, placeholder, minLength }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number }) => (
    <div className="relative">
      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
      <Input
        id={id}
        type={showPw ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        required
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setShowPw((v) => !v)}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #4D0D0D 0%, #CC1C01 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: "#FEAD5F" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20" style={{ background: "#FEAD5F" }} />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: "#CC1C01" }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
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
              <p className="text-xs mt-2 text-secondary-foreground">
                🔥 96.03% học viên ôn luyện và đạt AIM trong lần thi đầu tiên
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" && (
              <motion.form key="login" onSubmit={handleLogin} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <PasswordInput id="password" value={password} onChange={setPassword} placeholder="••••••••" />
                </div>

                {loginErr && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {loginErr}
                    {needsConfirm && (
                      <button type="button" onClick={handleResendConfirm} className="block mt-2 text-primary hover:underline font-medium">
                        Gửi lại email xác nhận
                      </button>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
                  {loading ? "Đang xử lý..." : (<>Đăng nhập <ArrowRight className="w-4 h-4" /></>)}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">hoặc</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={googleLoading}>
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                  Đăng nhập với Google
                </Button>
                <div className="flex justify-between text-sm pt-1">
                  <button type="button" onClick={() => { setMode("forgot"); setLoginErr(null); }} className="text-primary hover:underline">Quên mật khẩu?</button>
                  <button type="button" onClick={() => { setMode("signup"); setLoginErr(null); }} className="text-primary hover:underline">Tạo tài khoản</button>
                </div>
              </motion.form>
            )}

            {mode === "signup" && (
              <motion.form key="signup" onSubmit={handleSignup} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
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
                  <PasswordInput id="password2" value={password} onChange={setPassword} placeholder="Tối thiểu 6 ký tự" minLength={6} />
                  {password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= pwStrength.level ? pwStrength.color : "bg-muted"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Độ mạnh: <span className="font-medium">{pwStrength.label}</span></p>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2" disabled={loading}>
                  {loading ? "Đang xử lý..." : (<>Đăng ký <ArrowRight className="w-4 h-4" /></>)}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">hoặc</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={googleLoading}>
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                  Đăng ký với Google
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-1">
                  Đã có tài khoản?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Đăng nhập</button>
                </p>
              </motion.form>
            )}

            {mode === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                {forgotSentTo ? (
                  <div className="space-y-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <h2 className="font-heading font-bold text-foreground text-lg mb-1">Đã gửi email!</h2>
                      <p className="text-sm text-muted-foreground">Đã gửi email đến <span className="font-medium text-foreground">{forgotSentTo}</span>. Vui lòng kiểm tra hộp thư (cả mục Spam).</p>
                    </div>
                    <Button type="button" onClick={handleResendForgot} disabled={resendIn > 0 || loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : (loading ? "Đang gửi..." : "Gửi lại email")}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => { setForgotSentTo(null); setResendIn(0); }}>
                      Nhập email khác
                    </Button>
                    <button type="button" onClick={() => { setMode("login"); setForgotSentTo(null); }} className="text-sm text-primary hover:underline">← Quay lại đăng nhập</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-4">
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
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <button type="button" onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Về trang chủ
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;

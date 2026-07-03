import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

interface Ctx {
  openLogin: (afterLogin?: () => void) => void;
}
const LoginGateContext = createContext<Ctx>({ openLogin: () => {} });
export const useLoginGate = () => useContext(LoginGateContext);

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

export function LoginGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const afterRef = useRef<(() => void) | null>(null);
  const { user } = useAuth();

  const openLogin = useCallback((afterLogin?: () => void) => {
    afterRef.current = afterLogin ?? null;
    setOpen(true);
  }, []);

  // Auto-run pending callback when user becomes authenticated (e.g. after Google OAuth popup)
  useEffect(() => {
    if (user && afterRef.current) {
      const cb = afterRef.current;
      afterRef.current = null;
      setOpen(false);
      setTimeout(() => cb(), 150);
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Đăng nhập thất bại. Kiểm tra email/mật khẩu.");
      return;
    }
    setOpen(false);
    setEmail("");
    setPassword("");
    const cb = afterRef.current;
    afterRef.current = null;
    setTimeout(() => cb?.(), 150);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Đăng nhập Google thất bại.");
    }
    // If redirected, browser leaves the page. If tokens returned inline, useEffect above fires.
  };

  return (
    <LoginGateContext.Provider value={{ openLogin }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đăng nhập để bắt đầu làm đề</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Đăng nhập <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">hoặc</span>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={googleLoading}>
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Đăng nhập với Google
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-1">
            Chưa có tài khoản?{" "}
            <Link to="/auth" className="text-primary hover:underline" onClick={() => setOpen(false)}>
              Đăng ký
            </Link>
          </p>
        </DialogContent>
      </Dialog>
    </LoginGateContext.Provider>
  );
}

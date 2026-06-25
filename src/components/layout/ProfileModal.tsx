import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogOut, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import ContactAdminLinks from "@/components/ContactAdminLinks";
import { parseDateSafe } from "@/lib/safeDate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("password should be at least")) return "Mật khẩu phải có ít nhất 6 ký tự.";
  if (m.includes("new password should be different")) return "Mật khẩu mới phải khác mật khẩu cũ.";
  if (m.includes("same password")) return "Mật khẩu mới phải khác mật khẩu cũ.";
  if (m.includes("weak password")) return "Mật khẩu quá yếu, hãy chọn mật khẩu mạnh hơn.";
  if (m.includes("rate limit")) return "Bạn thao tác quá nhanh, vui lòng thử lại sau.";
  return "Không thể đổi mật khẩu. " + msg;
}

const ProfileModal = ({ open, onOpenChange }: Props) => {
  const { user, signOut } = useAuth();
  const { isPro, isPremium, proUntil } = useIsPro();
  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const proStatusText = (() => {
    if (isPremium) return "Premium · Trọn đời";
    if (!isPro) return "Bạn đang dùng gói Free";
    if (!proUntil) return "Pro · Trọn đời";
    const d = parseDateSafe(proUntil);
    if (!d) return "Pro";
    return `Pro · hết hạn ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  })();

  useEffect(() => {
    if (!open || !user) return;
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? "");
        setLoadingProfile(false);
      });
  }, [open, user]);

  const saveName = async () => {
    if (!user) return;
    const name = displayName.trim();
    if (!name) {
      toast.error("Tên hiển thị không được để trống.");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("user_id", user.id);
    setSavingName(false);
    if (error) {
      toast.error("Không thể lưu tên hiển thị. " + error.message);
    } else {
      toast.success("Đã lưu tên hiển thị.");
    }
  };

  const changePassword = async () => {
    if (password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      toast.error("Hai mật khẩu không khớp.");
      return;
    }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password });
    setChangingPwd(false);
    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      toast.success("Đã đổi mật khẩu thành công.");
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thông tin tài khoản</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">Tên hiển thị</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={loadingProfile ? "Đang tải..." : "Nhập tên hiển thị"}
                disabled={loadingProfile}
              />
              <Button onClick={saveName} disabled={savingName || loadingProfile}>
                {savingName ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user?.email ?? ""} readOnly disabled />
            <p className="text-xs text-muted-foreground">Email không thể thay đổi.</p>
          </div>

          {/* Change password */}
          <div className="space-y-2 border-t border-border pt-4">
            <Label>Đổi mật khẩu</Label>
            <Input
              type="password"
              placeholder="Mật khẩu mới"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <Button
              onClick={changePassword}
              disabled={changingPwd || !password || !confirm}
              className="w-full"
            >
              {changingPwd ? "Đang đổi..." : "Đổi mật khẩu"}
            </Button>
          </div>

          {/* My plan */}
          <div className="border-t border-border pt-4 space-y-2">
            <Label>Gói của tôi</Label>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPro ? "bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] text-white" : "bg-muted text-muted-foreground"}`}>
                  <Crown className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold text-foreground truncate">{proStatusText}</span>
              </div>
              <Button asChild size="sm" variant={isPro ? "outline" : "default"} className={isPro ? "" : "bg-[#CC1C01] hover:bg-[#4D0D0D] text-white"}>
                <Link to="/pricing" onClick={() => onOpenChange(false)}>
                  {isPro ? "Xem gói" : "Nâng cấp"}
                </Link>
              </Button>
            </div>
          </div>

          {/* Contact admin */}
          <div className="border-t border-border pt-4 space-y-2">
            <Label>Liên hệ hỗ trợ</Label>
            <ContactAdminLinks />
          </div>

          {/* Logout */}
          <div className="border-t border-border pt-4">
            <Button variant="outline" className="w-full gap-2" onClick={() => { onOpenChange(false); signOut(); }}>
              <LogOut className="w-4 h-4" /> Đăng xuất
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;

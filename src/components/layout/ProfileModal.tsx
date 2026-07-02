import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogOut, Crown, Smartphone, Tablet, Monitor } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import ContactAdminLinks from "@/components/ContactAdminLinks";
import { parseDateSafe } from "@/lib/safeDate";
import { getDeviceId, type DeviceType } from "@/lib/deviceInfo";

interface DeviceRow {
  id: string;
  device_id: string;
  device_type: DeviceType;
  device_label: string | null;
  last_seen_at: string;
}

const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  desktop: "Máy tính",
};

function relTime(iso: string): string {
  const d = parseDateSafe(iso);
  if (!d) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return "vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  return `${day} ngày trước`;
}


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
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const myDeviceId = getDeviceId();

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

  const loadDevices = async (uid: string) => {
    setLoadingDevices(true);
    const { data } = await supabase
      .from("user_devices")
      .select("id, device_id, device_type, device_label, last_seen_at")
      .eq("user_id", uid)
      .order("last_seen_at", { ascending: false });
    setDevices((data as DeviceRow[] | null) ?? []);
    setLoadingDevices(false);
  };

  useEffect(() => {
    if (!open || !user) return;
    loadDevices(user.id);
    const channel = supabase
      .channel(`profile-devices-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_devices", filter: `user_id=eq.${user.id}` },
        () => loadDevices(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user]);

  const logoutDevice = async (d: DeviceRow) => {
    const isCurrent = d.device_id === myDeviceId;
    const ok = window.confirm(
      isCurrent
        ? "Đăng xuất thiết bị này? Bạn sẽ bị đăng xuất ngay."
        : "Đăng xuất thiết bị đã chọn?"
    );
    if (!ok) return;
    const { error } = await supabase.from("user_devices").delete().eq("id", d.id);
    if (error) {
      toast.error("Không thể đăng xuất thiết bị. " + error.message);
      return;
    }
    setDevices((prev) => prev.filter((x) => x.id !== d.id));
    if (isCurrent) {
      onOpenChange(false);
      signOut();
    } else {
      toast.success("Đã đăng xuất thiết bị.");
    }
  };


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
              <Button asChild size="sm" variant={isPremium ? "outline" : isPro ? "outline" : "default"} className={isPremium || isPro ? "" : "bg-[#CC1C01] hover:bg-[#4D0D0D] text-white"}>
                <Link to="/pricing" onClick={() => onOpenChange(false)}>
                  {isPremium ? "Xem gói" : isPro ? "Nâng cấp Premium" : "Nâng cấp"}
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

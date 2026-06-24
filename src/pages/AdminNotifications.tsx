import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Trash2, Pencil, Power, Plus, X } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { parseDateSafe } from "@/lib/safeDate";

type NotifType = "feature" | "content" | "general";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  link_url: string | null;
  is_active: boolean;
  created_at: string;
}

const TYPE_LABEL: Record<NotifType, string> = {
  feature: "Tính năng mới",
  content: "Update bài",
  general: "Thông báo chung",
};

const TYPE_BADGE: Record<NotifType, string> = {
  feature: "bg-[#FEAD5F] text-[#4D0D0D]",
  content: "bg-[#CC1C01] text-white",
  general: "bg-[#4D0D0D] text-white",
};

const AdminNotifications = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotifType>("general");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, type, link_url, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Lỗi tải thông báo", description: error.message, variant: "destructive" });
    } else {
      setItems((data || []) as Notification[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchAll();
  }, [user, isAdmin]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setType("general");
    setLinkUrl("");
    setIsActive(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Thiếu nội dung", description: "Nhập tiêu đề và nội dung.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      type,
      link_url: linkUrl.trim() || null,
      is_active: isActive,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("notifications").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("notifications")
        .insert({ ...payload, created_by: user!.id }));
    }
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Đã cập nhật" : "Đã đăng thông báo" });
    resetForm();
    fetchAll();
  };

  const handleEdit = (n: Notification) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setType(n.type);
    setLinkUrl(n.link_url || "");
    setIsActive(n.is_active);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = async (n: Notification) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_active: !n.is_active })
      .eq("id", n.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const handleDelete = async (n: Notification) => {
    if (!confirm(`Xóa thông báo "${n.title}"?`)) return;
    const { error } = await supabase.from("notifications").delete().eq("id", n.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xóa" });
    fetchAll();
  };

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
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Bell className="w-6 h-6 text-[#CC1C01]" />
            <h1 className="text-2xl font-heading font-extrabold text-foreground">
              Thông báo tới người dùng
            </h1>
          </div>

          {/* Form */}
          <div className="rounded-xl border-2 border-[#FEAD5F]/40 bg-card p-6 mb-10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#4D0D0D]">
                {editingId ? "Sửa thông báo" : "Soạn thông báo mới"}
              </h2>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1" /> Hủy sửa
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="title">Tiêu đề</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đã thêm bộ đề Listening mới"
                />
              </div>

              <div>
                <Label htmlFor="body">Nội dung</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Mô tả chi tiết thông báo..."
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Loại</Label>
                  <Select value={type} onValueChange={(v) => setType(v as NotifType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Tính năng mới</SelectItem>
                      <SelectItem value="content">Update bài</SelectItem>
                      <SelectItem value="general">Thông báo chung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="link">Link (tùy chọn)</Label>
                  <Input
                    id="link"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="active" className="cursor-pointer">
                  Hiển thị (active)
                </Label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#CC1C01] hover:bg-[#4D0D0D] text-white w-fit"
              >
                <Plus className="w-4 h-4 mr-2" />
                {editingId ? "Lưu thay đổi" : "Đăng thông báo"}
              </Button>
            </div>
          </div>

          {/* List */}
          <div>
            <h2 className="text-lg font-bold text-[#4D0D0D] mb-4">
              Danh sách thông báo ({items.length})
            </h2>
            {loading ? (
              <p className="text-muted-foreground">Đang tải...</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground">Chưa có thông báo nào.</p>
            ) : (
              <div className="space-y-3">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg border bg-card p-4 flex flex-col md:flex-row md:items-start gap-3 ${
                      n.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_BADGE[n.type]}`}>
                          {TYPE_LABEL[n.type] || n.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(parseDateSafe(n.created_at) ?? new Date(0)).toLocaleString("vi-VN")}
                        </span>
                        {!n.is_active && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            Đã tắt
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground truncate">{n.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {n.body}
                      </p>
                      {n.link_url && (
                        <a
                          href={n.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#CC1C01] hover:underline break-all"
                        >
                          {n.link_url}
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 md:flex-col md:items-end">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(n)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Sửa
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggle(n)}>
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {n.is_active ? "Tắt" : "Bật"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[#CC1C01] border-[#CC1C01]/40 hover:bg-[#CC1C01]/10"
                        onClick={() => handleDelete(n)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminNotifications;

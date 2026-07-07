import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlogPost, CATEGORY_LABELS } from "./blogTypes";
import { parseDateSafe } from "@/lib/safeDate";

interface Props {
  onCreate: () => void;
  onEdit: (id: string) => void;
}

const BlogList = ({ onCreate, onEdit }: Props) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts" as any)
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Không tải được danh sách bài viết");
    } else {
      setPosts((data ?? []) as unknown as BlogPost[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("blog_posts" as any).delete().eq("id", deleteId);
    if (error) {
      toast.error("Xoá thất bại: " + error.message);
    } else {
      toast.success("Đã xoá bài viết");
      setPosts((p) => p.filter((x) => x.id !== deleteId));
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bài viết Blog</h2>
          <p className="text-sm text-muted-foreground">
            Quản lý mẹo làm bài, cấu trúc đề thi, kinh nghiệm & thông báo.
          </p>
        </div>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Tạo bài viết
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải…</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-4">
              Chưa có bài viết nào. Hãy tạo bài đầu tiên!
            </p>
            <Button onClick={onCreate} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Tạo bài viết
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 font-medium">Danh mục</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Ngày đăng</th>
                  <th className="px-4 py-3 font-medium text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.map((p) => {
                  const d = parseDateSafe(p.published_at ?? p.updated_at);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground line-clamp-1">{p.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">/{p.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{CATEGORY_LABELS[p.category]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "published" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30 dark:text-emerald-400">
                            Đã đăng
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            Bản nháp
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.published_at && d
                          ? d.toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(p.id)}
                            className="gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(p.id)}
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Xoá
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bài viết?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Bài viết sẽ bị xoá vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BlogList;

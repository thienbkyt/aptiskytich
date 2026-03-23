import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Music, Image as ImageIcon, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BucketType = "audio" | "exam-images";

interface FileItem {
  name: string;
  bucket: BucketType;
  size: number;
  created_at: string;
  url: string;
}

const BUCKETS: { id: BucketType; label: string; icon: React.ReactNode; accept: string }[] = [
  { id: "audio", label: "Audio (Listening)", icon: <Music className="w-4 h-4" />, accept: "audio/*" },
  { id: "exam-images", label: "Hình ảnh (Exam)", icon: <ImageIcon className="w-4 h-4" />, accept: "image/*" },
];

const MediaLibrary = () => {
  const { toast } = useToast();
  const [activeBucket, setActiveBucket] = useState<BucketType>("audio");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFiles = async (bucket: BucketType) => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(bucket).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (!error && data) {
      const items: FileItem[] = data
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(f.name);
          return {
            name: f.name,
            bucket,
            size: f.metadata?.size || 0,
            created_at: f.created_at || "",
            url: urlData.publicUrl,
          };
        });
      setFiles(items);
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(activeBucket); }, [activeBucket]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles) return;
    setUploading(true);

    let successCount = 0;
    for (const file of Array.from(uploadFiles)) {
      const path = file.name.replace(/\s+/g, "_");
      const { error } = await supabase.storage.from(activeBucket).upload(path, file, { upsert: true });
      if (error) {
        toast({ title: `Lỗi upload ${file.name}`, description: error.message, variant: "destructive" });
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast({ title: `Đã upload ${successCount} file` });
      loadFiles(activeBucket);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.storage.from(deleteTarget.bucket).remove([deleteTarget.name]);
    if (error) {
      toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
    } else {
      setFiles((f) => f.filter((x) => x.name !== deleteTarget.name));
      toast({ title: `Đã xóa ${deleteTarget.name}` });
    }
    setDeleteTarget(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const currentBucket = BUCKETS.find((b) => b.id === activeBucket)!;

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-foreground">Media Library</h2>
      </div>

      {/* Bucket tabs */}
      <div className="flex gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBucket(b.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              b.id === activeBucket ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div className="flex gap-3">
        <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Đang upload..." : "Upload file"}
        </Button>
        <input ref={fileRef} type="file" accept={currentBucket.accept} multiple onChange={handleUpload} className="hidden" />
        <Badge variant="outline" className="self-center">{files.length} file</Badge>
      </div>

      {/* File list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Chưa có file nào</div>
      ) : (
        <div className="grid gap-2 max-h-80 overflow-y-auto">
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {activeBucket === "exam-images" ? (
                  <img src={f.url} alt={f.name} className="w-10 h-10 rounded object-cover border border-border" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <Music className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => setDeleteTarget(f)}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa file?</AlertDialogTitle>
            <AlertDialogDescription>Xóa "{deleteTarget?.name}" khỏi storage. Không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MediaLibrary;

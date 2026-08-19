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

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

const MediaLibrary = () => {
  const { toast } = useToast();
  const [activeBucket, setActiveBucket] = useState<BucketType>("audio");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [renamedFiles, setRenamedFiles] = useState<{ from: string; to: string }[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const loadTokenRef = useRef(0);

  const handleDeleteAll = async () => {
    if (files.length === 0) return;
    setDeletingAll(true);

    const groups = files.reduce<Record<string, string[]>>((acc, f) => {
      (acc[f.bucket] ||= []).push(f.name);
      return acc;
    }, {});

    const errors: string[] = [];
    let removed = 0;
    for (const [bucket, names] of Object.entries(groups)) {
      const { error } = await supabase.storage.from(bucket).remove(names);
      if (error) errors.push(`${bucket}: ${error.message}`);
      else removed += names.length;
    }

    if (errors.length) {
      toast({ title: "Lỗi xóa", description: errors.join("\n"), variant: "destructive" });
      loadFiles(activeBucket);
    } else {
      toast({ title: `Đã xóa ${removed} file` });
      setFiles([]);
    }
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  };

  const loadFiles = async (bucket: BucketType) => {
    const token = ++loadTokenRef.current;
    setLoading(true);
    const limit = 1000;
    let offset = 0;
    const all: FileItem[] = [];
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list("", {
        limit,
        offset,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (token !== loadTokenRef.current) return;
      if (error) break;
      if (!data || data.length === 0) break;
      const filtered = data.filter((f) => f.name !== ".emptyFolderPlaceholder");

      // Resolve signed URLs in batches for private buckets.
      const signedUrls = new Map<string, string>();
      if (bucket === "exam-images") {
        for (const batch of chunk(filtered.map((f) => f.name), 100)) {
          const { data: signed, error: signErr } = await supabase.storage
            .from(bucket)
            .createSignedUrls(batch, 3600);
          if (signErr) continue;
          for (const item of signed || []) {
            if (!item.error && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
          }
        }
      }

      const items = filtered.map((f) => {
        if (bucket === "exam-images") {
          return {
            name: f.name,
            bucket,
            size: f.metadata?.size || 0,
            created_at: f.created_at || "",
            url: signedUrls.get(f.name) || "",
          };
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(f.name);
        return {
          name: f.name,
          bucket,
          size: f.metadata?.size || 0,
          created_at: f.created_at || "",
          url: urlData.publicUrl,
        };
      });
      all.push(...items);
      if (data.length < limit) break;
      offset += data.length;
      if (token !== loadTokenRef.current) return;
    }
    if (token !== loadTokenRef.current) return;
    setFiles(all);
    setLoading(false);
  };

  useEffect(() => { loadFiles(activeBucket); }, [activeBucket]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles) return;
    const list = Array.from(uploadFiles);
    if (list.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });

    const failures: string[] = [];
    const renames: { from: string; to: string }[] = [];
    let successCount = 0;
    let cursor = 0;

    const isDuplicateError = (err: unknown) => {
      const anyErr = err as { statusCode?: string | number; message?: string } | null;
      const status = String(anyErr?.statusCode ?? "");
      const msg = (anyErr?.message ?? "").toLowerCase();
      return status === "409" || msg.includes("already exists") || msg.includes("duplicate");
    };

    const withSuffix = (name: string, n: number) => {
      const dot = name.lastIndexOf(".");
      if (dot <= 0) return `${name}_${n}`;
      return `${name.slice(0, dot)}_${n}${name.slice(dot)}`;
    };

    const worker = async () => {
      while (cursor < list.length) {
        const file = list[cursor++];
        const basePath = file.name.replace(/\s+/g, "_");
        let path = basePath;
        let lastError: unknown = null;
        let uploaded = false;

        for (let attempt = 1; attempt <= 5; attempt++) {
          const { error } = await supabase.storage
            .from(activeBucket)
            .upload(path, file, { upsert: false });
          if (!error) {
            uploaded = true;
            if (path !== basePath) renames.push({ from: basePath, to: path });
            break;
          }
          lastError = error;
          if (!isDuplicateError(error)) break;
          path = withSuffix(basePath, attempt + 1);
        }

        if (uploaded) successCount++;
        else failures.push(`${file.name}: ${(lastError as { message?: string } | null)?.message ?? "lỗi không rõ"}`);
        setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
    if (renames.length) setRenamedFiles(renames);


    if (successCount === list.length) {
      toast({ title: `Đã upload ${successCount} file` });
    } else if (successCount > 0) {
      toast({
        title: `Đã upload ${successCount}/${list.length} file`,
        description: `${failures.length} file lỗi`,
        variant: "destructive",
      });
    } else {
      toast({
        title: `Lỗi upload ${failures.length}/${list.length} file`,
        description: failures.slice(0, 3).join("\n") + (failures.length > 3 ? "..." : ""),
        variant: "destructive",
      });
    }
    loadFiles(activeBucket);
    setUploading(false);
    setUploadProgress({ done: 0, total: 0 });
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
          {uploading ? `Đang upload ${uploadProgress.done}/${uploadProgress.total}` : "Upload file"}
        </Button>

        <input ref={fileRef} type="file" accept={currentBucket.accept} multiple onChange={handleUpload} className="hidden" />
        <Badge variant="outline" className="self-center">{files.length} file</Badge>
        {files.length > 0 && (
          <Button
            variant="outline"
            className="gap-2 ml-auto text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={deletingAll}
          >
            {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Xóa toàn bộ
          </Button>
        )}
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

      <AlertDialog open={renamedFiles.length > 0} onOpenChange={(o) => !o && setRenamedFiles([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>File trùng tên đã được đổi tên</AlertDialogTitle>
            <AlertDialogDescription>
              File cũ trong bucket được giữ nguyên. Dùng tên mới dưới đây khi điền cột audio/ảnh lúc import đề.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {renamedFiles.map((r) => (
              <div key={r.to} className="flex items-center gap-2 rounded-md border border-border p-2">
                <div className="min-w-0 flex-1 text-xs">
                  <p className="text-muted-foreground truncate">{r.from}</p>
                  <p className="font-medium text-foreground truncate">→ {r.to}</p>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(r.to);
                    toast({ title: "Đã copy", description: r.to });
                  }}
                >
                  Copy
                </Button>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRenamedFiles([])}>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



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

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ {files.length} file?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ file trong {currentBucket.label} sẽ bị xóa vĩnh viễn khỏi storage. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">
              Xóa tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MediaLibrary;

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Result = { name: string; ok: boolean; error?: string };

const BulkCoverUpload = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setResults([]);
    const out: Result[] = [];
    for (const file of Array.from(files)) {
      const path = `covers/${file.name}`;
      const { error } = await supabase.storage
        .from("blog-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      out.push({ name: file.name, ok: !error, error: error?.message });
      setResults([...out]);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Images className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-foreground">Upload cover hàng loạt</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Chọn nhiều file ảnh, hệ thống sẽ upload tất cả vào <code className="text-xs bg-muted px-1 rounded">blog-images/covers/</code> và giữ nguyên tên file gốc.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Đang upload..." : "Chọn nhiều ảnh cover"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        {results.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {okCount} thành công · {failCount} lỗi / {results.length} file
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              {r.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className="font-mono text-xs truncate flex-1">covers/{r.name}</span>
              {r.ok ? (
                <span className="text-xs text-green-700 dark:text-green-400">OK</span>
              ) : (
                <span className="text-xs text-destructive truncate max-w-[40%]" title={r.error}>
                  {r.error || "Lỗi"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BulkCoverUpload;

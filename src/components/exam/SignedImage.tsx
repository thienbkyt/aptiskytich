import { useEffect, useRef, useState, useCallback, ImgHTMLAttributes } from "react";
import { RefreshCw, ImageOff } from "lucide-react";
import { resolveImageUrl, bustImageUrlCache } from "@/lib/imageUrl";

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
}

/**
 * <img> wrapper that resolves Supabase Storage paths to signed URLs,
 * retries on transient signing failures, and re-signs once on <img onError>
 * (covers signed-URL expiry during long sessions).
 * On permanent failure it shows a visible placeholder + "Thử lại" button
 * instead of an empty box.
 */
const SignedImage = ({ src, alt = "", onError, ...rest }: SignedImageProps) => {
  const [resolved, setResolved] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const retryRef = useRef(0);
  const isHttp = /^https?:\/\//.test(src);

  const load = useCallback(async (force = false) => {
    if (!src) {
      setStatus("error");
      return;
    }
    if (force) bustImageUrlCache(src);
    setStatus("loading");
    retryRef.current = 0;
    for (let i = 0; i < 4; i++) {
      try {
        const url = await resolveImageUrl(src);
        if (url) {
          setResolved(url);
          setStatus("ready");
          return;
        }
        if (isHttp) {
          setResolved(src);
          setStatus("ready");
          return;
        }
      } catch (e) {
        console.error("[SignedImage] resolveImageUrl threw for:", src, e);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setResolved("");
    setStatus("error");
  }, [src, isHttp]);

  useEffect(() => {
    let cancelled = false;
    setResolved("");
    setStatus("loading");
    retryRef.current = 0;
    if (!src) {
      setStatus("error");
      return;
    }
    (async () => {
      for (let i = 0; i < 4 && !cancelled; i++) {
        try {
          const url = await resolveImageUrl(src);
          if (cancelled) return;
          if (url) { setResolved(url); setStatus("ready"); return; }
          if (isHttp) { setResolved(src); setStatus("ready"); return; }
        } catch (e) {
          if (cancelled) return;
          console.error("[SignedImage] resolveImageUrl threw for:", src, e);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) setStatus("error");
    })();
    return () => { cancelled = true; };
  }, [src, isHttp]);

  const handleError = useCallback(async (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (retryRef.current < 2) {
      retryRef.current += 1;
      await load(true);
      return;
    }
    setResolved("");
    setStatus("error");
    onError?.(e);
  }, [load, onError]);

  if (status !== "ready" || !resolved) {
    const { className, ...others } = rest as any;
    return (
      <div
        {...others}
        className={`flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        {status === "loading" ? (
          <span className="text-xs">Đang tải ảnh...</span>
        ) : (
          <>
            <ImageOff className="w-5 h-5" />
            <span className="text-xs">Không tải được ảnh</span>
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex items-center gap-1 text-xs underline underline-offset-2 text-foreground hover:text-primary"
            >
              <RefreshCw className="w-3 h-3" /> Thử lại
            </button>
          </>
        )}
      </div>
    );
  }

  return <img src={resolved} alt={alt} onError={handleError} {...rest} />;
};

export default SignedImage;

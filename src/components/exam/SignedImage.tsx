import { useEffect, useRef, useState, useCallback, ImgHTMLAttributes } from "react";
import { resolveImageUrl, bustImageUrlCache } from "@/lib/imageUrl";

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
}

/**
 * <img> wrapper that resolves Supabase Storage paths to signed URLs,
 * falls back to the raw src if signing fails, and re-signs once on <img onError>
 * (covers signed-URL expiry during long sessions).
 */
const SignedImage = ({ src, alt = "", onError, ...rest }: SignedImageProps) => {
  const [resolved, setResolved] = useState<string>("");
  const retryRef = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!src) return;
    if (force) bustImageUrlCache(src);
    const url = await resolveImageUrl(src);
    setResolved(url || src);
  }, [src]);

  useEffect(() => {
    retryRef.current = 0;
    setResolved("");
    let cancelled = false;
    (async () => {
      const url = await resolveImageUrl(src);
      if (!cancelled) setResolved(url || src);
    })();
    return () => { cancelled = true; };
  }, [src]);

  const handleError = useCallback(async (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (retryRef.current < 2) {
      retryRef.current += 1;
      await load(true);
      return;
    }
    onError?.(e);
  }, [load, onError]);

  if (!resolved) {
    return <div {...(rest as any)} aria-label={alt} role="img" />;
  }

  return <img src={resolved} alt={alt} onError={handleError} {...rest} />;
};

export default SignedImage;

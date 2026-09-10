/** Extract a YouTube video id from common URL shapes. Returns null if not YouTube. */
export const getYouTubeId = (raw: string): string | null => {
  const url = (raw || "").trim();
  if (!/^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) return null;
  const m =
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{6,})/);
  return m ? m[1] : null;
};

/** Build the embed URL for a YouTube link; falls back to the raw url. */
export const getYouTubeEmbedUrl = (raw: string): string => {
  const id = getYouTubeId(raw);
  if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  const url = (raw || "").trim();
  return url.includes("?") ? `${url}&rel=0&modestbranding=1` : `${url}?rel=0&modestbranding=1`;
};

/** True when the text contains at least one YouTube link. */
export const hasYouTubeLink = (text?: string | null): boolean =>
  !!text && /(?:youtube\.com\/(?:watch\?|shorts\/|embed\/|live\/)|youtu\.be\/)/i.test(text);

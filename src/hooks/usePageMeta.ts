import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  /** Path-only, e.g. "/thi-thu". Will be prefixed with the production origin. */
  path?: string;
  ogImage?: string;
}

const SITE = "https://aptiskytich.vn";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Set per-route title / description / canonical / og:* tags.
 * On unmount, falls back to the static head from index.html (no restore).
 */
export function usePageMeta({ title, description, path, ogImage }: PageMeta) {
  useEffect(() => {
    const url = path ? `${SITE}${path}` : SITE;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertLink("canonical", url);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (ogImage) {
      upsertMeta("property", "og:image", ogImage);
      upsertMeta("name", "twitter:image", ogImage);
    }
  }, [title, description, path, ogImage]);
}

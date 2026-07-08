export type BlogCategory = "meo-lam-bai" | "cau-truc-de-thi" | "kinh-nghiem" | "thong-bao";
export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  category: BlogCategory;
  tags: string[];
  status: BlogStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<BlogCategory, string> = {
  "meo-lam-bai": "Mẹo làm bài",
  "cau-truc-de-thi": "Cấu trúc đề thi",
  "kinh-nghiem": "Kinh nghiệm học tập",
  "thong-bao": "Thông báo",
};

export const CATEGORY_OPTIONS: BlogCategory[] = [
  "meo-lam-bai",
  "cau-truc-de-thi",
  "kinh-nghiem",
];

export function slugifyVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

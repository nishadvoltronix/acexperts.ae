import type { MetadataRoute } from "next";
import { pages } from "@/lib/content";
import { site } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return pages
    .filter((p) => !p.robots.includes("noindex"))
    .map((page) => ({
      url: site.origin + page.route,
      ...(page.article?.modified
        ? { lastModified: page.article.modified }
        : {}),
    }));
}

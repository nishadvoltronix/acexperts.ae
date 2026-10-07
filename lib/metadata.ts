import type { Metadata } from "next";
import { getAsset } from "./content";
import { site } from "./site";
import type { PageData } from "./types";
export function pageMetadata(page: PageData): Metadata {
  const image = getAsset(page.heroImage);
  return {
    title: { absolute: page.title },
    description: page.description || undefined,
    alternates: { canonical: page.canonical || `${site.origin}${page.route}` },
    robots: {
      index: !page.robots.includes("noindex"),
      follow: !page.robots.includes("nofollow"),
      googleBot: {
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.canonical || page.route,
      siteName: site.name,
      locale: "en_US",
      type: page.type === "article" ? "article" : "website",
      images: image
        ? [
            {
              url: image.localPath,
              width: image.width,
              height: image.height,
              alt: image.alt || page.h1,
            },
          ]
        : undefined,
      ...(page.article
        ? {
            publishedTime: page.article.published || undefined,
            modifiedTime: page.article.modified || undefined,
            authors: [page.article.author],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: image ? [image.localPath] : undefined,
    },
  };
}

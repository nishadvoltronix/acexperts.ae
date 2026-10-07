import { QualityImage as Image } from "./QualityImage";
import Link from "next/link";
import type { ReactNode } from "react";
import { htmlToDOM, type Element, type DOMNode } from "html-react-parser";
import { getAsset } from "@/lib/content";
import type { PageData } from "@/lib/types";

const pageLabels: Record<string, string> = {
  about: "About AC Experts",
  service: "Our expertise",
  services: "Our services",
  projects: "Our work",
  project: "Project spotlight",
  products: "Cooling solutions",
  blog: "AC Experts journal",
  archive: "AC Experts journal",
  article: "Expert advice",
  faq: "Your questions, answered",
  contact: "Let's talk",
};

/** Listing thumbnails stay with their cards; detail imagery belongs in the hero. */
export function getPageHeroImage(page: PageData) {
  if (["blog", "archive", "projects"].includes(page.type)) return undefined;
  const source = page.type === "about"
    ? "https://acexperts.ae/wp-content/uploads/2023/02/ac-man.png"
    : page.heroImage;
  const asset = getAsset(source);
  if (!asset) return undefined;
  function findImage(nodes: DOMNode[]): Element | undefined {
    for (const node of nodes) {
      if (!("attribs" in node)) continue;
      if (node.name === "img" && node.attribs.src === source) return node;
      const match = findImage(node.children as DOMNode[]);
      if (match) return match;
    }
  }
  const originalImage = findImage(htmlToDOM(page.contentHtml));
  return {
    ...asset,
    alt: originalImage ? originalImage.attribs.alt || "" : asset.alt || page.h1,
  };
}

export function PageHero({
  page,
  description = page.description,
  children,
}: {
  page: PageData;
  description?: string;
  children?: ReactNode;
}) {
  const image = getPageHeroImage(page);
  const parent = page.type === "article" || page.type === "archive"
    ? { route: "/blog/", label: "Blog" }
    : page.type === "service"
      ? { route: "/services/", label: "Services" }
      : page.type === "project"
        ? { route: "/projects/", label: "Projects" }
        : undefined;

  return (
    <section className={`internal-hero${image ? " has-art" : " text-hero"}`}>
      <div className="container internal-hero-inner">
        <div className="internal-hero-copy">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            {parent && (
              <>
                <Link href={parent.route}>{parent.label}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span aria-current="page">{page.h1}</span>
          </nav>
          <p className="eyebrow">{pageLabels[page.type] || "AC Experts"}</p>
          <h1>{page.h1}</h1>
          {description && <p className="internal-hero-description">{description}</p>}
          {children}
        </div>
        {image && (
          <div className="internal-hero-art">
            <Image
              src={image.localPath}
              alt={image.alt}
              width={image.width || 1200}
              height={image.height || 800}
              preload
              sizes="(max-width: 767px) 100vw, (max-width: 1440px) 45vw, 620px"
            />
          </div>
        )}
      </div>
    </section>
  );
}

import { QualityImage as Image } from "./QualityImage";
import Link from "next/link";
import { createElement, type ReactNode } from "react";
import parse, {
  Element,
  attributesToProps,
  domToReact,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { getAsset, getPage, localLink } from "@/lib/content";
import { isAllowedContentTag, safeContentAttributes, safeContentUrl } from "@/lib/content-safety";
import { ProjectFilters } from "./ProjectFilters";

/** Migrated HTML still passes a strict tag, attribute and link allowlist at render time. */
export function RichContent({
  html,
  priority = false,
  prioritySrc,
  omitH1 = false,
  omitImageSrc,
  normalizeHeadings = false,
  headingOverrides,
  brandGrid,
}: {
  html: string;
  priority?: boolean;
  prioritySrc?: string;
  omitH1?: boolean;
  omitImageSrc?: string;
  normalizeHeadings?: boolean;
  headingOverrides?: Record<string, "h2" | "h3" | "h4">;
  brandGrid?: ReactNode;
}) {
  let imageIndex = 0;
  function keepsContent(node: DOMNode): boolean {
    if (node.type === "text") return Boolean(node.data.trim());
    if (!(node instanceof Element)) return false;
    if (!isAllowedContentTag(node.name)) return false;
    if (omitH1 && node.name === "h1") return false;
    if (node.name === "img") return node.attribs.src !== omitImageSrc;
    if (["div", "section", "p", "figure"].includes(node.name)) {
      if (node.attribs.class?.split(" ").includes("project-filters")) return true;
      return (node.children as DOMNode[]).some(keepsContent);
    }
    return true;
  }
  function includesH2(node: DOMNode): boolean {
    return node instanceof Element && (node.name === "h2" ||
      (node.children as DOMNode[]).some(includesH2));
  }
  function nodeText(node: DOMNode): string {
    if (node.type === "text") return node.data;
    return node instanceof Element ? (node.children as DOMNode[]).map(nodeText).join("") : "";
  }
  function containsImage(node: DOMNode, withDescription = false): boolean {
    if (!(node instanceof Element)) return false;
    if (node.name === "img") return !withDescription || Boolean(node.attribs.alt?.trim());
    return (node.children as DOMNode[]).some((child) => containsImage(child, withDescription));
  }
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!(node instanceof Element)) return;
      if (!isAllowedContentTag(node.name)) return <></>;
      if (brandGrid && node.attribs.class?.split(" ").includes("logo-grid"))
        return <>{brandGrid}</>;
      const attributes = safeContentAttributes(node.name, node.attribs);
      if (omitH1 && node.name === "h1") return <></>;
      if (headingOverrides && /^h[2-6]$/.test(node.name)) {
        const text = nodeText(node).replace(/\s+/g, " ").trim();
        const heading = Object.hasOwn(headingOverrides, text) ? headingOverrides[text] : undefined;
        if (heading) return createElement(heading, attributesToProps(attributes), domToReact(node.children as DOMNode[], options));
      }
      if (normalizeHeadings && /^h[3-6]$/.test(node.name)) {
        let section = node.parent;
        while (section instanceof Element && section.name !== "section") section = section.parent;
        const heading = /\bFAQs?\b/i.test(nodeText(node)) || !section || !includesH2(section as DOMNode)
          ? "h2" : "h3";
        return createElement(heading, attributesToProps(attributes), domToReact(node.children as DOMNode[], options));
      }
      if ((omitH1 || omitImageSrc) && ["div", "section", "p", "figure"].includes(node.name)) {
        if (!keepsContent(node)) return <></>;
        const classes = node.attribs.class?.split(" ") || [];
        if (node.name === "div" && classes.includes("content-grid") &&
          (node.children as DOMNode[]).filter(keepsContent).length === 1) {
          return (
            <div
              {...attributesToProps(attributes)}
              className={classes.filter((name) => !/^columns-\d+$/.test(name)).join(" ")}
            >
              {domToReact(node.children as DOMNode[], options)}
            </div>
          );
        }
      }
      if (node.attribs.class?.split(" ").includes("project-filters"))
        return <ProjectFilters />;
      if (node.name === "img") {
        if (node.attribs.src === omitImageSrc) return <></>;
        const asset = getAsset(node.attribs.src);
        if (!asset?.localPath.startsWith("/") || !safeContentUrl(asset.localPath)) return <></>;
        const highPriority = prioritySrc
          ? node.attribs.src === prioritySrc
          : priority && imageIndex++ === 0;
        return (
          <Image
            src={asset.localPath}
            alt={attributes.alt || ""}
            width={asset.width || Number(attributes.width) || 900}
            height={asset.height || Number(attributes.height) || 600}
            className={attributes.class || "content-image"}
            sizes={asset.localPath.includes('/logo/') ? '205px' : '(max-width: 767px) 100vw, 1310px'}
            unoptimized={node.attribs.class?.includes('section-background')}
            priority={highPriority}
          />
        );
      }
      if (node.name === "a") {
        const children = domToReact(node.children as DOMNode[], options);
        const safeHref = safeContentUrl(node.attribs.href || "#");
        if (!safeHref) return <span>{children}</span>;
        const href = localLink(safeHref);
        const hasAccessibleName = Boolean(
          node.attribs["aria-label"] || node.attribs["aria-labelledby"] ||
          nodeText(node).trim() || containsImage(node, true),
        );
        const imageLinkLabel = !hasAccessibleName && containsImage(node)
          ? getPage(href.split(/[?#]/)[0])?.h1
          : undefined;
        const props = {
          ...attributesToProps(attributes),
          "aria-label": node.attribs["aria-label"] || imageLinkLabel,
        };
        if (href.startsWith("/") && !/\.[a-z\d]+$/i.test(href))
          return (
            <Link href={href} {...props}>
              {children}
            </Link>
          );
        return (
          <a href={href} {...props}>
            {children}
          </a>
        );
      }
      const children = ["br", "hr", "col"].includes(node.name)
        ? undefined : domToReact(node.children as DOMNode[], options);
      return createElement(node.name, attributesToProps(attributes), children);
    },
  };
  return <>{parse(html, options)}</>;
}

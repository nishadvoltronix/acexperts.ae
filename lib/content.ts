import rawPages from "@/data/pages.json";
import rawAssets from "@/data/assets.json";
import urlMap from "@/docs/url-map.json";
import type { Asset, PageData } from "./types";
import { safeContentUrl } from "./content-safety";
export const pages = rawPages as unknown as PageData[];
export const assets = rawAssets as unknown as Asset[];
const pageMap = new Map(pages.map((page) => [page.route, page]));
const assetMap = new Map(assets.map((asset) => [asset.url, asset]));
const redirects = new Map(
  urlMap
    .filter((p) => p.action === "redirect")
    .map((p) => [new URL(p.originalUrl).pathname, p.destination]),
);
export function getPage(route: string) {
  return pageMap.get(route);
}
export function getAsset(url?: string) {
  if (!url) return undefined;
  return assetMap.get(url) || assets.find((asset) => asset.localPath === url);
}
export function localLink(href: string) {
  const safeHref = safeContentUrl(href);
  if (!safeHref) return "#";
  const asset = getAsset(safeHref);
  if (asset?.localPath) return safeContentUrl(asset.localPath) || "#";
  if (safeHref.startsWith("#")) return safeHref;
  try {
    const url = new URL(safeHref, "https://acexperts.ae");
    if (["acexperts.ae", "www.acexperts.ae"].includes(url.hostname)) {
      const path =
        url.pathname.endsWith("/") || /\.[a-z0-9]+$/i.test(url.pathname)
          ? url.pathname
          : `${url.pathname}/`;
      return safeContentUrl((redirects.get(path) || path) + url.search + url.hash) || "#";
    }
  } catch {
    return "#";
  }
  return safeHref;
}
export const articles = pages.filter((page) => page.type === "article");

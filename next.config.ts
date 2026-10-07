import type { NextConfig } from "next";
import urlMap from "./docs/url-map.json";
import assets from "./data/assets.json";
const nextConfig: NextConfig = {
  devIndicators: false,
  trailingSlash: true,
  poweredByHeader: false,
  images: { formats: ["image/webp"], qualities: [75, 90] },
  async redirects() {
    return [
      ...urlMap
        .filter((p) => p.action === "redirect")
        .map((p) => ({
          source: new URL(p.originalUrl).pathname,
          destination: p.destination!,
          permanent: true,
        })),
      ...assets
        .filter(
          (asset) =>
            asset.url.startsWith("https://acexperts.ae/") && asset.localPath,
        )
        .map((asset) => ({
          source: new URL(asset.url).pathname,
          destination: asset.localPath,
          permanent: true,
        })),
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/post-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/page-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/project-portfolio-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;

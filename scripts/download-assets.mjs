import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { load } from "cheerio";

// Read-only public media migration. Never downloads executable WordPress assets.
const crawl = JSON.parse(await readFile("data/crawl.json", "utf8"));
const origin = "https://acexperts.ae";
const directories = [
  "images/logo",
  "images/hero",
  "images/services",
  "images/projects",
  "images/gallery",
  "images/blog",
  "icons",
  "documents",
  "fonts",
];
await Promise.all(
  directories.map((dir) => mkdir(`public/${dir}`, { recursive: true })),
);
await mkdir("docs", { recursive: true });

const backgrounds = [
  ["2023/02/banneer01.jpg", "/", "hero"],
  ["2023/10/worker-acexperts.webp", "/", "hero"],
  ["2025/02/banner-side.webp", "/", "hero"],
  ["2023/02/ac-installation1.jpg", "/ac-installation-service/", "services"],
  ["2023/02/ac-cool.jpg", "/projects/", "projects"],
  [
    "2024/08/AC-Repair-Mechanic-1.jpg",
    "/project-portfolio/luxury-villa-ac-installation/",
    "gallery",
  ],
  [
    "2024/08/Professional-AC-Repair-1.webp",
    "/project-portfolio/luxury-villa-ac-installation/",
    "gallery",
  ],
  [
    "2024/08/Professional-AC-Repair-in-Dubai-1.webp",
    "/project-portfolio/luxury-villa-ac-installation/",
    "gallery",
  ],
  [
    "2024/08/AC-Maintenance-and-Repair-2.webp",
    "/project-portfolio/luxury-villa-ac-installation/",
    "gallery",
  ],
].map(([suffix, route, category]) => ({
  url: `${origin}/wp-content/uploads/${suffix}`,
  page: `${origin}${route}`,
  kind: "background",
  category,
  alt: "",
}));

const fonts = [
  [
    "https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3yUBA.woff2",
    "/fonts/roboto-latin.woff2",
    "Roboto Latin variable, weights 100–900",
  ],
  [
    "https://fonts.gstatic.com/s/zillaslab/v12/dFa6ZfeM_74wlPZtksIFajo6_Q.woff2",
    "/fonts/zilla-slab-latin-400.woff2",
    "Zilla Slab Latin 400",
  ],
  [
    "https://fonts.gstatic.com/s/zillaslab/v12/dFa5ZfeM_74wlPZtksIFYskZ6HOpWw.woff2",
    "/fonts/zilla-slab-latin-500.woff2",
    "Zilla Slab Latin 500",
  ],
  [
    "https://fonts.gstatic.com/s/zillaslab/v12/dFa5ZfeM_74wlPZtksIFYuUe6HOpWw.woff2",
    "/fonts/zilla-slab-latin-600.woff2",
    "Zilla Slab Latin 600",
  ],
  [
    "https://fonts.gstatic.com/s/zillaslab/v12/dFa5ZfeM_74wlPZtksIFYoEf6HOpWw.woff2",
    "/fonts/zilla-slab-latin-700.woff2",
    "Zilla Slab Latin 700",
  ],
].map(([url, localPath, alt]) => ({
  url,
  localPath,
  alt,
  page: "All pages",
  kind: "font",
}));
const licenses = [
  [
    "https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/OFL.txt",
    "/fonts/Roboto-OFL.txt",
  ],
  [
    "https://raw.githubusercontent.com/google/fonts/main/ofl/zillaslab/OFL.txt",
    "/fonts/Zilla-Slab-OFL.txt",
  ],
].map(([url, localPath]) => ({
  url,
  localPath,
  alt: "SIL Open Font License",
  page: "Font licensing",
  kind: "license",
}));

// Generated page-level CSS is inspected in memory only for media URLs. It is
// never retained, imported, or used as application styling/theme code.
let discoveredBackgrounds = [];
if (!process.argv.includes("--refresh-backgrounds")) {
  try {
    discoveredBackgrounds = JSON.parse(
      await readFile("data/background-assets.json", "utf8"),
    );
  } catch {
    /* initial discovery */
  }
}
if (
  discoveredBackgrounds.length === 0 ||
  process.argv.includes("--refresh-backgrounds")
) {
  const cssMedia = new Map();
  const backgroundMap = new Map();
  const pages = [
    ...new Set(
      crawl.pages
        .filter((page) => page.status === 200)
        .map((page) => page.finalUrl || page.url),
    ),
  ];
  async function inspectBackgrounds(page) {
    try {
      const { data } = await download(page);
      const $ = load(data.toString("utf8"));
      const cssUrls = $('link[rel="stylesheet"]')
        .map((_, element) => $(element).attr("href"))
        .get()
        .map((value) => new URL(value, page).href)
        .filter((url) =>
          /^https:\/\/acexperts\.ae\/wp-content\/uploads\/elementor\/css\/post-\d+\.css(?:\?|$)/i.test(
            url,
          ),
        );
      for (const url of cssUrls) {
        if (!cssMedia.has(url))
          cssMedia.set(
            url,
            download(url).then(({ data: css }) =>
              [
                ...css
                  .toString("utf8")
                  .matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g),
              ]
                .map((match) => match[1])
                .filter((value) =>
                  /\.(?:avif|webp|jpe?g|png|svg)(?:$|\?)/i.test(value),
                ),
            ),
          );
        for (const value of await cssMedia.get(url)) {
          const assetUrl = new URL(value, url).href;
          backgroundMap.set(`${page}|${assetUrl}`, {
            url: assetUrl,
            page,
            alt: "",
            kind: "background",
          });
        }
      }
    } catch (error) {
      console.log(`Background inspection skipped ${page}: ${error}`);
    }
  }
  for (let index = 0; index < pages.length; index += 4)
    await Promise.all(pages.slice(index, index + 4).map(inspectBackgrounds));
  discoveredBackgrounds = [...backgroundMap.values()];
  await writeFile(
    "data/background-assets.json",
    `${JSON.stringify(discoveredBackgrounds, null, 2)}\n`,
  );
  console.log(
    `Discovered ${discoveredBackgrounds.length} background references across ${pages.length} public pages.`,
  );
}

const pageTypes = new Map(
  crawl.pages.flatMap((page) => [
    [page.url, page.type],
    [page.finalUrl, page.type],
  ]),
);
const entries = new Map();
const excluded = [];
for (const item of [
  ...crawl.assets,
  ...backgrounds,
  ...discoveredBackgrounds,
  ...fonts,
  ...licenses,
]) {
  let url;
  try {
    url = new URL(item.url, origin);
  } catch {
    continue;
  }
  url.hash = "";
  const allowedExtension =
    /\.(?:avif|webp|png|jpe?g|gif|svg|ico|pdf|docx?|xlsx?|pptx?|woff2?|ttf|otf)$/i.test(
      url.pathname,
    );
  const isLicense =
    item.kind === "license" && url.hostname === "raw.githubusercontent.com";
  if (
    !["https:", "http:"].includes(url.protocol) ||
    /\/(?:wp-admin|wp-includes|plugins|themes|private)(?:\/|$)|\.php(?:$|\/)/i.test(
      url.pathname,
    ) ||
    (!allowedExtension && !isLicense)
  ) {
    excluded.push({
      url: url.href,
      reason: "Not an approved public media, font, or license resource",
    });
    continue;
  }
  if (
    ![
      "acexperts.ae",
      "www.acexperts.ae",
      "fonts.gstatic.com",
      "raw.githubusercontent.com",
    ].includes(url.hostname)
  ) {
    excluded.push({
      url: url.href,
      reason: "External asset host not part of approved source/font hosts",
    });
    continue;
  }
  if (["acexperts.ae", "www.acexperts.ae"].includes(url.hostname)) {
    url.protocol = "https:";
    url.hostname = "acexperts.ae";
    url.search = "";
  }
  const key = url.href;
  const entry = entries.get(key) || {
    url: key,
    pages: [],
    alt: "",
    kinds: [],
    category: "",
    localPath: item.localPath || "",
  };
  if (item.page && !entry.pages.includes(item.page))
    entry.pages.push(item.page);
  if (item.alt && !entry.alt) entry.alt = item.alt;
  if (item.kind && !entry.kinds.includes(item.kind))
    entry.kinds.push(item.kind);
  if (item.category) entry.category = item.category;
  entries.set(key, entry);
}

function categoryFor(item) {
  const filename = new URL(item.url).pathname.split("/").at(-1);
  if (item.category) return `images/${item.category}`;
  if (item.kinds.includes("license") || item.kinds.includes("font"))
    return "fonts";
  if (/\.(?:pdf|docx?|xlsx?|pptx?)$/i.test(filename)) return "documents";
  if (/favicon|fevicon|\.ico$|\.svg$/i.test(filename)) return "icons";
  if (
    /logo|voltronix-R|client-|\/2023\/(?:01|03)\/\d+\.png$/i.test(
      new URL(item.url).pathname,
    )
  )
    return "images/logo";
  if (/banner|banneer|worker-|slider/i.test(filename)) return "images/hero";
  const types = item.pages.map((page) => pageTypes.get(page));
  if (item.pages.some((page) => /\/project(?:s|-portfolio)?\//.test(page)))
    return "images/projects";
  if (
    types.some((type) => ["article", "blog", "archive"].includes(type)) ||
    item.pages.some((page) => page.endsWith("/post-sitemap.xml"))
  )
    return "images/blog";
  if (types.some((type) => ["service", "services", "products"].includes(type)))
    return "images/services";
  return "images/gallery";
}
function suggestedPath(item) {
  if (item.localPath) return item.localPath;
  const filename = decodeURIComponent(
    new URL(item.url).pathname.split("/").at(-1),
  );
  const extension = path.extname(filename).toLowerCase();
  const stem = filename
    .slice(0, -extension.length)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110)
    .toLowerCase();
  const id = createHash("sha256").update(item.url).digest("hex").slice(0, 8);
  return `/${categoryFor(item)}/${stem || "asset"}-${id}${extension}`;
}
async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: {
          "User-Agent":
            "ACExperts-Public-Migration/1.0 (read-only media archive)",
        },
      });
      if (response.status >= 500 && attempt < 2) continue;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0) throw new Error("Empty response");
      return {
        data,
        mime: response.headers.get("content-type")?.split(";")[0] || "",
      };
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

let previous = [];
try {
  const parsed = JSON.parse(await readFile("data/assets.json", "utf8"));
  previous = Array.isArray(parsed) ? parsed : parsed.assets || [];
} catch {
  /* first run */
}
const cache = new Map(
  previous
    .filter((item) => item.status === "downloaded")
    .map((item) => [item.url, item]),
);
const byHash = new Map();
const assets = [];
const pending = [...entries.values()].sort((a, b) =>
  a.url.localeCompare(b.url),
);
async function processItem(item) {
  try {
    let data;
    let mime = "";
    const cached = cache.get(item.url);
    if (cached) {
      try {
        data = await readFile(`public${cached.localPath}`);
        mime = cached.mime || "";
      } catch {
        /* re-download missing local files */
      }
    }
    if (!data) ({ data, mime } = await download(item.url));
    const hash = createHash("sha256").update(data).digest("hex");
    const duplicate = byHash.get(hash);
    const localPath = duplicate || cached?.localPath || suggestedPath(item);
    byHash.set(hash, localPath);
    let width = 0;
    let height = 0;
    let type = item.kinds.includes("license")
      ? "license"
      : /\.(?:woff2?|ttf|otf)$/i.test(localPath)
        ? "font"
        : /\.(?:pdf|docx?|xlsx?|pptx?)$/i.test(localPath)
          ? "document"
          : "image";
    if (type === "image") {
      if (/text\/html/i.test(mime)) throw new Error("Image URL returned HTML");
      const metadata = await sharp(data).metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
      if (localPath.startsWith("/icons/")) type = "icon";
    }
    if (
      type === "font" &&
      !["wOF2", "wOFF"].includes(data.subarray(0, 4).toString()) &&
      /\.woff2?$/i.test(localPath)
    )
      throw new Error("Invalid webfont signature");
    if (!duplicate) await writeFile(`public${localPath}`, data);
    const record = {
      url: item.url,
      localPath,
      width,
      height,
      type,
      pages: item.pages.sort(),
      alt: item.alt,
      status: "downloaded",
      bytes: data.length,
      sha256: hash,
      mime,
      ...(duplicate ? { deduplicated: true } : {}),
    };
    assets.push(record);
    console.log(
      `OK ${assets.length}/${pending.length} ${localPath}${duplicate ? " (shared bytes)" : ""}`,
    );
  } catch (error) {
    assets.push({
      url: item.url,
      localPath: null,
      width: 0,
      height: 0,
      type: "unknown",
      pages: item.pages,
      alt: item.alt,
      status: "unavailable",
      error: String(error),
    });
    console.log(`UNAVAILABLE ${item.url}: ${error}`);
  }
}
// Small batches are polite to the public source. Identical bytes share one file.
for (let index = 0; index < pending.length; index += 4) {
  await Promise.all(pending.slice(index, index + 4).map(processItem));
}
assets.sort((a, b) => a.url.localeCompare(b.url));
const downloaded = assets.filter((item) => item.status === "downloaded");
const unique = [
  ...new Map(downloaded.map((item) => [item.localPath, item])).values(),
];
const summary = {
  sourceReferences:
    crawl.assets.length +
    backgrounds.length +
    discoveredBackgrounds.length +
    fonts.length +
    licenses.length,
  uniqueUrls: assets.length,
  downloadedUrls: downloaded.length,
  uniqueFiles: unique.length,
  images: unique.filter((item) => ["image", "icon"].includes(item.type)).length,
  documents: unique.filter((item) => item.type === "document").length,
  fonts: unique.filter((item) => item.type === "font").length,
  licenses: unique.filter((item) => item.type === "license").length,
  unavailable: assets.filter((item) => item.status !== "downloaded").length,
  bytes: unique.reduce((sum, item) => sum + item.bytes, 0),
};
const manifest = {
  downloadedAt: new Date().toISOString(),
  origin,
  summary,
  assets,
  excluded,
};
await writeFile("data/assets.json", `${JSON.stringify(assets, null, 2)}\n`);
await writeFile(
  "data/assets-summary.json",
  `${JSON.stringify({ downloadedAt: manifest.downloadedAt, origin, summary, excluded }, null, 2)}\n`,
);
const escape = (value) =>
  String(value || "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const report = `# Public asset inventory\n\nSource: ${origin}/\n\nGenerated: ${manifest.downloadedAt}\n\n## Coverage\n\n- ${summary.sourceReferences} source references reduced to ${summary.uniqueUrls} unique resource URLs.\n- ${summary.downloadedUrls} URLs downloaded into ${summary.uniqueFiles} unique files (${(summary.bytes / 1024 / 1024).toFixed(2)} MiB).\n- ${summary.images} images/icons, ${summary.documents} documents, ${summary.fonts} fonts and ${summary.licenses} font licenses.\n- ${summary.unavailable} unavailable resources.\n- Exact byte duplicates share a local file; source resolution variants remain available for their original references.\n- Public HTML image, metadata, sitemap and discovered CSS background references are included. No WordPress PHP, scripts, stylesheets, plugin/theme code, credentials, private or administration resources are retained.\n- No functional public PDF/document download was discovered in the source crawl. The FAQ brochure control points to a fragment placeholder, so no document is fabricated.\n- Font files are public Google Fonts Latin subsets for the source families, served locally with next/font/local. Roboto is variable (100–900); Zilla Slab includes 400, 500, 600 and 700. Font source CSS was inspected only to identify files and is not copied into the application. SIL Open Font License copies are stored alongside fonts.\n- Page usage preserves discovered source URLs; sitemap-only references identify their discovery source.\n\n## Assets\n\n| Original URL | Local path | Type | Dimensions | Pages used on / discovered from | Source alt text | Status |\n| --- | --- | --- | --- | --- | --- | --- |\n${assets.map((item) => `| ${escape(item.url)} | ${escape(item.localPath || "—")} | ${item.type} | ${item.width && item.height ? `${item.width} × ${item.height}` : "—"} | ${item.pages.map(escape).join("<br>")} | ${escape(item.alt || "(absent)")} | ${item.status}${item.error ? `: ${escape(item.error)}` : ""}${item.deduplicated ? " (shared file)" : ""} |`).join("\n")}\n\n## Excluded resources\n\n${excluded.length ? excluded.map((item) => `- ${item.url}: ${item.reason}`).join("\n") : "No additional non-media resources were submitted to the downloader."}\n`;
await writeFile("docs/assets-inventory.md", report);
console.log(JSON.stringify(summary, null, 2));

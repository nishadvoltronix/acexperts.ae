import { load } from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const origin = "https://acexperts.ae";
const discovered = new Map();
const pages = [];
const resources = [];
const excluded = new Map();
const sitemapRecords = [];
const assetPattern =
  /\.(?:avif|webp|png|jpe?g|gif|svg|ico|pdf|docx?|xlsx?|pptx?|woff2?|ttf|otf)(?:$|\?)/i;
await mkdir("docs/source", { recursive: true });
await mkdir("data", { recursive: true });
const cleanText = (s) => s.replace(/\s+/g, " ").trim();
function normalize(value, base = origin) {
  try {
    const u = new URL(value, base);
    if (!["acexperts.ae", "www.acexperts.ae"].includes(u.hostname)) return null;
    u.protocol = "https:";
    u.hostname = "acexperts.ae";
    u.hash = "";
    if (
      /\/(?:wp-admin|wp-includes|wp-json|xmlrpc\.php|wp-login\.php)(?:\/|$)|\.php$/i.test(
        u.pathname,
      )
    ) {
      excluded.set(u.href, "Administrative/runtime endpoint: not fetched");
      return null;
    }
    if (/\/feed\/?$|\/comments\//i.test(u.pathname)) {
      excluded.set(
        u.href,
        "Syndication/comment endpoint; public content migrated from HTML",
      );
      return null;
    }
    if (u.search) {
      excluded.set(u.href, "Query variant; clean canonical route crawled");
      u.search = "";
    }
    return u.href;
  } catch {
    return null;
  }
}
function discover(value, from) {
  const url = normalize(value, from);
  if (!url) return;
  if (assetPattern.test(url)) {
    resources.push({ url, page: from, alt: "", kind: "linked" });
    return;
  }
  if (/\.(?:css|js|xml|txt|zip|mp4|webm)$/i.test(url)) return;
  if (!discovered.has(url))
    discovered.set(url, { url, from: new Set(), done: false });
  discovered.get(url).from.add(from);
}
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(35000),
        headers: {
          "User-Agent":
            "ACExperts-Public-Migration/1.0 (read-only website inventory)",
        },
      });
      if (r.status >= 500 && attempt < 2) continue;
      return r;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}
const robotsResponse = await get(`${origin}/robots.txt`);
const robots = await robotsResponse.text();
await writeFile("docs/source/robots.txt", robots);
const sitemapSeen = new Set();
async function sitemap(url) {
  if (sitemapSeen.has(url)) return;
  sitemapSeen.add(url);
  try {
    const r = await get(url);
    const xml = await r.text();
    const $ = load(xml, { xmlMode: true });
    sitemapRecords.push({
      url,
      status: r.status,
      finalUrl: r.url,
      entries: $("loc").length,
    });
    for (const el of $("sitemap > loc").toArray()) await sitemap($(el).text());
    $("url > loc").each((_, el) => discover($(el).text(), url));
    $("image\\:loc").each((_, el) =>
      resources.push({
        url: $(el).text(),
        page: url,
        alt: "",
        kind: "sitemap",
      }),
    );
  } catch (e) {
    sitemapRecords.push({ url, error: String(e) });
  }
}
await sitemap(`${origin}/sitemap.xml`);
for (const match of robots.matchAll(/^Sitemap:\s*(\S+)/gim))
  await sitemap(match[1]);
discover(`${origin}/`, "seed");
function type(route, $) {
  if (route === "/") return "home";
  if (
    route.startsWith("/project-portfolio/") &&
    route !== "/project-portfolio/"
  )
    return "project";
  if (route === "/project-portfolio/") return "projects";
  if ($("body").hasClass("single-post")) return "article";
  if (/^\/(category|author|tag)\/|^\/\d{4}\/|\/page\/\d+/.test(route))
    return "archive";
  if (/^\/(ac-installation|preventive-ac|ac-repair|emergency-ac)/.test(route))
    return "service";
  return (
    {
      "/about/": "about",
      "/services/": "services",
      "/projects/": "projects",
      "/products/": "products",
      "/blog/": "blog",
      "/contact-us/": "contact",
      "/faq/": "faq",
    }[route] || "page"
  );
}
async function crawl(item) {
  item.done = true;
  try {
    const r = await get(item.url);
    const html = await r.text();
    const $ = load(html);
    const route = new URL(r.url).pathname;
    const canonical = $('link[rel="canonical"]').attr("href") || "";
    const pageType = type(route, $);
    const links = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const url = normalize(href, r.url);
      if (url) {
        links.push({ url, text: cleanText($(el).text()) });
        discover(url, r.url);
      }
    });
    if (canonical) discover(canonical, r.url);
    const images = [];
    $("img").each((_, el) => {
      const e = $(el);
      const src = e.attr("data-src") || e.attr("src");
      if (!src || src.startsWith("data:")) return;
      const url = new URL(src, r.url).href;
      const record = {
        url,
        alt: e.attr("alt") || "",
        width: Number(e.attr("width")) || 0,
        height: Number(e.attr("height")) || 0,
        page: r.url,
        kind: "image",
      };
      images.push(record);
      resources.push(record);
    });
    for (const el of $("[style], [data-settings]").toArray()) {
      const txt =
        ($(el).attr("style") || "") + " " + ($(el).attr("data-settings") || "");
      for (const match of txt.matchAll(
        /(?:https?:)?\/?\/?[^\s"'<>]+\.(?:webp|png|jpe?g|svg|gif)/gi,
      )) {
        const value = match[0].replaceAll("\\/", "/");
        try {
          const url = new URL(value, r.url).href;
          if (assetPattern.test(url)) {
            resources.push({ url, page: r.url, alt: "", kind: "background" });
            images.push({ url, alt: "", kind: "background" });
          }
        } catch {}
      }
    }
    $('meta[property="og:image"], link[rel*="icon"]').each((_, el) => {
      const url = $(el).attr("content") || $(el).attr("href");
      if (url)
        resources.push({
          url: new URL(url, r.url).href,
          page: r.url,
          alt: "",
          kind: "metadata",
        });
    });
    const schemas = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        schemas.push(JSON.parse($(el).text()));
      } catch {}
    });
    const main = $("main").first().length
      ? $("main").first()
      : $(
            '[data-elementor-type="single-post"], [data-elementor-type="single"], [data-elementor-type="archive"]',
          ).first().length
        ? $(
            '[data-elementor-type="single-post"], [data-elementor-type="single"], [data-elementor-type="archive"]',
          ).first()
        : $("body");
    const title = $("title").text();
    const h1 = main
      .find("h1")
      .map((_, el) => cleanText($(el).text()))
      .get();
    const sections = main
      .find("h1,h2,h3,h4,h5,h6")
      .map((_, el) => ({ level: el.tagName, text: cleanText($(el).text()) }))
      .get();
    const id = createHash("sha256").update(item.url).digest("hex").slice(0, 12);
    // Public rendered markup only. Never retain theme CSS, JavaScript, forms, or runtime configuration.
    $(
      'script,style,noscript,link[rel="stylesheet"],input[type="hidden"]',
    ).remove();
    const snapshot = $.html();
    await writeFile(`docs/source/${id}.html`, snapshot);
    pages.push({
      url: item.url,
      finalUrl: r.url,
      route,
      status: r.status,
      type: pageType,
      title,
      h1,
      description: $('meta[name="description"]').attr("content") || "",
      canonical,
      robots: $('meta[name="robots"]').attr("content") || "",
      sections,
      images,
      internalLinks: [...new Map(links.map((l) => [l.url, l])).values()],
      schemas,
      sourceFile: `docs/source/${id}.html`,
      text: cleanText(main.text()),
      discoveredFrom: [...item.from],
    });
    console.log(`${r.status} ${pageType} ${item.url}`);
  } catch (e) {
    pages.push({
      url: item.url,
      status: 0,
      error: String(e),
      discoveredFrom: [...item.from],
    });
    console.log(`ERROR ${item.url}: ${e}`);
  }
}
while ([...discovered.values()].some((x) => !x.done)) {
  const batch = [...discovered.values()].filter((x) => !x.done).slice(0, 4);
  await Promise.all(batch.map(crawl));
  await writeFile(
    "data/crawl.json",
    JSON.stringify(
      {
        crawledAt: new Date().toISOString(),
        origin,
        sitemaps: sitemapRecords,
        pages,
        assets: resources,
        excluded: [...excluded].map(([url, reason]) => ({ url, reason })),
      },
      null,
      2,
    ),
  );
}
const escape = (s) =>
  String(s || "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
let report = `# Public website inventory\n\nSource: ${origin}/\n\nCrawled: ${new Date().toISOString()}\n\n${pages.length} discovered page URLs. Navigation, internal links, canonicals, robots and recursive XML sitemaps were traversed until no undiscovered clean HTML URLs remained. Only public GET requests were used. Query variants and runtime/admin/feed endpoints are excluded and recorded in data/crawl.json.\n\n## Sitemaps\n\n${sitemapRecords.map((s) => `- ${s.url}: ${s.status || s.error}; ${s.entries || 0} entries`).join("\n")}\n`;
for (const p of pages.sort((a, b) => a.url.localeCompare(b.url))) {
  report += `\n## ${p.route || p.url}\n\n- Original URL: ${p.url}\n- Next.js route: ${p.route || "Unavailable"}\n- HTTP status: ${p.status}\n- Page type: ${p.type || "unavailable"}\n- Title: ${p.title || ""}\n- H1: ${(p.h1 || []).join(" / ") || "(absent)"}\n- Meta description: ${p.description || "(absent)"}\n- Canonical: ${p.canonical || "(absent)"}\n- Robots: ${p.robots || "(absent)"}\n- SEO notes: ${p.status !== 200 ? "Source unavailable; do not invent content." : p.url !== p.finalUrl ? `Source redirects to ${p.finalUrl}; preserve permanent redirect.` : p.h1?.length !== 1 ? "Source has missing or multiple H1 headings; retain wording and normalize heading levels." : "Preserve route, content and metadata."}\n\n### Main sections\n\n${(p.sections || []).map((s) => `- ${s.level}: ${s.text}`).join("\n")}\n\n### Images\n\n${(p.images || []).map((i) => `- ${i.url} — ${i.alt || "(no source alt)"}`).join("\n")}\n\n### Internal links\n\n${(p.internalLinks || []).map((l) => `- ${l.url} — ${escape(l.text)}`).join("\n")}\n`;
}
await writeFile("docs/site-inventory.md", report);
await writeFile(
  "docs/url-map.json",
  JSON.stringify(
    pages.map((p) => ({
      originalUrl: p.url,
      route: p.route || new URL(p.url).pathname,
      type: p.type || "unavailable",
      sourceStatus: p.status,
      action:
        p.status !== 200
          ? "unavailable"
          : p.url !== p.finalUrl
            ? "redirect"
            : "migrate",
      destination: p.route || null,
    })),
    null,
    2,
  ),
);
console.log(
  `Inventory complete: ${pages.length} URLs, ${resources.length} asset references.`,
);

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";

const base = new URL(process.env.BASE_URL || "http://localhost:3001");
const normalize = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const baselinePath = "docs/redesign-baseline.json";
const protectedFiles = ["data/pages.json", "data/assets.json", "data/crawl.json", "data/source-layout.json", "data/background-assets.json", "data/assets-summary.json", "docs/url-map.json", "app/api/contact/route.ts", "app/robots.ts", "app/sitemap.ts", "lib/metadata.ts"];
const pages = await json("data/pages.json");
const mappings = await json("docs/url-map.json");
const assets = await json("data/assets.json");
const assetPaths = [...new Set(assets.map((asset) => asset.localPath).filter(Boolean))].sort();
async function filesSnapshot() {
  return Promise.all([...protectedFiles, ...assetPaths.map((path) => `public${path}`)].map(async (path) => ({ path, sha256: hash(await readFile(path)) })));
}
if (process.argv.includes("--capture")) {
  try {
    await readFile(baselinePath);
    throw new Error("A redesign baseline already exists; refusing to replace preservation evidence.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    description: "Before-redesign data, URL, metadata and migrated-asset preservation baseline. Captured from the completed migration before UI changes.",
    files: await filesSnapshot(),
    counts: { pages: pages.length, articles: pages.filter((page) => page.type === "article").length, faqs: pages.reduce((sum, page) => sum + page.faqs.length, 0), redirects: mappings.filter((item) => item.action === "redirect").length, migratedAssets: assetPaths.length },
    pages: pages.map((page) => ({ route: page.route, type: page.type, title: page.title, description: page.description, canonical: page.canonical, robots: page.robots, h1: page.h1, dataSha256: hash(JSON.stringify(page)), contentSha256: hash(page.contentHtml || ""), faqsSha256: hash(JSON.stringify(page.faqs)), sectionsSha256: hash(JSON.stringify(page.sections)) })),
  };
  await writeFile(baselinePath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(JSON.stringify(snapshot.counts, null, 2));
  process.exit(0);
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Redesign validation requires a loopback BASE_URL.");
const baseline = await json(baselinePath);
const result = { checkedAt: new Date().toISOString(), baseUrl: base.href, baselineCapturedAt: baseline.capturedAt, files: [], pages: [], contentRelocation: [], redirects: [], mediaRedirects: [], targets: [], fragments: [], seo: {}, failures: [] };
const fail = (kind, path, detail) => result.failures.push({ kind, path, detail });
async function pool(items, task, concurrency = 5) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) await task(items[index++]);
  }));
}
async function request(path) {
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error(`External request rejected: ${url}`);
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
}
for (const file of baseline.files) {
  const actual = hash(await readFile(file.path));
  const entry = { path: file.path, sha256: actual, unchanged: file.sha256 === actual };
  result.files.push(entry);
  if (!entry.unchanged) fail("preservation", file.path, "Protected migration data, SEO implementation, contact API or original asset changed.");
}
const oldRoutes = baseline.pages.map((page) => page.route).sort();
if (JSON.stringify(oldRoutes) !== JSON.stringify(pages.map((page) => page.route).sort())) fail("routes", "/", "Public route inventory differs from the baseline.");
const targets = new Map();
const rendered = new Map();
const fragments = [];
await pool(pages, async (page) => {
  try {
    const response = await request(page.route);
    const html = await response.text();
    rendered.set(page.route, html);
    const $ = load(html);
    const row = { route: page.route, type: page.type, status: response.status, title: $("head title").first().text(), description: $('meta[name="description"]').attr("content") || "", canonical: $('link[rel="canonical"]').attr("href") || "", robots: $('meta[name="robots"]').attr("content") || "", h1: $("h1").map((_, element) => $(element).text()).get(), paragraphs: 0, faqs: 0, structuredData: 0, failures: [] };
    const issue = (message) => { row.failures.push(message); fail("page", page.route, message); };
    if (response.status !== 200) issue(`Expected HTTP 200; received ${response.status}`);
    for (const key of ["title", "description", "canonical"]) if (normalize(row[key]) !== normalize(page[key])) issue(`${key} changed from migrated metadata.`);
    if (/noindex/i.test(row.robots) !== /noindex/i.test(page.robots)) issue("Robots indexability changed.");
    if (row.h1.length !== 1 || normalize(row.h1[0]) !== normalize(page.h1)) issue(`Expected one preserved H1 ${JSON.stringify(page.h1)}; received ${JSON.stringify(row.h1)}.`);
    if ($("main").length !== 1 || $("header.site-header").length !== 1 || $("footer.site-footer").length !== 1) issue("Shared header/footer or main landmark missing or duplicated.");
    const expected = load(page.contentHtml || "");
    const mainText = normalize($("main").text());
    if (page.type === "article") {
      const paragraphs = expected("p,li,td,th,h2,h3,h4").map((_, element) => normalize(expected(element).text())).get().filter((text) => text.length > 20);
      row.paragraphs = paragraphs.length;
      for (const paragraph of paragraphs) if (!mainText.includes(paragraph)) issue(`Article text missing: ${paragraph.slice(0, 150)}`);
    }
    // The approved reference homepage omits FAQs. Its eight original FAQs now
    // remain publicly rendered on /faq/, with matching FAQPage structured data.
    const faqs = page.type === "home" ? [] : [...page.faqs, ...(page.route === "/faq/" ? pages.find((entry) => entry.route === "/").faqs : [])];
    for (const faq of faqs) {
      row.faqs++;
      if (!mainText.includes(normalize(faq.question))) issue(`FAQ question missing: ${faq.question}`);
      const answer = normalize(load(faq.answerHtml).text());
      if (!mainText.includes(answer)) issue(`FAQ answer missing: ${faq.question}`);
    }
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const schema = JSON.parse($(element).text());
        row.structuredData++;
        for (const item of schema["@graph"] || [schema]) {
          if (item["@type"] !== "FAQPage") continue;
          const questions = item.mainEntity.map((question) => normalize(question.name));
          if (questions.length !== faqs.length || faqs.some((faq) => !questions.includes(normalize(faq.question)))) issue("FAQPage schema does not match the questions rendered on this route.");
          for (const question of item.mainEntity) if (!mainText.includes(normalize(load(question.acceptedAnswer.text).text()))) issue(`FAQPage schema answer is not rendered: ${question.name}`);
        }
      } catch { issue("Invalid structured-data JSON."); }
    });
    $('a[href],img[src],img[srcset],source[srcset],link[rel="stylesheet"][href],script[src]').each((_, element) => {
      const values = [$(element).attr("href"), $(element).attr("src"), ...($(element).attr("srcset") || "").split(",").map((value) => value.trim().split(/\s+/)[0])].filter(Boolean);
      for (const raw of values) {
        if (/^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) continue;
        const url = new URL(raw, new URL(page.route, base));
        if (["acexperts.ae", "www.acexperts.ae"].includes(url.hostname)) issue(`Remote original-site dependency: ${raw}`);
        if (url.origin !== base.origin) continue;
        if (element.name === "a" && url.hash) fragments.push({ from: page.route, path: url.pathname, id: decodeURIComponent(url.hash.slice(1)) });
        const key = url.pathname + url.search;
        if (!targets.has(key)) targets.set(key, { path: key, kind: element.name, from: page.route });
      }
    });
    row.ok = row.failures.length === 0;
    result.pages.push(row);
  } catch (error) { fail("request", page.route, String(error)); }
});
console.log(`Checked ${result.pages.length} rendered pages against migrated metadata, article and FAQ content.`);
// The supplied homepage is locked. Its previous copy, images, and links remain
// in the public About-page disclosure and FAQ page, rather than being deleted.
function preservedLink(raw) {
  const asset = assets.find((entry) => entry.url === raw || entry.localPath === raw);
  if (asset) return asset.localPath;
  const url = new URL(raw, "https://acexperts.ae");
  if (!["acexperts.ae", "www.acexperts.ae"].includes(url.hostname)) return raw;
  const path = url.pathname.endsWith("/") || /\.[a-z0-9]+$/i.test(url.pathname) ? url.pathname : `${url.pathname}/`;
  const redirect = mappings.find((entry) => entry.action === "redirect" && new URL(entry.originalUrl).pathname === path);
  return (redirect?.destination || path) + url.hash;
}
for (const section of pages.find((page) => page.route === "/").sections || []) {
  const path = section.kind === "faq" ? "/faq/" : "/about/";
  const source = load(section.html);
  const target = load(rendered.get(path) || "");
  const targetText = normalize(target("main").text());
  const text = [...new Set(source("p,li,summary,h1,h2,h3,h4,dt,dd,th,td").map((_, element) => normalize(source(element).text())).get().filter((value) => value.length > 12))];
  const missingText = text.filter((value) => !targetText.includes(value));
  const expectedLinks = [...new Set(source("a[href]").map((_, element) => preservedLink(source(element).attr("href"))).get())];
  const actualLinks = target("main a[href]").map((_, element) => target(element).attr("href")).get();
  const missingLinks = expectedLinks.filter((value) => !actualLinks.includes(value));
  const expectedImages = source("img[src]").map((_, element) => ({ src: preservedLink(source(element).attr("src")), alt: source(element).attr("alt") || "" })).get();
  const actualImages = target("main img[src]").map((_, element) => {
    const src = new URL(target(element).attr("src"), base);
    return { src: /^\/_next\/image\/?$/.test(src.pathname) ? src.searchParams.get("url") : src.pathname, alt: target(element).attr("alt") || "" };
  }).get();
  const missingImages = expectedImages.filter((expected) => !actualImages.some((actual) => actual.src === expected.src && actual.alt === expected.alt));
  const row = { section: section.id, kind: section.kind, destination: path, textChecks: text.length, linkChecks: expectedLinks.length, imageChecks: expectedImages.length, missingText, missingLinks, missingImages, ok: !missingText.length && !missingLinks.length && !missingImages.length };
  result.contentRelocation.push(row);
  if (!row.ok) fail("homepage-content-relocation", path, row);
}
for (const fragment of fragments) {
  const html = rendered.get(fragment.path);
  if (!html || !fragment.id) continue;
  const $ = load(html);
  const exists = $("[id],a[name]").toArray().some((element) => $(element).attr("id") === fragment.id || $(element).attr("name") === fragment.id);
  result.fragments.push({ ...fragment, ok: exists });
  if (!exists) fail("fragment", fragment.from, `Missing ${fragment.path}#${fragment.id}`);
}
await pool(mappings.filter((item) => item.action === "redirect"), async (mapping) => {
  const path = new URL(mapping.originalUrl).pathname;
  try {
    const response = await request(path);
    const location = response.headers.get("location");
    const row = { path, status: response.status, location, expected: mapping.destination, ok: response.status === 308 && new URL(location, base).pathname === mapping.destination };
    result.redirects.push(row);
    await response.body?.cancel();
    if (!row.ok) fail("redirect", path, row);
  } catch (error) { fail("redirect", path, String(error)); }
});
await pool(assets.filter((asset) => asset.url.startsWith("https://acexperts.ae/") && asset.localPath), async (asset) => {
  const path = new URL(asset.url).pathname;
  try {
    const response = await request(path);
    const location = response.headers.get("location");
    const row = { path, status: response.status, location, ok: response.status === 308 && new URL(location, base).pathname === asset.localPath };
    result.mediaRedirects.push(row);
    await response.body?.cancel();
    if (!row.ok) fail("media-redirect", path, row);
  } catch (error) { fail("media-redirect", path, String(error)); }
});
await pool([...targets.values()], async (target) => {
  try {
    let response = await request(target.path);
    if ([301, 302, 307, 308].includes(response.status) && response.headers.get("location")) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      response = await request(location);
    }
    const row = { ...target, status: response.status, contentType: response.headers.get("content-type"), ok: response.status === 200 };
    if (["img", "source"].includes(target.kind) && !row.contentType?.startsWith("image/")) row.ok = false;
    await response.body?.cancel();
    result.targets.push(row);
    if (!row.ok) fail("target", target.path, row);
  } catch (error) { fail("target", target.path, String(error)); }
});
for (const path of ["/sitemap.xml", "/robots.txt"]) {
  const response = await request(path);
  const body = await response.text();
  const row = { status: response.status, ok: response.status === 200 };
  if (path === "/sitemap.xml") {
    const $ = load(body, { xmlMode: true });
    const urls = $("url > loc").map((_, element) => $(element).text()).get();
    row.urls = urls.length;
    row.missing = pages.filter((page) => !/noindex/i.test(page.robots)).map((page) => page.canonical).filter((url) => !urls.includes(url));
    row.unexpected = urls.filter((url) => !pages.some((page) => page.canonical === url && !/noindex/i.test(page.robots)));
    row.ok &&= !row.missing.length && !row.unexpected.length && new Set(urls).size === urls.length;
  } else row.ok &&= body.includes("https://acexperts.ae/sitemap.xml");
  result.seo[path] = row;
  if (!row.ok) fail("seo", path, row);
}
const missingResponse = await request("/__redesign-missing-page/");
result.seo.notFound = { status: missingResponse.status, ok: missingResponse.status === 404 };
await missingResponse.body?.cancel();
if (!result.seo.notFound.ok) fail("404", "/__redesign-missing-page/", result.seo.notFound);
result.pages.sort((a, b) => a.route.localeCompare(b.route));
result.summary = { pages: result.pages.length, expectedPages: baseline.pages.length, protectedFiles: result.files.length, articleChecks: result.pages.filter((page) => page.type === "article").length, faqChecks: result.pages.reduce((sum, page) => sum + page.faqs, 0), redirects: result.redirects.length, mediaRedirects: result.mediaRedirects.length, linkedTargets: result.targets.length, failures: result.failures.length, passed: !result.failures.length && result.pages.length === baseline.pages.length };
await writeFile("docs/redesign-validation.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary, null, 2));
if (!result.summary.passed) { console.error(JSON.stringify(result.failures.slice(0, 20), null, 2)); process.exitCode = 1; }

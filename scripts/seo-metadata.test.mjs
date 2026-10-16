import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire, registerHooks } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { load } from "cheerio";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
// Exercise the actual metadata function rather than duplicating its implementation.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const local = specifier.startsWith("@/")
      ? resolve(root, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? resolve(dirname(fileURLToPath(context.parentURL)), specifier) : null;
    if (local && !extname(local)) {
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(local + extension)) {
          return { url: pathToFileURL(local + extension).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier.startsWith("@/") ? local : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url) && !url.includes("/node_modules/")) {
      return {
        format: "commonjs",
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
        }).outputText,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const fixture = require("../data/seo-requirements.json");
const pages = require("../data/pages.json");
const serviceContent = require("../data/service-content.json");
const { pageMetadata } = require("../lib/metadata.ts");
const { withServiceContent } = require("../lib/service-content.ts");
const { services } = require("../lib/site.ts");
const { projectMatchesCategory } = require("../lib/project-categories.ts");
const indexablePages = pages.filter((page) => !/\bnoindex\b/i.test(page.robots));

test("SEO expectations preserve the independent original Word document table", () => {
  assert.equal(fixture.pages.length, 11);
  assert.equal(new Set(fixture.pages.map((page) => page.route)).size, 11);
  assert.match(fixture.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(fixture.source.document, "web modification- acexperts.docx");
  assert.deepEqual(fixture.pages.map((page) => page.sourceTableRow), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("every indexable page has a nonempty unique title and description", () => {
  assert.equal(indexablePages.length, 41, "all current indexable routes remain covered");
  for (const field of ["title", "description"]) {
    const seen = new Map();
    for (const page of indexablePages) {
      assert.equal(typeof page[field], "string", `${page.route} ${field}`);
      const normalized = page[field].trim().replace(/\s+/g, " ").toLowerCase();
      assert.ok(normalized, `${page.route} is indexable but has no ${field}`);
      assert.equal(seen.has(normalized), false,
        `${page.route} duplicates ${field} from ${seen.get(normalized)}`);
      seen.set(normalized, page.route);
    }
  }
});

for (const expected of fixture.pages) {
  test(`Word document metadata: ${expected.route}`, () => {
    const page = pages.find((entry) => entry.route === expected.route);
    assert.ok(page, "required page exists");
    const metadata = pageMetadata(page);
    assert.equal(page.title, expected.title);
    assert.equal(page.description, expected.description);
    assert.equal(page.canonical, expected.canonical);
    assert.deepEqual(metadata.title, { absolute: expected.title });
    assert.equal(metadata.description, expected.description);
    assert.equal(metadata.alternates.canonical, expected.canonical);
    assert.equal(metadata.openGraph.title, expected.title);
    assert.equal(metadata.openGraph.description, expected.description);
    assert.equal(metadata.openGraph.url, expected.canonical);
    assert.equal(metadata.twitter.title, expected.title);
    assert.equal(metadata.twitter.description, expected.description);
    assert.equal(metadata.robots.index, true);
    assert.equal(metadata.robots.follow, true);
    if (fixture.requiredHeadings[expected.route]) {
      assert.equal(page.h1, fixture.requiredHeadings[expected.route]);
    }
  });
}

test("new service pages are indexable and linked from service navigation and content", () => {
  const serviceList = pages.find((page) => page.route === "/services/");
  const listing = load(serviceList.contentHtml);
  for (const route of ["/ac-duct-cleaning-services-in-dubai/", "/hvac-services/"]) {
    const page = pages.find((entry) => entry.route === route);
    assert.equal(page?.type, "service");
    assert.equal(page.canonical, `https://acexperts.ae${route}`);
    assert.equal(pageMetadata(page).robots.index, true);
    assert.ok(services.some((entry) => entry.route === route));
    assert.ok(listing(`a[href="${route}"]`).length, "listing links to new service");
    assert.ok(load(page.contentHtml)('a[href="/contact-us/"]').length, "service has enquiry CTA");
  }
});

test("service content preserves every established FAQ question", () => {
  const baselines = {
    "/ac-installation-service/": [8, "9d902d3f4954b53368f153ee530490722b54cde1b3c6ed6d343de0655a14bff3"],
    "/preventive-ac-maintenance-service/": [7, "20d1c0becb5a44cbdcb37146e6b59f07ad4f6fe229ea8c27f6ad482960dd807d"],
    "/ac-repair-services/": [9, "cbe45c68ecb9111ce49fad6750223d23ee385bb5b9ade0acdd76c67ea72da8b1"],
    "/emergency-ac-maintenance-service/": [10, "5aff8c9dba017e60f7b53e81d37fc77e8b584f0bbc3a8dfa7e181471814d3fae"],
  };
  for (const [route, [count, expectedHash]] of Object.entries(baselines)) {
    const original = pages.find((page) => page.route === route);
    const composed = withServiceContent(original);
    const questions = composed.faqs.map((faq) => faq.question);
    assert.equal(questions.length, count, route);
    assert.equal(createHash("sha256").update(JSON.stringify(questions)).digest("hex"), expectedHash, route);
    assert.deepEqual(questions, original.faqs.map((faq) => faq.question), route);
  }
});

test("every document-driven service page has exactly five local photographs", () => {
  const serviceRoutes = [
    "/hvac-services/",
    "/ac-duct-cleaning-services-in-dubai/",
    "/ac-installation-service/",
    "/preventive-ac-maintenance-service/",
    "/ac-repair-services/",
    "/emergency-ac-maintenance-service/",
  ];
  for (const route of serviceRoutes) {
    const photos = serviceContent[route]?.photos;
    assert.equal(photos?.length, 5, route);
    assert.equal(new Set(photos.map((photo) => photo.src)).size, 5, `${route} uses five distinct photos`);
    for (const photo of photos) {
      assert.match(photo.src, /^\/images\/(services|gallery|projects|hero)\//, `${route} photo path`);
      assert.ok(photo.alt.trim(), `${route} photo has alt text`);
      assert.ok(photo.width > 0 && photo.height > 0, `${route} photo dimensions`);
      assert.ok(existsSync(resolve(root, "public", photo.src.slice(1))), `${route} missing ${photo.src}`);
    }
  }
});

test("project filters classify only the published residential installation", () => {
  const route = "/project-portfolio/luxury-villa-ac-installation/";
  assert.equal(projectMatchesCategory(route, "all"), true);
  assert.equal(projectMatchesCategory(route, "installation"), true);
  for (const category of ["repair", "maintenance", "commercial"]) {
    assert.equal(projectMatchesCategory(route, category), false);
  }
  assert.equal(projectMatchesCategory("/unknown-project/", "installation"), false);
  for (const listingRoute of ["/projects/", "/project-portfolio/"]) {
    assert.deepEqual(pages.find((page) => page.route === listingRoute).cards.map((card) => card.route), [route]);
  }
});

const baseUrl = process.env.BASE_URL;
test("all indexable routes render their complete title, description and canonical metadata", { skip: !baseUrl }, async () => {
  for (const page of indexablePages) {
    const response = await fetch(new URL(page.route, baseUrl), {
      headers: { "User-Agent": "Twitterbot/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, page.route);
    const $ = load(await response.text());
    assert.equal($("title").length, 1, page.route);
    assert.equal($("title").text(), page.title, page.route);
    assert.equal($('meta[name="description"]').length, 1, page.route);
    assert.equal($('meta[name="description"]').attr("content"), page.description, page.route);
    assert.equal($('link[rel="canonical"]').length, 1, page.route);
    assert.equal($('link[rel="canonical"]').attr("href"), page.canonical, page.route);
    const robots = $('meta[name="robots"]').attr("content") || "";
    assert.match(robots, /\bindex\b/, page.route);
    assert.match(robots, /\bfollow\b/, page.route);
    assert.doesNotMatch(robots, /noindex|nofollow/, page.route);
  }
});
for (const expected of fixture.pages) {
  test(`rendered metadata, canonical, H1 and robots: ${expected.route}`, { skip: !baseUrl }, async () => {
    const response = await fetch(new URL(expected.route, baseUrl), {
      headers: { "User-Agent": "Twitterbot/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200);
    const $ = load(await response.text());
    assert.equal($("title").length, 1);
    assert.equal($("title").text(), expected.title);
    assert.equal($('meta[name="description"]').attr("content"), expected.description);
    assert.equal($('link[rel="canonical"]').attr("href"), expected.canonical);
    assert.equal($("h1").length, 1);
    assert.equal($("h1").text().replace(/\s+/g, " ").trim(),
      fixture.requiredHeadings[expected.route] || serviceContent[expected.route]?.h1 || pages.find((page) => page.route === expected.route).h1);
    const robots = $('meta[name="robots"]').attr("content") || "";
    assert.match(robots, /\bindex\b/);
    assert.match(robots, /\bfollow\b/);
    assert.doesNotMatch(robots, /noindex|nofollow/);
    let previous = 0;
    $("main h1, main h2, main h3, main h4, main h5, main h6").each((_, heading) => {
      const level = Number(heading.tagName.slice(1));
      assert.ok(level <= previous + 1, `heading level skips from h${previous} to h${level}: ${$(heading).text()}`);
      previous = level;
    });
  });
}

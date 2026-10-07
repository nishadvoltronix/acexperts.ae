import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const base = new URL(process.env.BASE_URL || "http://localhost:3001");
const sourceOrigin = "https://acexperts.ae";
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
async function optionalJson(path) {
  try {
    return await json(path);
  } catch {
    return null;
  }
}
async function pool(items, task, concurrency = 6) {
  let position = 0;
  return Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (position < items.length) {
        const item = items[position++];
        await task(item);
      }
    }),
  );
}
function localUrl(path) {
  const url = new URL(path, base);
  if (url.origin !== base.origin)
    throw new Error(`Refusing nonlocal validation URL: ${url.href}`);
  return url;
}
async function request(path, options = {}) {
  const url = localUrl(path);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    ...options,
  });
  return response;
}
function summaryTable(counts) {
  return Object.entries(counts)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");
}

export async function writeMigrationReport() {
  const buildVerification = await optionalJson("docs/build-verification.json");
  const mediaValidation = await optionalJson("docs/media-redirect-validation.json");
  const [validation, browser, crawl, map, assets, assetSummary, pagesInput] =
    await Promise.all([
      optionalJson("docs/validation-results.json"),
      optionalJson("docs/browser-validation-results.json"),
      optionalJson("data/crawl.json"),
      optionalJson("docs/url-map.json"),
      optionalJson("data/assets.json"),
      optionalJson("data/assets-summary.json"),
      optionalJson("data/pages.json"),
    ]);
  const pages = Array.isArray(pagesInput)
    ? pagesInput
    : pagesInput?.pages || [];
  const mappings = Array.isArray(map) ? map : [];
  const unavailable = mappings.filter(
    (item) => !["migrate", "redirect"].includes(item.action),
  );
  const uniqueRoutes = new Set(
    mappings
      .filter((item) => item.action === "migrate")
      .map((item) => item.route),
  );
  const files = assets || [];
  const missingAssets = files.filter(
    (item) =>
      !["downloaded", "duplicate"].includes(item.status) &&
      !(typeof item.status === "number" && item.status < 400),
  );
  const failures = validation?.failures || [];
  const browserFailures = browser?.failures || [];
  const counts = {
    "Original public URLs discovered": mappings.length,
    "Canonical content pages in data": pages.length,
    "Unique migrated routes in URL map": uniqueRoutes.size,
    "Source URLs mapped to permanent redirects": mappings.filter(
      (item) => item.action === "redirect",
    ).length,
    "Source URLs without migration or redirect": unavailable.length,
    "Local URLs verified": validation?.routes?.length ?? "Not run",
    "Downloaded image files":
      assetSummary?.summary?.images ??
      files.filter((item) => item.type === "image").length,
    "Downloaded documents":
      assetSummary?.summary?.documents ??
      files.filter((item) => item.type === "document").length,
    "Unique downloaded asset files":
      assetSummary?.summary?.uniqueFiles ??
      new Set(files.map((item) => item.localPath).filter(Boolean)).size,
    "Asset download failures":
      assetSummary?.summary?.unavailable ?? missingAssets.length,
    "Rendered internal link/asset targets tested":
      validation?.targets?.length ?? "Not run",
    "Broken local targets":
      validation?.targets?.filter((item) => !item.ok).length ?? "Not run",
    "Metadata/content/route validation failures": failures.length,
    "Browser viewport cases": browser?.cases?.length ?? "Not run",
    "Browser/interaction/accessibility failures": browserFailures.length,
    "Original media URL redirects verified": mediaValidation?.total ?? "Not run",
    "Original media redirect failures": mediaValidation?.failures?.length ?? "Not run",
  };
  const validationState = !validation
    ? "Local HTTP validation has not run."
    : failures.length
      ? `Local HTTP validation found ${failures.length} issue(s).`
      : "Every recorded local HTTP, redirect, metadata, content, and asset check passed.";
  const browserState = !browser
    ? "Browser validation has not run."
    : browserFailures.length
      ? `Browser validation found ${browserFailures.length} issue(s).`
      : "Recorded browser, responsive, interaction, and automated accessibility checks passed.";
  const migrationNotes = [
    ...new Set(pages.flatMap((item) => item.migrationNotes || []).map((note) => {
      if (typeof note === "string") return note;
      if (!note || typeof note !== "object") return "";
      const details = [note.label, note.value].filter(Boolean).map(String);
      const reason = note.reason || "Source cleanup";
      return details.length ? `${reason.replace(/[.:;]\s*$/, "")}: ${details.join(" — ")}` : reason;
    }).filter(Boolean)),
  ];
  const body = `# AC Experts migration report\n\nGenerated: ${new Date().toISOString()}\n\n${validationState} ${browserState}\n\n## Coverage\n\n| Item | Count |\n| --- | ---: |\n${summaryTable(counts)}\n\nThe inventory is based on public navigation, internal links, canonical URLs, robots, and sitemaps. Source crawl time: ${crawl?.crawledAt || "Unavailable"}. Canonical content pages and redirect aliases are counted separately. See [site inventory](site-inventory.md), [URL map](url-map.json), [asset inventory](assets-inventory.md), and [source audit](source-audit.md).\n\n## Verification evidence\n\n- [HTTP validation results](validation-results.json): exact URL responses, permanent redirects, titles, descriptions, canonicals, H1s, article paragraph checks, actual rendered links and image targets, sitemap, and robots.\n- [Browser validation results](browser-validation-results.json): viewport cases, overflow, image decoding, JavaScript errors, keyboard/mobile navigation, FAQ interaction, local contact form behavior, and axe checks.\n- [Local screenshots](screenshots/local/).\n- Build and lint results must be confirmed separately from these scripts; this report does not infer their success.\n\n## Current failures\n\n${[...failures, ...browserFailures].length ? [...failures, ...browserFailures].map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n") : "- No failures in the checks that have run."}\n\n## Source URLs not migrated\n\n${unavailable.length ? unavailable.map((item) => `- ${item.originalUrl}: ${item.action || "unavailable"}`).join("\n") : "- No URL-map entries are left without a page or permanent redirect."}\n\n## Source quirks and migration decisions\n\n- The original public contact form is embedded through Zoho Forms. The new frontend is local; sending remains intentionally disabled until a backend is configured. Valid local submissions return HTTP 503 with an explicit unsent-message notice. No test submitted the live form.\n- The FAQ brochure Download points to a placeholder, so it is not a downloadable public PDF. No document is fabricated.\n- The source FAQ sidebar contains template contact details for a different country and example email. Those are recorded in the source audit and not treated as verified business details.\n- The contact page's public map names Nathan Star Technical Services LLC; its identity is a source discrepancy.\n- Source article author display and biography spellings differ (Maries/Maris). Source text is preserved.\n- The original installation sidebar email differs from the site-wide contact email; see the source audit.\n- Source date/archive aliases that resolve to other canonical pages are represented by explicit permanent redirects; they are not duplicate indexed content pages.\n${migrationNotes.map((note) => `- ${note}`).join("\n")}\n\n## Remaining work\n\n${!validation || !browser ? "- Complete the local validation suite that has not yet run.\n" : ""}${[...failures, ...browserFailures].length ? "- Resolve the failures listed above, then rerun the affected checks.\n" : ""}- Configure and verify a real contact-form backend before deployment; local validation does not claim delivery.\n- Confirm the source map identity and inconsistent sidebar contact details with the business before publication.\n- Deployment, search-engine recrawling, field Core Web Vitals, and search ranking outcomes are outside local verification. Existing URLs and metadata are retained, but ranking outcomes cannot be guaranteed.\n\nLocal development command: \`npm run dev\` at \`http://localhost:3001\`. No live website files, forms, or administrative settings were modified.\n`;
  await mkdir("docs", { recursive: true });
  const buildEvidence = buildVerification
    ? `Build/lint verification: [record](build-verification.json).\n\n\`\`\`json\n${JSON.stringify(buildVerification, null, 2)}\n\`\`\``
    : "Build and lint results must be confirmed separately from these scripts; this report does not infer their success.";
  const mediaEvidence = mediaValidation
    ? `\n- [Original media redirect validation](media-redirect-validation.json): ${mediaValidation.total} original media URL redirects checked; ${mediaValidation.failures.length} failures.`
    : "";
  const recheckEvidence = browser?.lastRecheckedAt
    ? `\n\nBrowser geometry evidence was recorded at ${browser.checkedAt}; affected accessibility checks and additional component interactions were rechecked at ${browser.lastRecheckedAt}. The ${browser.cases.length} previously passing geometry cases were retained because the final fix only underlined existing text links.\n`
    : "";
  await writeFile("docs/migration-report.md", body
    .replace("Build and lint results must be confirmed separately from these scripts; this report does not infer their success.", buildEvidence)
    .replace("- [Local screenshots](screenshots/local/).", `- [Local screenshots](screenshots/local/).${mediaEvidence}${recheckEvidence}`));
}

async function main() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
    throw new Error(
      "BASE_URL must point to a loopback host; validation is local-only.",
    );
  const [mappings, pageInput, crawl] = await Promise.all([
    json("docs/url-map.json"),
    json("data/pages.json"),
    json("data/crawl.json"),
  ]);
  const pages = Array.isArray(pageInput) ? pageInput : pageInput.pages;
  const home = pages.find((page) => page.route === "/");
  const identityResponse = await request("/");
  const identityHtml = await identityResponse.text();
  if (
    identityResponse.status !== 200 ||
    normalize(load(identityHtml)("head title").text()) !==
      normalize(home?.title)
  )
    throw new Error(
      `The server at ${base.origin} does not identify as the migrated AC Experts homepage. Check BASE_URL before validation.`,
    );
  const result = {
    checkedAt: new Date().toISOString(),
    baseUrl: base.href,
    routes: [],
    pages: [],
    targets: [],
    fragments: [],
    content: [],
    seo: {},
    failures: [],
  };
  const htmlByRoute = new Map();
  const targets = new Map();
  const fragments = [];
  function fail(kind, path, message) {
    result.failures.push({ kind, path, message });
  }
  await pool(mappings, async (mapping) => {
    const path = new URL(mapping.originalUrl).pathname;
    try {
      const response = await request(path);
      const location = response.headers.get("location");
      const expected = mapping.destination || mapping.route;
      const row = {
        originalUrl: mapping.originalUrl,
        path,
        action: mapping.action,
        status: response.status,
        location,
        expected,
        ok: false,
      };
      if (mapping.action === "redirect") {
        const actual = location ? new URL(location, base) : null;
        row.ok =
          response.status === 308 &&
          actual?.origin === base.origin &&
          actual.pathname === new URL(expected, base).pathname &&
          !actual.search;
        if (!row.ok)
          fail(
            "redirect",
            path,
            `Expected 308 to ${expected}; received ${response.status} ${location || ""}`,
          );
        await response.body?.cancel();
      } else if (mapping.action === "migrate") {
        row.ok = response.status === 200;
        const html = await response.text();
        if (row.ok) htmlByRoute.set(mapping.route, html);
        else fail("route", path, `Expected 200; received ${response.status}`);
      } else {
        fail("unmigrated", path, `URL-map action is ${mapping.action}`);
        await response.body?.cancel();
      }
      result.routes.push(row);
    } catch (error) {
      fail("request", path, String(error));
      result.routes.push({
        path,
        action: mapping.action,
        ok: false,
        error: String(error),
      });
    }
  });
  console.log(`Checked ${result.routes.length} source URL mappings.`);
  for (const page of pages) {
    let html = htmlByRoute.get(page.route);
    if (!html) {
      try {
        const response = await request(page.route);
        if (response.status === 200) {
          html = await response.text();
          htmlByRoute.set(page.route, html);
        } else await response.body?.cancel();
      } catch {
        /* The route failure is recorded below. */
      }
    }
    if (!html) {
      fail(
        "page",
        page.route,
        "No successfully rendered HTML for content page",
      );
      continue;
    }
    const $ = load(html);
    const actual = {
      title: $("head title").first().text(),
      description: $('meta[name="description"]').attr("content") || "",
      canonical: $('link[rel="canonical"]').attr("href") || "",
      robots: $('meta[name="robots"]').attr("content") || "",
      h1: $("h1")
        .map((_, node) => $(node).text())
        .get(),
    };
    const mismatches = [];
    for (const key of ["title", "description", "canonical"])
      if (normalize(actual[key]) !== normalize(page[key]))
        mismatches.push(
          `${key}: expected ${JSON.stringify(page[key])}; received ${JSON.stringify(actual[key])}`,
        );
    if (/noindex/i.test(page.robots || "") !== /noindex/i.test(actual.robots))
      mismatches.push(
        `Robots indexability differs: expected ${JSON.stringify(page.robots)}; received ${JSON.stringify(actual.robots)}`,
      );
    if (
      actual.h1.length !== 1 ||
      normalize(actual.h1[0]) !== normalize(page.h1)
    )
      mismatches.push(
        `H1: expected one ${JSON.stringify(page.h1)}; received ${JSON.stringify(actual.h1)}`,
      );
    if ($("main").length !== 1)
      mismatches.push(
        `Expected one main landmark; received ${$("main").length}`,
      );
    for (const mismatch of mismatches) fail("metadata", page.route, mismatch);
    result.pages.push({
      route: page.route,
      type: page.type,
      ...actual,
      ok: !mismatches.length,
      mismatches,
    });
    $(
      'a[href],img[src],img[srcset],source[srcset],link[rel="stylesheet"][href],script[src]',
    ).each((_, node) => {
      const values =
        node.name === "img" || node.name === "source"
          ? [
              $(node).attr("src"),
              ...($(node).attr("srcset") || "")
                .split(",")
                .map((value) => value.trim().split(/\s+/)[0]),
            ]
          : [$(node).attr("href") || $(node).attr("src")];
      for (const raw of values.filter(Boolean)) {
        if (/^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) continue;
        let url;
        try {
          url = new URL(raw, new URL(page.route, base));
        } catch {
          fail("invalid-url", page.route, raw);
          continue;
        }
        if (["acexperts.ae", "www.acexperts.ae"].includes(url.hostname)) {
          fail("old-site-dependency", page.route, `${node.name}: ${url.href}`);
          continue;
        }
        if (url.origin !== base.origin) continue;
        if (url.hash && node.name === "a")
          fragments.push({
            from: page.route,
            path: url.pathname,
            id: decodeURIComponent(url.hash.slice(1)),
          });
        url.hash = "";
        const key = url.pathname + url.search;
        if (!targets.has(key))
          targets.set(key, { path: key, kinds: new Set(), from: new Set() });
        targets.get(key).kinds.add(node.name);
        targets.get(key).from.add(page.route);
      }
    });
    if (page.type === "article") {
      const expectedContent = load(page.contentHtml || "");
      const renderedText = normalize(
        $("main article.prose").length
          ? $("main article.prose").text()
          : $("main").text(),
      );
      const paragraphs = expectedContent("p,li,td,th")
        .map((_, node) => normalize(expectedContent(node).text()))
        .get()
        .filter((text) => text.length > 20);
      const missingParagraphs = paragraphs.filter(
        (text) => !renderedText.includes(text),
      );
      const source = crawl.pages.find(
        (item) =>
          item.url === page.sourceUrl || item.finalUrl === page.canonical,
      );
      let sourceParagraphs = [];
      let missingFromData = [];
      if (source?.sourceFile) {
        const sourceDocument = load(await readFile(source.sourceFile, "utf8"));
        const sourceBody = sourceDocument(
          ".elementor-widget-theme-post-content",
        ).first();
        sourceParagraphs = sourceBody
          .find("p,li,td,th")
          .map((_, node) => normalize(sourceDocument(node).text()))
          .get()
          .filter((text) => text.length > 20);
        const dataText = normalize(expectedContent.text());
        missingFromData = sourceParagraphs.filter(
          (text) => !dataText.includes(text),
        );
      }
      result.content.push({
        route: page.route,
        paragraphs: paragraphs.length,
        missingParagraphs,
        sourceParagraphs: sourceParagraphs.length,
        missingFromData,
        ok: !missingParagraphs.length && !missingFromData.length,
      });
      if (missingParagraphs.length)
        fail(
          "article-rendering",
          page.route,
          `${missingParagraphs.length} migrated paragraph/list/table texts missing from rendered article`,
        );
      if (missingFromData.length)
        fail(
          "article-migration",
          page.route,
          `${missingFromData.length} original paragraph/list/table texts missing from content data`,
        );
    }
  }
  await pool([...targets.values()], async (target) => {
    const row = {
      path: target.path,
      kinds: [...target.kinds],
      from: [...target.from],
      ok: false,
    };
    try {
      const response = await request(target.path);
      row.status = response.status;
      row.contentType = response.headers.get("content-type");
      row.location = response.headers.get("location");
      row.ok = response.status === 200;
      if (response.status >= 300 && response.status < 400 && row.location) {
        const destination = new URL(row.location, base);
        if (destination.origin === base.origin) {
          const destinationResponse = await request(
            destination.pathname + destination.search,
          );
          row.finalStatus = destinationResponse.status;
          row.ok = destinationResponse.status === 200;
          await destinationResponse.body?.cancel();
        }
      }
      if (
        row.kinds.some((kind) => ["img", "source"].includes(kind)) &&
        !row.contentType?.startsWith("image/")
      )
        row.ok = false;
      await response.body?.cancel();
      if (!row.ok)
        fail(
          "target",
          target.path,
          `Linked ${row.kinds.join("/")} target failed: HTTP ${row.status}, type ${row.contentType}`,
        );
    } catch (error) {
      row.error = String(error);
      fail("target", target.path, row.error);
    }
    result.targets.push(row);
  });
  for (const fragment of fragments) {
    const html = htmlByRoute.get(fragment.path);
    if (!html || !fragment.id) continue;
    const $ = load(html);
    const exists =
      $("[id]")
        .toArray()
        .some((node) => $(node).attr("id") === fragment.id) ||
      $("a[name]")
        .toArray()
        .some((node) => $(node).attr("name") === fragment.id);
    result.fragments.push({ ...fragment, ok: exists });
    if (!exists)
      fail(
        "fragment",
        fragment.from,
        `Missing ${fragment.path}#${fragment.id}`,
      );
  }
  for (const path of ["/sitemap.xml", "/robots.txt"]) {
    try {
      const response = await request(path);
      const body = await response.text();
      result.seo[path] = {
        status: response.status,
        ok: response.status === 200,
      };
      if (response.status !== 200) {
        fail("seo", path, `HTTP ${response.status}`);
        continue;
      }
      if (path === "/sitemap.xml") {
        const $ = load(body, { xmlMode: true });
        const urls = $("url > loc")
          .map((_, node) => $(node).text())
          .get();
        const missing = pages
          .filter((page) => !/noindex/i.test(page.robots || ""))
          .map(
            (page) => page.canonical || new URL(page.route, sourceOrigin).href,
          )
          .filter((url) => !urls.includes(url));
        const duplicates = urls.filter(
          (url, index) => urls.indexOf(url) !== index,
        );
        const noindexUrls = pages
          .filter((page) => /noindex/i.test(page.robots || ""))
          .map((page) => page.canonical)
          .filter((url) => urls.includes(url));
        result.seo[path] = {
          status: response.status,
          urls: urls.length,
          missing,
          duplicates,
          noindexUrls,
          ok: !missing.length && !duplicates.length && !noindexUrls.length,
        };
        if (missing.length || duplicates.length || noindexUrls.length)
          fail(
            "sitemap",
            path,
            `${missing.length} missing canonicals; ${duplicates.length} duplicates; ${noindexUrls.length} noindex URLs included`,
          );
      } else if (!body.includes(`${sourceOrigin}/sitemap.xml`))
        fail("robots", path, "Missing production sitemap URL");
    } catch (error) {
      fail("seo", path, String(error));
    }
  }
  result.routes.sort((a, b) => a.path.localeCompare(b.path));
  result.targets.sort((a, b) => a.path.localeCompare(b.path));
  result.summary = {
    sourceUrls: mappings.length,
    renderedPages: result.pages.length,
    redirects: result.routes.filter((item) => item.action === "redirect")
      .length,
    targetChecks: result.targets.length,
    articleChecks: result.content.length,
    failures: result.failures.length,
    passed: !result.failures.length,
  };
  await writeFile(
    "docs/validation-results.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeMigrationReport();
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.failures.length) {
    console.error(JSON.stringify(result.failures.slice(0, 15), null, 2));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

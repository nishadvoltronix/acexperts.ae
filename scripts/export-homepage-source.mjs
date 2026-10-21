import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { load } from "cheerio";

// Review-only export. Never import this into the application or rewrite its response.
// Run a local production server, then: node scripts/export-homepage-source.mjs
const outputDirectory = fileURLToPath(new URL("../artifacts/homepage-source-review/", import.meta.url));
const escape = (text) => String(text).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export function localHomepageUrl(input = "http://127.0.0.1:3100/") {
  const url = new URL(input);
  assert(["http:", "https:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash,
  "Use a loopback homepage URL without credentials, a path, query, or fragment.");
  return url;
}

export function createSourceReview(source, sourceUrl) {
  const $ = load(source, { sourceCodeLocationInfo: true });
  const sections = $(".home-page > section").toArray().map((node, index) => ({
    number: index + 1,
    label: $(node).find("h1,h2").first().text() || node.attribs.id || `Section ${index + 1}`,
    id: node.attribs.id || null,
    class: node.attribs.class || null,
    start: node.sourceCodeLocation.startOffset,
  }));
  const boundaries = new Map(sections.map((section) => [section.start, section]));
  const breaks = new Map([[0, 0]]);
  const atomic = new Set(["script", "style", "pre", "textarea", "title", "noscript", "svg", "math"]);

  function visit(node, depth) {
    const location = node.sourceCodeLocation;
    if (!location) {
      for (const child of node.children || []) visit(child, depth);
      return;
    }
    if (node.type === "text") return;
    breaks.set(location.startOffset, depth);
    // Keep scripts, preformatted content, and mixed inline text byte-for-byte.
    // Source locations are used only to divide escaped display rows, not to serialize HTML.
    if (atomic.has(node.name) || (node.children || []).some((child) => child.type === "text" && child.data.trim())) return;
    for (const child of node.children || []) visit(child, depth + 1);
    if (location.endTag) breaks.set(location.endTag.startOffset, depth);
  }
  visit($.root()[0], 0);
  const offsets = [...breaks.keys()].sort((left, right) => left - right);
  const rows = offsets.map((start, index) => ({
    start,
    depth: breaks.get(start),
    original: source.slice(start, offsets[index + 1] ?? source.length),
    section: boundaries.get(start),
  }));
  assert.equal(rows.map((row) => row.original).join(""), source, "The export must preserve every source character.");
  for (const section of sections) assert(rows.some((row) => row.start === section.start), "Section boundary missing from export.");

  const summary = {
    sourceUrl: String(sourceUrl),
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    sourceBytes: Buffer.byteLength(source),
    sourceLines: source.split("\n").length,
    displayRows: rows.length,
    sections,
    serverResponseFormatted: false,
    purpose: "Offline source inspection only. The website and Ctrl+U are unchanged.",
  };
  const navigation = sections.map((section) => `<a href="#section-${section.number}">${section.number}. ${escape(section.label)}</a>`).join("\n");
  const code = rows.map(({ depth, original, section }) => `<li${section ? ` id="section-${section.number}" class="section-boundary"` : ""}>${section ? `<strong class="section-label">Section ${section.number}: ${escape(section.label)}</strong>` : ""}<code><span aria-hidden="true">${"  ".repeat(depth)}</span><span class="original-source">${escape(original)}</span></code></li>`).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Homepage HTML source review</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1d2939; background: #f5f7fa; font: 15px/1.6 system-ui, sans-serif; }
    header, nav { padding: 24px 32px; background: white; border-bottom: 1px solid #d5dce5; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    p { margin: 8px 0; }
    a { color: #1849a9; text-underline-offset: 3px; }
    nav { display: flex; flex-wrap: wrap; gap: 8px 24px; }
    nav a { font-size: 13px; }
    main { padding: 24px 16px; }
    ol { margin: 0; padding-left: 4.5em; }
    li { padding: 2px 12px; background: white; scroll-margin-top: 16px; }
    li::marker { color: #526174; font: 12px/1.7 monospace; }
    code { display: block; font: 12px/1.7 ui-monospace, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .section-boundary { border-top: 2px solid #1849a9; margin-top: 24px; padding-top: 12px; }
    .section-label { display: block; margin-bottom: 12px; color: #1849a9; }
    @media (max-width: 600px) { header, nav { padding: 20px 16px; } main { padding: 16px 4px; } ol { padding-left: 3em; } }
  </style>
</head>
<body>
  <header>
    <h1>Homepage HTML source review</h1>
    <p>Separate offline export from <code>${escape(sourceUrl)}</code></p>
    <p><strong>This export does not change the website or Ctrl+U.</strong> Code below is escaped text and does not execute.</p>
    <p>${sections.length} homepage sections · ${rows.length} indented display rows · ${summary.sourceLines} original source lines</p>
    <p>Scripts, styles, inline text groups, and preformatted content are kept intact. Long lines wrap for reading.</p>
    <p><a href="./homepage-source.raw.html.txt" download>Download the untouched original HTML</a></p>
  </header>
  <nav aria-label="Homepage source sections">
${navigation}
  </nav>
  <main aria-label="Complete HTML source">
    <ol>
${code}
    </ol>
  </main>
</body>
</html>
`;
  return { html, summary };
}

async function main() {
  const url = localHomepageUrl(process.argv[2]);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200, "Local homepage must return 200 without redirecting.");
  assert.match(response.headers.get("content-type") || "", /^text\/html(?:;|$)/i);
  const source = await response.text();
  const review = createSourceReview(source, url.href);
  assert.equal(review.summary.sections.length, 12, "Expected all 12 homepage sections, including the AC viewer.");
  // Outputs live outside public/ and app/ and are never served by Next.js.
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "homepage-source.raw.html.txt"), source);
  await writeFile(resolve(outputDirectory, "homepage-source.html"), review.html);
  await writeFile(resolve(outputDirectory, "homepage-source.json"), JSON.stringify(review.summary, null, 2) + "\n");
  console.log(`Created ${resolve(outputDirectory, "homepage-source.html")} (${review.summary.displayRows} display rows, 12 sections).`);
  console.log("Review-only export. The server response and Ctrl+U remain unchanged.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Source export failed: ${error.message}`);
    process.exitCode = 1;
  });
}

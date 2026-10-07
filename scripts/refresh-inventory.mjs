import { readFile, writeFile } from "node:fs/promises";
const read = async (name) => JSON.parse(await readFile(name, "utf8"));
const [crawl, migrated, backgrounds, assets] = await Promise.all([
  read("data/crawl.json"),
  read("data/pages.json"),
  read("data/background-assets.json"),
  read("data/assets.json"),
]);
const byRoute = new Map(migrated.map((p) => [p.route, p]));
const byAsset = new Map(assets.map((a) => [a.url, a]));
const map = crawl.pages.map((p) => ({
  originalUrl: p.url,
  route: p.route || new URL(p.url).pathname,
  type: byRoute.get(p.route)?.type || p.type || "unavailable",
  sourceStatus: p.status,
  action:
    p.status !== 200
      ? "unavailable"
      : p.url !== p.finalUrl
        ? "redirect"
        : "migrate",
  destination: p.route || null,
}));
await writeFile("docs/url-map.json", JSON.stringify(map, null, 2) + "\n");
let markdown = `# Public website inventory\n\nSource: https://acexperts.ae/\n\nCrawled: ${crawl.crawledAt}\n\n${crawl.pages.length} discovered clean HTML URLs: ${migrated.length} content routes and ${map.filter((p) => p.action === "redirect").length} preserved redirects. Navigation, internal links, canonical URLs, robots and recursive XML sitemaps were followed to exhaustion. Public background media were inspected separately; derived image/layout facts are included without retaining theme code. Query variants, feeds and administrative/runtime endpoints are excluded with reasons in data/crawl.json.\n\n## Sitemaps\n\n${crawl.sitemaps.map((s) => `- ${s.url}: HTTP ${s.status}; ${s.entries} entries`).join("\n")}\n`;
for (const p of [...crawl.pages].sort((a, b) => a.url.localeCompare(b.url))) {
  const target = byRoute.get(p.route);
  const imgs = new Map((p.images || []).map((image) => [image.url, image]));
  for (const bg of backgrounds.filter((bg) => bg.page === p.finalUrl))
    if (!imgs.has(bg.url)) imgs.set(bg.url, bg);
  const notes = (target?.migrationNotes || []).map(note => typeof note === 'string' ? note : `${note.reason}${note.label ? ` ${note.label}: ${note.value}.` : ''}`);
  if (p.url !== p.finalUrl)
    notes.unshift(`Preserve permanent redirect to ${p.route}.`);
  if (!p.canonical)
    notes.push(
      "Source canonical absent; rebuilt route receives a self-referencing canonical.",
    );
  if (!p.h1?.length)
    notes.push(
      "Source H1 absent; page title provides an accessible visible H1.",
    );
  if (p.robots?.includes("noindex"))
    notes.push("Source noindex retained; route excluded from sitemap.");
  markdown += `\n## ${new URL(p.url).pathname}\n\n- Original URL: ${p.url}\n- Next.js route: ${p.route || "Unavailable"}\n- Action: ${map.find((m) => m.originalUrl === p.url).action}\n- Source HTTP status (after redirects): ${p.status}\n- Page type: ${target?.type || p.type || "unavailable"}\n- Page title: ${p.title || "(unavailable)"}\n- Original H1: ${(p.h1 || []).join(" / ") || "(absent)"}\n- Migrated H1: ${target?.h1 || "(unavailable)"}\n- Meta description: ${p.description || "(absent)"}\n- Original canonical: ${p.canonical || "(absent)"}\n- Migrated canonical: ${target?.canonical || "(unavailable)"}\n- Robots: ${p.robots || "(absent)"}\n- SEO notes: ${notes.join(" ") || "Original path, headings, content and metadata retained."}\n\n### Main sections\n\n${(p.sections || []).map((s) => `- ${s.level}: ${s.text}`).join("\n")}\n\n### Images\n\n${[...imgs.values()].map((i) => `- ${i.url}\n  - Local: ${byAsset.get(i.url)?.localPath || "(see assets inventory)"}; alt: ${i.alt || "(no source alt; decorative backgrounds use empty alt)"}`).join("\n")}\n\n### Internal links\n\n${(p.internalLinks || []).map((l) => `- ${l.url} — ${l.text || "(image/unnamed link)"}`).join("\n")}\n`;
}
await writeFile("docs/site-inventory.md", markdown);
console.log(
  `Refreshed inventory: ${map.length} URLs, ${migrated.length} routes, background media included.`,
);

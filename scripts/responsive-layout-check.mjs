import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";

// Audit every published route, including long article/category titles. This is
// read-only: no forms, external links or persistent browser state are changed.
const base = new URL(process.env.BASE_URL || "http://localhost:3001");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("BASE_URL must use a loopback host.");
}
const pages = JSON.parse(await readFile("data/pages.json", "utf8"));
const widths = (process.env.WIDTHS || "320,390,1440").split(",").map(Number);
const representatives = new Map([
  ["/", "home"], ["/about/", "about"],
  ["/ac-installation-service/", "service"], ["/services/", "services"],
  ["/products/", "products"], ["/projects/", "projects"],
  ["/project-portfolio/luxury-villa-ac-installation/", "project"],
  ["/blog/", "blog"], ["/category/uncategorized/repairing/", "category"],
  ["/contact-us/", "contact"], ["/faq/", "faq"],
  [pages.find((page) => page.type === "article").route, "article"],
]);
const routes = process.env.ROUTES ? pages.filter((page) => process.env.ROUTES.split(",").includes(page.route)) : pages;
const jobs = widths.flatMap((width) => routes.map((page) => ({ ...page, width })));
if (!process.env.WIDTHS && !process.env.ROUTES) {
  jobs.push(...pages.filter((page) => representatives.has(page.route)).map((page) => ({ ...page, width: 768 })));
}
const report = { checkedAt: new Date().toISOString(), base: base.href, cases: [], failures: [] };
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
let next = 0;

async function auditGeometry(page) {
  return page.evaluate(() => {
    const round = (value) => Math.round(value * 10) / 10;
    const rectData = (rect) => ({ x: round(rect.x), y: round(rect.y + scrollY), width: round(rect.width), height: round(rect.height), right: round(rect.right) });
    const descriptor = (element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className ? `.${element.className.trim().split(/\s+/).join(".")}` : ""}`;
    const isVisible = (element) => {
      if (!element.getClientRects().length || element.closest("[inert],[hidden]")) return false;
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (ancestor.tagName === "DETAILS" && !ancestor.open && !ancestor.querySelector("summary")?.contains(element)) return false;
      }
      const style = getComputedStyle(element);
      return !(style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)");
    };
    const textOverflow = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!node.textContent.trim() || !parent || !parent.closest("main,header,footer") || !isVisible(parent) || parent.closest("script,style,svg,[aria-hidden=true]")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const hasHorizontalScroller = (() => {
        for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const rect = ancestor.getBoundingClientRect();
          if (/auto|scroll/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1 && rect.left >= -1.5 && rect.right <= innerWidth + 1.5) return true;
        }
        return false;
      })();
      const outside = [...range.getClientRects()].filter((rect) => !hasHorizontalScroller && rect.width > 1 && (rect.left < -1.5 || rect.right > innerWidth + 1.5));
      if (outside.length) textOverflow.push({ element: descriptor(parent), text: node.textContent.trim().slice(0, 140), rects: outside.map(rectData) });
    }
    const controls = [...document.querySelectorAll("main button,main .button,main input:not([type=hidden]),main select,main textarea,header button,header .button,footer button")].filter(isVisible);
    const controlOverflow = controls.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1.5 || rect.right > innerWidth + 1.5;
    }).map((element) => ({ element: descriptor(element), text: (element.textContent || element.getAttribute("aria-label") || element.getAttribute("name") || "").trim().slice(0, 80), rect: rectData(element.getBoundingClientRect()) }));
    const buttonOverlaps = [];
    for (let i = 0; i < controls.length; i++) {
      const first = controls[i];
      const a = first.getBoundingClientRect();
      for (let j = i + 1; j < controls.length; j++) {
        const second = controls[j];
        if (first.contains(second) || second.contains(first)) continue;
        const b = second.getBoundingClientRect();
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 3 && height > 3) buttonOverlaps.push({ first: descriptor(first), firstText: first.textContent?.trim().slice(0, 70), second: descriptor(second), secondText: second.textContent?.trim().slice(0, 70), width: round(width), height: round(height), firstRect: rectData(a), secondRect: rectData(b) });
      }
    }
    const missingImages = [...document.images].filter((image) => isVisible(image) && (!image.complete || !image.naturalWidth)).map((image) => ({ src: image.currentSrc || image.src, alt: image.alt }));
    const clippedControls = controls.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!/hidden|clip/.test(`${style.overflowX} ${style.overflowY}`)) continue;
        const box = parent.getBoundingClientRect();
        if (rect.left < box.left - 2 || rect.right > box.right + 2 || rect.top < box.top - 2 || rect.bottom > box.bottom + 2) {
          return [{ element: descriptor(element), text: element.textContent?.trim().slice(0, 70), parent: descriptor(parent), rect: rectData(rect), parentRect: rectData(box) }];
        }
      }
      return [];
    });
    const tableScroll = [...document.querySelectorAll("main table")].filter(isVisible).map((table) => {
      const width = table.clientWidth;
      const contentWidth = table.scrollWidth;
      const initial = table.scrollLeft;
      table.scrollLeft = contentWidth;
      const reachable = contentWidth <= width + 1 || table.scrollLeft >= contentWidth - width - 1;
      table.scrollLeft = initial;
      return { width, contentWidth, reachable };
    });
    const alignmentIssues = [];
    for (const [selector, target] of [[".home-services .service-card", ".learn-more"], [".page-products .columns-4 .service-card", null]]) {
      const rows = [];
      for (const card of [...document.querySelectorAll(selector)].filter(isVisible)) {
        const rect = card.getBoundingClientRect();
        let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 2);
        if (!row) { row = { top: rect.top, bottoms: [] }; rows.push(row); }
        const aligned = target ? card.querySelector(target) : card;
        if (aligned) row.bottoms.push(aligned.getBoundingClientRect().bottom);
      }
      for (const row of rows) {
        const spread = Math.max(...row.bottoms) - Math.min(...row.bottoms);
        if (spread > 2) alignmentIssues.push({ selector, target, rowTop: round(row.top + scrollY), spread: round(spread) });
      }
    }
    return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, textOverflow, controlOverflow, buttonOverlaps, clippedControls, missingImages, tableScroll, alignmentIssues };
  });
}

async function worker() {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  while (next < jobs.length) {
    const job = jobs[next++];
    const entry = { route: job.route, type: job.type, width: job.width, errors: [] };
    const pendingImages = new Set();
    const onRequest = (request) => { if (request.resourceType() === "image") pendingImages.add(request.url()); };
    const onFinished = (request) => { if (request.resourceType() === "image") pendingImages.delete(request.url()); };
    const onError = (error) => entry.errors.push(String(error));
    page.on("pageerror", onError);
    page.on("request", onRequest);
    page.on("requestfinished", onFinished);
    page.on("requestfailed", onFinished);
    try {
      await page.setViewportSize({ width: job.width, height: 900 });
      const response = await page.goto(new URL(job.route, base).href, { waitUntil: "load", timeout: 90000 });
      entry.status = response.status();
      await page.evaluate(async () => {
        [...document.images].forEach((image) => { image.loading = "eager"; });
        await Promise.race([Promise.all([...document.images].map((image) => image.decode().catch(() => null))), new Promise((resolve) => setTimeout(resolve, 12000))]);
        await document.fonts.ready;
      });
      await page.waitForTimeout(150);
      Object.assign(entry, await auditGeometry(page));
      if (entry.missingImages.length) entry.pendingImageRequests = [...pendingImages];
      entry.ok = entry.status === 200 && entry.documentWidth <= job.width + 1 && !entry.textOverflow.length && !entry.controlOverflow.length && !entry.buttonOverlaps.length && !entry.clippedControls.length && !entry.missingImages.length && !entry.alignmentIssues.length && entry.tableScroll.every((table) => table.reachable) && !entry.errors.length;
      if (representatives.has(job.route) && [390, 1440].includes(job.width) && process.env.SCREENSHOTS !== "0") {
        entry.screenshot = `artifacts/responsive-${representatives.get(job.route)}-${job.width}.png`;
        await page.screenshot({ path: entry.screenshot, fullPage: true, animations: "disabled" });
      }
    } catch (error) {
      entry.ok = false;
      entry.errors.push(String(error));
    } finally {
      page.off("pageerror", onError);
      page.off("request", onRequest);
      page.off("requestfinished", onFinished);
      page.off("requestfailed", onFinished);
    }
    report.cases.push(entry);
    if (!entry.ok) {
      report.failures.push(entry);
      console.error(`FAIL ${job.width} ${job.route} ${JSON.stringify({ text: entry.textOverflow, controls: entry.controlOverflow, overlap: entry.buttonOverlaps, clipped: entry.clippedControls, alignment: entry.alignmentIssues, images: entry.missingImages, errors: entry.errors })}`);
    } else {
      console.log(`PASS ${job.width} ${job.route}`);
    }
  }
  await context.close();
}

try {
  await Promise.all(Array.from({ length: 3 }, worker));
} finally {
  await browser.close();
}
report.cases.sort((a, b) => a.width - b.width || a.route.localeCompare(b.route));
report.summary = { cases: report.cases.length, routes: new Set(report.cases.map((entry) => entry.route)).size, failures: report.failures.length, passed: report.cases.length === jobs.length && !report.failures.length };
await writeFile("artifacts/responsive-layout-check.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
if (!report.summary.passed) process.exitCode = 1;

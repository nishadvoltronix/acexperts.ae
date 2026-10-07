import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright';

// Read-only application audit. Writes its report and optional screenshots to docs.
const output = process.argv[2] || 'docs/site-image-audit-before.json';
const origin = process.env.BASE_URL || 'http://localhost:3001';
const pages = JSON.parse(fs.readFileSync('data/pages.json', 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const sourceFiles = [...['app', 'components', 'lib'].flatMap(walk), ...['data/pages.json', 'data/assets.json', 'data/image-quality.json', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json'].filter(fs.existsSync)].sort();
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file.replaceAll('\\', '/'), hash(fs.readFileSync(file))]));
const assetFiles = ['public/images', 'public/icons'].filter(fs.existsSync).flatMap(walk);
const assetMetadata = {};
for (const file of assetFiles) {
  const url = '/' + file.replaceAll('\\', '/').replace(/^public\//, '');
  try {
    const metadata = await sharp(file).metadata();
    assetMetadata[url] = { width: metadata.width, height: metadata.height, format: metadata.format, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) };
  } catch { /* A non-raster file is still represented in the DOM audit. */ }
}
const allJobs = pages.flatMap(page => [1440, 390].map(width => ({ route: page.route, type: page.type, width })));
const resume = process.env.AUDIT_RESUME === '1' && fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : null;
const jobs = resume ? allJobs.filter(job => !resume.pages.some(page => page.route === job.route && page.width === job.width)) : allJobs;
const report = { capturedAt: resume?.capturedAt || new Date().toISOString(), origin, deviceScaleFactor: 2, routeCount: pages.length, sourceHashes: resume?.sourceHashes || sourceHashes, assetMetadata, pages: resume?.pages || [], uniqueImages: [], failures: [], ...(resume ? { retryAt: new Date().toISOString(), initialFailures: resume.failures } : {}) };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let jobIndex = 0;
let completed = 0;
async function worker() {
  while (jobIndex < jobs.length) {
    const job = jobs[jobIndex++];
    const page = await browser.newPage({ viewport: { width: job.width, height: 1000 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const response = await page.goto(origin + job.route, { waitUntil: 'networkidle', timeout: 60000 });
      if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()} loading ${job.route}; page errors: ${errors.join('; ')}`);
      await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const image of document.images) image.loading = 'eager';
        await Promise.race([
          Promise.all([...document.images].map(image => image.decode().catch(() => {}))),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Image decoding timeout: ' + [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.currentSrc || image.src).join(', '))), 30000)),
        ]);
      });
      const snapshot = await page.evaluate(() => {
        const round = n => Math.round(n * 100) / 100;
        const rect = element => { const r = element.getBoundingClientRect(); return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) }; };
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style,nextjs-portal').forEach(element => element.remove());
        const selected = 'header,main,footer,section,article,aside,h1,h2,h3,h4,p,.container,.content-grid,.card-grid,.content-card,.reference-art,.hero-diagnostics,.internal-hero-inner,.internal-hero-art,.article-layout,.article-featured,.media-panel,.gallery-grid,.service-card,.stat-card,.testimonial-card,.cta-card,.footer-grid,.footer-bottom';
        return {
          document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
          font: getComputedStyle(document.body).fontFamily,
          title: document.title,
          description: document.querySelector('meta[name=description]')?.content,
          canonical: document.querySelector('link[rel=canonical]')?.href,
          robots: document.querySelector('meta[name=robots]')?.content,
          structuredData: [...document.querySelectorAll('script[type="application/ld+json"]')].map(element => element.textContent),
          visibleBodyText: document.body.innerText,
          bodyTextContent: clone.textContent,
          links: [...document.querySelectorAll('a')].map(element => ({ href: element.getAttribute('href'), text: element.textContent, ariaLabel: element.getAttribute('aria-label') })),
          controls: [...document.querySelectorAll('button,input,textarea,select,summary')].map(element => ({ tag: element.tagName, type: element.getAttribute('type'), text: element.textContent, name: element.getAttribute('name'), ariaLabel: element.getAttribute('aria-label') })),
          geometry: [...document.querySelectorAll(selected)].map((element, index) => ({ index, tag: element.tagName, className: element.className, rect: rect(element) })),
          images: [...document.images].map((image, index) => {
            const wrapper = image.parentElement.classList.contains('reference-art') ? image.parentElement : null;
            const style = getComputedStyle(image);
            const imageRect = rect(image);
            const viewport = wrapper ? rect(wrapper) : imageRect;
            const url = new URL(image.currentSrc || image.src, location.href);
            const assetPath = url.pathname.startsWith('/_next/image') ? url.searchParams.get('url') : url.pathname;
            return { index, alt: image.alt, source: image.getAttribute('src'), currentSource: image.currentSrc, sourceSet: image.getAttribute('srcset'), sizes: image.getAttribute('sizes'), assetPath, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, imageRect, viewport, objectFit: style.objectFit, objectPosition: style.objectPosition, referenceArt: wrapper?.className || null, requestedWidth: Number(url.searchParams.get('w')) || null, quality: Number(url.searchParams.get('q')) || null, visible: viewport.width > 0 && viewport.height > 0 && style.visibility !== 'hidden', complete: image.complete };
          }),
        };
      });
      report.pages.push({ ...job, status: response?.status(), errors, ...snapshot });
      if (job.route === '/') await page.screenshot({ path: output.replace(/\.json$/, '') + '-' + job.width + '.png', fullPage: true, animations: 'disabled' });
    } catch (error) {
      report.failures.push({ ...job, error: String(error), errors });
    } finally {
      await page.close();
      completed++;
      if (completed % 12 === 0 || completed === jobs.length) {
        console.log(`Captured ${completed}/${jobs.length} route/viewport states`);
        fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      }
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await browser.close();

const downloadSources = [...new Set(report.pages.flatMap(page => page.images.filter(image => image.visible && image.currentSource).map(image => image.currentSource)))];
const decodedImages = {};
let downloadIndex = 0;
async function decodeWorker() {
  while (downloadIndex < downloadSources.length) {
    const url = downloadSources[downloadIndex++];
    try {
      const response = await fetch(url, { headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(30000) });
      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      decodedImages[url] = { status: response.status, width: metadata.width, height: metadata.height, format: metadata.format, bytes: buffer.length };
    } catch (error) { decodedImages[url] = { error: String(error) }; }
  }
}
await Promise.all(Array.from({ length: 4 }, decodeWorker));
report.decodedImages = decodedImages;
const unique = new Map();
for (const page of report.pages) for (const image of page.images) {
  const original = assetMetadata[image.assetPath];
  const decoded = decodedImages[image.currentSource];
  const key = image.assetPath + '|' + (image.referenceArt || 'image');
  if (!unique.has(key)) unique.set(key, { assetPath: image.assetPath, referenceArt: image.referenceArt, original, altExamples: [], occurrences: [], maxOriginalUpscaleDpr2: 0, maxDownloadedUpscaleDpr2: 0 });
  const entry = unique.get(key);
  if (!entry.altExamples.includes(image.alt)) entry.altExamples.push(image.alt);
  let effectiveOriginal = original && { width: original.width, height: original.height };
  let effectiveDecoded = decoded?.width && { width: decoded.width, height: decoded.height };
  if (image.referenceArt && image.imageRect.width > 0 && image.imageRect.height > 0) {
    if (effectiveOriginal) effectiveOriginal = { width: original.width * image.viewport.width / image.imageRect.width, height: original.height * image.viewport.height / image.imageRect.height };
    if (effectiveDecoded) effectiveDecoded = { width: decoded.width * image.viewport.width / image.imageRect.width, height: decoded.height * image.viewport.height / image.imageRect.height };
  }
  const scale = dimensions => {
    if (!image.visible || !dimensions?.width || !dimensions?.height) return null;
    const horizontal = image.viewport.width * 2 / dimensions.width;
    const vertical = image.viewport.height * 2 / dimensions.height;
    return image.objectFit === 'contain' && !image.referenceArt ? Math.min(horizontal, vertical) : Math.max(horizontal, vertical);
  };
  const originalUpscaleDpr2 = scale(effectiveOriginal);
  const downloadedUpscaleDpr2 = scale(effectiveDecoded);
  const occurrence = { route: page.route, width: page.width, index: image.index, viewport: image.viewport, objectFit: image.objectFit, visible: image.visible, effectiveOriginal, effectiveDecoded, originalUpscaleDpr2, downloadedUpscaleDpr2, quality: image.quality, currentSource: image.currentSource };
  entry.occurrences.push(occurrence);
  entry.maxOriginalUpscaleDpr2 = Math.max(entry.maxOriginalUpscaleDpr2, originalUpscaleDpr2 || 0);
  entry.maxDownloadedUpscaleDpr2 = Math.max(entry.maxDownloadedUpscaleDpr2, downloadedUpscaleDpr2 || 0);
}
report.uniqueImages = [...unique.values()].sort((a, b) => b.maxOriginalUpscaleDpr2 - a.maxOriginalUpscaleDpr2);
report.sourceHashChangesDuringCapture = sourceFiles.flatMap(file => { const key = file.replaceAll('\\', '/'); const after = hash(fs.readFileSync(file)); return after === report.sourceHashes[key] ? [] : [{ file: key, before: report.sourceHashes[key], after }]; });
report.pages.sort((a, b) => a.route.localeCompare(b.route) || b.width - a.width);
report.summary = { capturedStates: report.pages.length, expectedStates: allJobs.length, failures: report.failures.length, uniqueImages: report.uniqueImages.length, originalUpscaleAboveTwo: report.uniqueImages.filter(image => image.maxOriginalUpscaleDpr2 > 2).length, originalUpscaleAboveOne: report.uniqueImages.filter(image => image.maxOriginalUpscaleDpr2 > 1.05).length, overflows: report.pages.filter(page => page.document.width > page.width).map(page => ({ route: page.route, width: page.width, documentWidth: page.document.width })), brokenImages: report.pages.flatMap(page => page.images.filter(image => !image.naturalWidth).map(image => ({ route: page.route, width: page.width, source: image.currentSource }))), sourceHashesStable: report.sourceHashChangesDuringCapture.length === 0 };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, summary: report.summary, priority: report.uniqueImages.slice(0, 18).map(image => ({ assetPath: image.assetPath, referenceArt: image.referenceArt, dimensions: image.original && [image.original.width, image.original.height], maxOriginalUpscaleDpr2: +image.maxOriginalUpscaleDpr2.toFixed(2), visibleOccurrences: image.occurrences.filter(occurrence => occurrence.visible).length, largest: image.occurrences.filter(occurrence => occurrence.visible).sort((a, b) => (b.originalUpscaleDpr2 || 0) - (a.originalUpscaleDpr2 || 0))[0] })) }, null, 2));

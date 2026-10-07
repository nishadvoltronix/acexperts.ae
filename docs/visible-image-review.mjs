import fs from 'node:fs';
import { chromium } from 'playwright';
const origin = process.env.BASE_URL || 'http://localhost:3001';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/about/', '/products/'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
for (const route of routes) for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
  const stem = `docs/visible-quality-${route.replaceAll('/', '') || 'home'}-${width}`;
  await page.goto(origin + route, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) image.loading = 'eager';
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
  await page.screenshot({ path: stem + '-full.png', fullPage: true, animations: 'disabled' });
  for (const [name, selector] of [['logo', 'header .brand-logo'], ['cta', '.shared-cta'], ['hero', '.internal-hero-art'], ['footer', 'footer .brand-logo']]) {
    const item = page.locator(selector).first();
    if (await item.count()) await item.screenshot({ path: stem + '-' + name + '.png', animations: 'disabled' });
  }
  const images = await page.evaluate(() => [...document.images].map(image => {
    const box = image.getBoundingClientRect();
    const url = new URL(image.currentSrc || image.src, location.href);
    return { alt: image.alt, source: url.pathname.startsWith('/_next/image') ? url.searchParams.get('url') : url.pathname, deliveredUrl: image.currentSrc, width: box.width, height: box.height, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, className: image.className };
  }));
  report.push({ route, width, images });
  console.log(JSON.stringify({ route, width, images: images.length, replacements: images.filter(image => image.source?.includes('/quality/')).map(image => image.source) }));
  await page.close();
}
await browser.close();
fs.writeFileSync('docs/visible-image-review.json', JSON.stringify(report, null, 2) + '\n');

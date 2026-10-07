import fs from 'node:fs';
import { chromium } from 'playwright';

const registry = JSON.parse(fs.readFileSync('data/image-quality.json', 'utf8'));
const jobs = [
  ['/10-important-questions-ask-before-signing-ac-maintenance-contract-dubai/', 'questions', '/images/blog/10-important-questions-to-ask-before-signing-an-ac-maintenance-contract-in-dubai-featured-image-voltronix-6929ebbb.png'],
  ['/the-benefits-of-professional-hvac-inspections-for-dubai/', 'hvac', '/images/blog/the-benefits-of-professional-hvac-inspections-for-dubai-commercial-properties-voltronix-6d47df7e.png'],
  ['/from-installation-to-maintenance-the-complete-ac-guide-for-new-dubai-residents/', 'installation', '/images/blog/from-installation-to-maintenance-the-complete-ac-guide-for-new-dubai-residents-e1b40893.png'],
  ['/ac-experts-tips-for-keeping-your-cooling-system-efficient/', 'efficiency', '/images/blog/featured-image-voltronix-1-311f7cae.webp'],
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
for (const [route, id, original] of jobs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3001' + route, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
  const hero = page.locator('.internal-hero-art');
  const target = hero.locator('img');
  const bounds = await target.boundingBox();
  const enhanced = `docs/blog-fidelity-${id}-enhanced.png`;
  const source = `docs/blog-fidelity-${id}-original.png`;
  await hero.screenshot({ path: enhanced });
  await target.evaluate(async (image, url) => { image.removeAttribute('srcset'); image.src = url; await image.decode(); }, original);
  await hero.screenshot({ path: source });
  report.push({ route, id, source: original, enhanced: registry[original].localPath, bounds, screenshots: { original: source, enhanced } });
  await page.close();
}
const gallery = await browser.newPage({ viewport: { width: 1240, height: 1700 }, deviceScaleFactor: 1 });
const imageData = file => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
await gallery.setContent(`<style>body{margin:0;background:#eee;font:16px Arial}section{padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}h2{grid-column:1/-1;font-size:16px;margin:0}figure{margin:0;background:white}figcaption{padding:8px;font-size:13px;color:#333}img{width:100%;display:block}</style>${report.map(item => `<section><h2>${item.id}</h2><figure><figcaption>Original at existing desktop size</figcaption><img src="${imageData(item.screenshots.original)}"></figure><figure><figcaption>Enhanced at existing desktop size</figcaption><img src="${imageData(item.screenshots.enhanced)}"></figure></section>`).join('')}`);
await gallery.evaluate(async () => Promise.all([...document.images].map(image => image.decode())));
await gallery.screenshot({ path: 'docs/blog-fidelity-comparison.png', fullPage: true });
await browser.close();
fs.writeFileSync('docs/blog-fidelity-browser-review.json', JSON.stringify({ capturedAt: new Date().toISOString(), viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, method: 'Enhanced image captured from actual route; original image substituted in browser DOM only, with the same image wrapper, CSS, dimensions and white background.', images: report }, null, 2) + '\n');
console.log('Saved four actual-route before/after image captures and docs/blog-fidelity-comparison.png');

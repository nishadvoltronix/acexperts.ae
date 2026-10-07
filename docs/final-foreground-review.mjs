import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [route, src, name] of [
  ['/category/uncategorized/', 'hidden-reasons', 'archive'],
  ['/services/', 'technician-man', 'technician'],
  ['/ac-repair-services/', 'ac-repair-dubai', 'repair'],
]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3001' + route, { waitUntil: 'domcontentloaded' });
  const target = page.locator(`img[src*="${src}"]`).first();
  await target.scrollIntoViewIfNeeded();
  await target.evaluate(async image => { image.loading = 'eager'; await image.decode(); });
  await target.screenshot({ path: `docs/final-foreground-${name}.png` });
  await page.close();
}
await browser.close();

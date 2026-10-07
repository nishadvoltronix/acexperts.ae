import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the local production server.');
const pages = JSON.parse(await readFile('data/pages.json', 'utf8'));
const routes = ['/', '/ac-installation-service/', pages.find(page => page.type === 'article').route];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const result = { checkedAt: new Date().toISOString(), baseUrl: base, note: 'Single cold browser-context samples from the local production build; lab measurements, not field Core Web Vitals. Mobile uses 4x CPU slowdown, 100ms network latency and 1.6Mbps download.', cases: [] };
try {
  for (const mobile of [false, true]) for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 }, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (mobile) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200000, uploadThroughput: 93750 });
    }
    await page.addInitScript(() => {
      window.__metrics = { lcp: 0, cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__metrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__metrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return { lcpMs: Math.round(window.__metrics.lcp), cls: Number(window.__metrics.cls.toFixed(4)), ttfbMs: Math.round(nav.responseStart), domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadMs: Math.round(nav.loadEventEnd), transferBytes: nav.transferSize + resources.reduce((sum, r) => sum + r.transferSize, 0), scriptTransferBytes: resources.filter(r => r.initiatorType === 'script').reduce((sum, r) => sum + r.transferSize, 0), requests: resources.length + 1, externalRequests: resources.filter(r => new URL(r.name).origin !== location.origin).map(r => r.name) };
    });
    result.cases.push({ route, viewport: mobile ? '390 mobile / throttled' : '1440 desktop / unthrottled', ...metrics });
    console.log(JSON.stringify(result.cases.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
await writeFile('docs/redesign-performance.json', JSON.stringify(result, null, 2) + '\n');

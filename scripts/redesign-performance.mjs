import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const base = process.env.BASE_URL || 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the local production server.');
const pages = JSON.parse(await readFile('data/pages.json', 'utf8'));
const output = process.env.PERFORMANCE_OUTPUT || 'docs/redesign-performance.json';
const samples = Number(process.env.PERFORMANCE_SAMPLES || 3);
if (!Number.isInteger(samples) || samples < 1 || samples > 5) throw new Error('PERFORMANCE_SAMPLES must be 1 through 5.');
const routes = ['/', '/ac-installation-service/', pages.find(page => page.type === 'article').route];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const result = { checkedAt: new Date().toISOString(), baseUrl: base, browser: browser.version(), samplesPerCase: samples, label: process.env.PERFORMANCE_RUN_LABEL || 'local', note: 'Cold browser-context samples from the local production build, sequential without other browser suites. Mobile uses 4x CPU slowdown, 100ms latency and 1.6Mbps download. Server/image caches may be warm. CLS uses the largest session window. Menu interaction latency is a bounded lab observation, not whole-visit or field INP; null means no Event Timing entry met the 16ms reporting threshold. These are not Lighthouse or field scores.', cases: [] };
try {
  for (const mobile of [false, true]) for (const route of routes) for (let sample = 1; sample <= samples; sample++) {
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
      window.__metrics = { lcp: 0, cls: 0, interactions: [], supported: PerformanceObserver.supportedEntryTypes };
      let windowStart = null, previousShift = 0, sessionScore = 0;
      new PerformanceObserver(list => { for (const entry of list.getEntries()) {
        window.__metrics.lcp = entry.startTime;
        window.__metrics.lcpElement = entry.element?.tagName ?? null;
        window.__metrics.lcpResource = entry.url ? new URL(entry.url).pathname : null;
      } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (windowStart !== null && entry.startTime - previousShift < 1000 && entry.startTime - windowStart < 5000) sessionScore += entry.value;
          else { sessionScore = entry.value; windowStart = entry.startTime; }
          previousShift = entry.startTime;
          window.__metrics.cls = Math.max(window.__metrics.cls, sessionScore);
        }
      }).observe({ type: 'layout-shift', buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes('event')) new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.interactionId) window.__metrics.interactions.push({ id: entry.interactionId, duration: entry.duration });
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });
    await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);
    const menu = page.locator(mobile ? 'header button.menu-toggle' : 'header summary').first();
    await menu.click();
    await page.waitForTimeout(250);
    await menu.click();
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return { lcpMs: Math.round(window.__metrics.lcp), lcpElement: window.__metrics.lcpElement, lcpResource: window.__metrics.lcpResource, cls: Number(window.__metrics.cls.toFixed(4)), ttfbMs: Math.round(nav.responseStart - nav.startTime), domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadMs: Math.round(nav.loadEventEnd), transferBytes: nav.transferSize + resources.reduce((sum, r) => sum + r.transferSize, 0), scriptTransferBytes: resources.filter(r => r.initiatorType === 'script' || /\.m?js$/.test(new URL(r.name).pathname)).reduce((sum, r) => sum + r.transferSize, 0), requests: resources.length + 1, externalRequests: resources.filter(r => new URL(r.name).origin !== location.origin).map(r => r.name), eventTimingSupported: window.__metrics.supported.includes('event'), sampledInteractionMs: window.__metrics.interactions.length ? Math.max(...window.__metrics.interactions.map(e => e.duration)) : null, reportedInteractions: new Set(window.__metrics.interactions.map(e => e.id)).size };
    });
    result.cases.push({ route, sample, viewport: mobile ? '390 mobile / throttled' : '1440 desktop / unthrottled', ...metrics });
    console.log(JSON.stringify(result.cases.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
const median = values => { const sorted = [...values].sort((a, b) => a - b); const half = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2; };
result.summary = [];
for (const viewport of [...new Set(result.cases.map(row => row.viewport))]) for (const route of routes) {
  const rows = result.cases.filter(row => row.route === route && row.viewport === viewport);
  result.summary.push({ route, viewport, samples: rows.length, medianLcpMs: median(rows.map(r => r.lcpMs)), maxCls: Math.max(...rows.map(r => r.cls)), medianTtfbMs: median(rows.map(r => r.ttfbMs)), medianScriptBytes: median(rows.map(r => r.scriptTransferBytes)), sampledInteractionMaxMs: rows.some(r => r.sampledInteractionMs !== null) ? Math.max(...rows.map(r => r.sampledInteractionMs ?? 0)) : null, externalRequestCount: rows.reduce((sum, r) => sum + r.externalRequests.length, 0) });
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');

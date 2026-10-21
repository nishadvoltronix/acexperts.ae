import assert from "node:assert/strict";

// Independent oracles from the supplied embed; never import app constants.
export const ZOHO_CONTACT_URL = "https://forms.zohopublic.com/voltronixswitchgearllc/form/AcRepaircontactus/formperma/-_F4cEostcoaZhL2qx8mAUiQiXG49dhtpAN5rrzPXNU";
const ZOHO_CONTACT_EMBED_URL = `${ZOHO_CONTACT_URL}?zf_rszfm=1`;
const FORM_PERMALINK = "-_F4cEostcoaZhL2qx8mAUiQiXG49dhtpAN5rrzPXNU";
// The existing CSP retains this origin; the new form must never submit to it.
export const ZOHO_CONTACT_ORIGIN = "https://crm.zoho.com";
export const CONTACT_MAP_URL = "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s2645270074494771790";
const MAP_MARKER = "Local intercepted Google Map; no provider traffic.";
const FRAME_SELECTOR = "iframe#ziframe_850132";
const FRAME_MARKER = "Local intercepted Zoho Forms embed; no enquiry delivered.";
const GTM_SCRIPT = "https://www.googletagmanager.com/gtm.js?id=GTM-K9HW63CV";
const GTM_FRAME = "https://www.googletagmanager.com/ns.html?id=GTM-K9HW63CV";

export async function interceptZohoContact(context, base) {
  const frameRequests = [], mapRequests = [], unexpectedPosts = [], unexpectedProviderRequests = [];
  const localOrigin = new URL(base).origin;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.href === CONTACT_MAP_URL && request.method() === "GET" && request.isNavigationRequest()) {
      mapRequests.push(request.url());
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html lang="en"><head><title>Local map fixture</title></head><body><p>${MAP_MARKER}</p></body></html>`,
      });
    }
    if (url.origin + url.pathname === ZOHO_CONTACT_URL && request.method() === "GET" && request.isNavigationRequest()) {
      frameRequests.push(request.url());
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html lang="en"><head><title>Local form fixture</title></head><body><main><p>${FRAME_MARKER}</p></main></body></html>`,
      });
    }
    if (request.method() === "POST" && (url.origin !== localOrigin || /^\/api\/contact\/?$/.test(url.pathname))) {
      unexpectedPosts.push(request.url());
      return route.fulfill({ status: 400, contentType: "text/plain", body: "Unexpected form destination blocked by test" });
    }
    if (/(^|\.)(zoho\.com|zohopublic\.com|zohocdn\.com|zohostatic\.com)$/.test(url.hostname)) {
      unexpectedProviderRequests.push(request.url());
      return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* Unexpected provider request blocked by test. */" });
    }
    return route.fallback();
  });
  return { frameRequests, mapRequests, unexpectedPosts, unexpectedProviderRequests };
}

export async function checkContactMap(page, intercepted) {
  const frame = page.locator("iframe.contact-location-map");
  assert.equal(await frame.count(), 1);
  assert.equal(await frame.getAttribute("src"), CONTACT_MAP_URL);
  assert.equal(await frame.getAttribute("title"), "Voltronix Contracting LLC on Google Maps");
  assert.equal(await frame.getAttribute("loading"), "lazy");
  await frame.scrollIntoViewIfNeeded();
  await page.frameLocator("iframe.contact-location-map").getByText(MAP_MARKER, { exact: true }).waitFor();
  assert(intercepted.mapRequests.length > 0, "The map must load through the page's real CSP");
  const layout = await frame.evaluate((element) => {
    const map = element.getBoundingClientRect();
    const card = element.closest(".location-panel").getBoundingClientRect();
    return { height: map.height, width: map.width, cardWidth: card.width, insideCard: map.left >= card.left && map.right <= card.right, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(layout.height, 200, "Keep the map compact");
  assert(layout.width > 0 && layout.cardWidth <= 360 && layout.insideCard);
  assert.equal(layout.overflow, false, "The map must not overflow the page");
  const link = page.locator('.location-panel a[href^="https://www.google.com/maps/place/"]');
  assert.equal(await link.count(), 1);
  assert.equal(await link.isVisible(), true);
  assert.match(await link.getAttribute("href"), /!1s0x3e5f4289acafffff:0x24b5e31e153b624e!8m2!3d24\.9751353!4d55\.1866505/);
  assert.equal(await link.getAttribute("target"), "_blank");
  assert.match(await link.getAttribute("rel"), /\b(?:noopener|noreferrer)\b/);
  return { viewport: page.viewportSize(), ...layout, mapRequests: intercepted.mapRequests.length };
}

function assertNoUnexpectedRequests(intercepted) {
  assert.deepEqual(intercepted.unexpectedPosts, [], "No legacy contact API or unexpected destination may receive a POST");
  assert.deepEqual(intercepted.unexpectedProviderRequests, [], "The contact embed must not load old CRM analytics or other provider resources in the parent document");
}

async function assertEmbed(page) {
  const iframe = page.locator(FRAME_SELECTOR);
  assert.equal(await iframe.count(), 1);
  assert.equal(await iframe.getAttribute("title"), "AcRepair contact us");
  assert.equal(await iframe.getAttribute("aria-label"), "AcRepair contact us");
  assert.equal(await iframe.getAttribute("frameborder"), "0");
  assert.deepEqual(await iframe.evaluate((element) => ({ height: element.style.height, width: element.style.width, border: element.style.borderStyle, computedBorder: getComputedStyle(element).borderWidth })),
    { height: "1100px", width: "99%", border: "none", computedBorder: "0px" });
  assert.notEqual(await iframe.getAttribute("scrolling"), "no", "Do not clip the provider content if height reporting is unavailable");
  await page.frameLocator(FRAME_SELECTOR).getByText(FRAME_MARKER, { exact: true }).waitFor();
  assert.equal(await page.locator(".contact-form-section form").count(), 0, "The old custom CRM form must be replaced");
  assert.equal(await page.locator('script[src*="WebFormAnalyticsServeServlet"]').count(), 0, "The old CRM analytics script must be removed");
  assert.equal(await page.locator(".contact-form-section h2").textContent(), "Send an enquiry");
  assert.equal(await page.locator(".contact-form-section > p").first().textContent(), "Tell us about your air conditioning needs.");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "The embed must not overflow the page");
  return new URL(await iframe.getAttribute("src"));
}

async function checkZohoContactAutoHeight(page) {
  const iframe = page.locator(FRAME_SELECTOR);
  const child = await (await iframe.elementHandle()).contentFrame();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const send = data => child.evaluate(({ data, origin }) => parent.postMessage(data, origin), { data, origin: new URL(page.url()).origin });
  const expectHeight = height => page.waitForFunction(({ selector, height }) => document.querySelector(selector).style.height === `${height}px`, { selector: FRAME_SELECTOR, height });

  await settle();
  await send(`${FORM_PERMALINK}|946.25`);
  await expectHeight(967);
  await send(`${FORM_PERMALINK}|1450.5`);
  await expectHeight(1471);
  await send(`${FORM_PERMALINK}|800`);
  await expectHeight(820);

  const ignored = [
    null, { height: 1500 }, "", "another-form|1500", FORM_PERMALINK,
    `${FORM_PERMALINK}|0`, `${FORM_PERMALINK}|-10`, `${FORM_PERMALINK}|NaN`,
    `${FORM_PERMALINK}|Infinity`, `${FORM_PERMALINK}|20001`, `${FORM_PERMALINK}|1200px`,
    `${FORM_PERMALINK}|1200|unexpected`, `${FORM_PERMALINK}|1200|scroll|extra`,
  ];
  for (const data of ignored) await send(data);
  // Vary origin and source independently; neither a lookalike provider origin
  // nor another window with the correct origin may resize this specific frame.
  await page.evaluate(({ selector, data }) => {
    const source = document.querySelector(selector).contentWindow;
    window.dispatchEvent(new MessageEvent("message", { origin: "https://forms.zohopublic.com.attacker.invalid", source, data }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://forms.zohopublic.com", source: window, data }));
  }, { selector: FRAME_SELECTOR, data: `${FORM_PERMALINK}|1500` });
  await settle();
  assert.equal(await iframe.evaluate(element => element.style.height), "820px", "Untrusted or malformed messages must not resize the iframe");

  await send(`${FORM_PERMALINK}|1500`);
  await expectHeight(1520);
  await page.evaluate(() => window.scrollTo(0, 100));
  const beforeScroll = await page.evaluate(() => scrollY);
  await send(`${FORM_PERMALINK}|1510|scroll`);
  await expectHeight(1530);
  assert.equal(await page.evaluate(() => scrollY), beforeScroll, "A provider resize must not unexpectedly scroll the parent page");
  await send(`${FORM_PERMALINK}|1080`);
  await expectHeight(1100);
  return { trustedResizeMessages: 6, ignoredMessages: ignored.length + 2, parentScrollPreserved: true };
}

export async function checkZohoContact(page, base, intercepted) {
  const initialRequests = intercepted.frameRequests.length;
  const contactUrl = new URL("/contact-us/?source=local-embed-check#contact", base).href;
  await page.goto(contactUrl, { waitUntil: "load" });
  const src = await assertEmbed(page);
  assert.equal(src.origin + src.pathname, ZOHO_CONTACT_URL);
  assert.deepEqual([...src.searchParams], [["zf_rszfm", "1"]], "Enable provider height reports while omitting non-public loopback referrers");
  assert(intercepted.frameRequests.length > initialRequests, "The iframe must load through the page's real CSP");
  const resize = await checkZohoContactAutoHeight(page);
  assertNoUnexpectedRequests(intercepted);
  return { frameRequests: intercepted.frameRequests.length - initialRequests, resize, submissions: 0, liveProviderRequests: 0 };
}

async function isolateProviderTraffic(context, base, websiteOrigin) {
  const unexpectedRequests = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.href === GTM_SCRIPT) return route.fulfill({ contentType: "application/javascript", body: "/* Local GTM fixture: no tracking. */" });
    if (url.href === GTM_FRAME) return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" });
    if (websiteOrigin && url.origin === websiteOrigin) {
      // Exercise the real hydrated component at a public-looking URL while all
      // document/asset requests are fetched exclusively from the local server.
      const localUrl = new URL(url.pathname + url.search, base);
      const response = await route.fetch({ url: localUrl.href, maxRedirects: 0 });
      return route.fulfill({ response });
    }
    if (url.origin === new URL(base).origin) return route.continue();
    unexpectedRequests.push(url.href);
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    unexpectedRequests.push(socket.url());
    socket.close();
  });
  return unexpectedRequests;
}

export async function checkZohoContactReferrer(browser, base) {
  const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const origin = "https://contact-referrer.example";
  try {
    const unexpectedRequests = await isolateProviderTraffic(context, base, origin);
    const intercepted = await interceptZohoContact(context, base);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const cases = [
      { name: "public URL with encoded query and fragment", path: "/contact-us/?campaign=AC%20%26%20ventilation#enquiry" },
      { name: "oversized query is removed", path: `/contact-us/?campaign=${"x".repeat(1900)}`, expected: `${origin}/contact-us/` },
      { name: "oversized URL without query is capped", path: `/contact-us/#${"x".repeat(1900)}`, expected: `${origin}/contact-us/#${"x".repeat(1900)}`.slice(0, 1800) },
    ];
    for (const test of cases) {
      const url = new URL(test.path, origin).href;
      const expected = test.expected || url;
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(({ selector, referrer }) => new URL(document.querySelector(selector).src).searchParams.get("referrername") === referrer,
        { selector: FRAME_SELECTOR, referrer: expected });
      const src = await assertEmbed(page);
      assert.equal(src.origin + src.pathname, ZOHO_CONTACT_URL);
      assert.deepEqual([...src.searchParams], [["zf_rszfm", "1"], ["referrername", expected]], `${test.name}: provider resizing and exactly one encoded referrer parameter`);
    }
    assert.deepEqual(errors, [], "No hydration or runtime errors during referrer updates");
    assert.deepEqual(unexpectedRequests, [], "No external website, tracking or WebSocket requests");
    assertNoUnexpectedRequests(intercepted);
    return { cases: cases.map(({ name }) => name), submissions: 0, liveProviderRequests: 0 };
  } finally { await context.close(); }
}

export async function checkZohoContactWithoutJavaScript(browser, base) {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce", serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const unexpectedRequests = await isolateProviderTraffic(context, base);
    const intercepted = await interceptZohoContact(context, base);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(new URL("/contact-us/", base).href, { waitUntil: "load" });
    const src = await assertEmbed(page);
    assert.equal(src.href, ZOHO_CONTACT_EMBED_URL, "The embed URL must be present in server HTML without JavaScript");
    const fallback = page.locator(".contact-form-section noscript");
    assert.equal(await fallback.isVisible(), true);
    assert.equal(await fallback.locator('a[href^="tel:"]').count(), 1);
    assert.equal(await fallback.locator('a[href^="mailto:"]').count(), 1);
    assert.deepEqual(intercepted.frameRequests, [ZOHO_CONTACT_EMBED_URL]);
    assert.deepEqual(unexpectedRequests, [], "No nonlocal traffic with JavaScript disabled");
    assertNoUnexpectedRequests(intercepted);
    return { frameRequests: 1, submissions: 0, liveProviderRequests: 0, fallback: "Call or email" };
  } finally { await context.close(); }
}

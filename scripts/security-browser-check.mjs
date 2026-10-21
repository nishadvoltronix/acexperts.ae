import { access, readFile } from "node:fs/promises";
import { load } from "cheerio";
import { chromium } from "playwright";
import { ZOHO_CONTACT_ORIGIN, interceptZohoContact, checkZohoContact } from "./helpers/zoho-contact-check.mjs";

// Production checks only: run against a local `next start` instance.
// Requests remain local; CRM submissions and analytics are fulfilled in-browser.
const base = new URL(process.env.BASE_URL || "http://localhost:3100");
const routes = ["/", "/contact-us/", "/about/", "/faq/"];
const gtmOrigin = "https://www.googletagmanager.com";
const gtmScript = `${gtmOrigin}/gtm.js?id=GTM-K9HW63CV`;
const gtmFrame = `${gtmOrigin}/ns.html?id=GTM-K9HW63CV`;
let phase = "local target validation";
class CheckFailure extends Error {}
function check(condition, message) {
  if (!condition) throw new CheckFailure(message);
}
const normalize = (text) => text.replace(/\s+/g, " ").trim();

function securityHeaders(headers, label) {
  check(headers.get("x-content-type-options") === "nosniff", `${label}: nosniff missing`);
  check(headers.get("x-frame-options") === "DENY", `${label}: frame protection missing`);
  check(headers.get("referrer-policy") === "strict-origin-when-cross-origin", `${label}: referrer policy missing`);
  check(/max-age=31536000(?:;|$)/.test(headers.get("strict-transport-security") || ""), `${label}: production HSTS missing`);
  for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
    check((headers.get("permissions-policy") || "").includes(`${feature}=()`), `${label}: ${feature} restriction missing`);
  }
  check(!headers.has("x-powered-by"), `${label}: framework header exposed`);
}

function documentPolicy(headers, label) {
  securityHeaders(headers, label);
  const policy = headers.get("content-security-policy") || "";
  const directives = new Map(policy.split(";").map((entry) => {
    const [name, ...values] = entry.trim().split(/\s+/);
    return [name, values];
  }));
  const scripts = directives.get("script-src") || [];
  const nonces = scripts.filter((value) => /^'nonce-[A-Za-z\d+/=_-]+'$/.test(value));
  check(nonces.length === 1, `${label}: expected one script nonce`);
  check(!scripts.includes("'unsafe-inline'") && !scripts.includes("'unsafe-eval'"), `${label}: unsafe production scripts allowed`);
  check(scripts.includes("'strict-dynamic'"), `${label}: strict-dynamic missing`);
  for (const name of ["script-src-attr", "object-src", "frame-ancestors", "base-uri"]) {
    check(directives.get(name)?.join(" ") === "'none'", `${label}: ${name} must deny content`);
  }
  check(directives.get("frame-src")?.slice().sort().join(" ") === ["https://*.zohopublic.com", gtmOrigin].sort().join(" "),
    `${label}: frames must be limited to Zoho and Google Tag Manager`);
  for (const name of ["script-src-elem", "img-src", "connect-src"]) {
    check(directives.get(name)?.some((value) => [gtmOrigin, "https://*.googletagmanager.com"].includes(value)),
      `${label}: ${name} must allow Google Tag Manager`);
  }
  check(directives.get("form-action")?.join(" ") === `'self' ${ZOHO_CONTACT_ORIGIN}`, `${label}: form destinations must be limited to self and Zoho CRM`);
  check(directives.get("connect-src")?.includes(ZOHO_CONTACT_ORIGIN), `${label}: Zoho CRM AJAX submission must be allowed`);
  const cache = headers.get("cache-control") || "";
  check(/\bprivate\b/.test(cache) && /\bno-store\b/.test(cache), `${label}: nonce HTML may be cached`);
  return nonces[0].slice(7, -1);
}

async function executable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const path of [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ]) {
    try {
      await access(path);
      return path;
    } catch {
      // Let Playwright select its installed browser if neither is available.
    }
  }
}

async function main() {
  check(
    ["http:", "https:"].includes(base.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
      !base.username && !base.password && base.pathname === "/" && !base.search && !base.hash,
    "BASE_URL must be a loopback HTTP(S) origin without credentials, a path, query or fragment",
  );
  const input = JSON.parse(await readFile(new URL("../data/pages.json", import.meta.url), "utf8"));
  const pages = Array.isArray(input) ? input : input.pages;
  const seenNonces = new Set();
  for (const path of [...routes, "/"]) {
    phase = `HTTP ${path}`;
    const spoof = seenNonces.size === routes.length;
    const suppliedNonce = "attacker-controlled-nonce";
    const response = await fetch(new URL(path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: spoof ? {
        "x-nonce": suppliedNonce,
        "Content-Security-Policy": `script-src 'nonce-${suppliedNonce}'`,
      } : undefined,
    });
    check(response.status === 200, `${phase}: expected 200 without redirects`);
    const nonce = documentPolicy(response.headers, path);
    check(!seenNonces.has(nonce), `${path}: response nonce reused`);
    check(nonce !== suppliedNonce, `${path}: client controlled the nonce`);
    seenNonces.add(nonce);
    const html = await response.text();
    const $ = load(html);
    const expected = pages.find((entry) => entry.route === path);
    check(!!expected, `${path}: metadata baseline missing`);
    check(normalize($("title").text()) === normalize(expected.title), `${path}: title changed`);
    check($("link[rel=canonical]").attr("href") === expected.canonical, `${path}: canonical changed`);
    check($("meta[name=description]").attr("content") === expected.description, `${path}: description changed`);
    check($("h1").length === 1 && normalize($("h1").text()) === normalize(expected.h1), `${path}: H1 changed`);
    const scripts = $("script").toArray();
    check(scripts.length > 0, `${path}: framework scripts missing`);
    check(scripts.every((script) => $(script).attr("nonce") === nonce), `${path}: script nonce mismatch`);
    const bootstrap = $("script#google-tag-manager");
    check(bootstrap.length === 1 && bootstrap.parent().is("head"), `${path}: expected one GTM bootstrap in head`);
    check(bootstrap.text().includes("GTM-K9HW63CV"), `${path}: incorrect GTM container`);
    const noScriptDom = load(html, { scriptingEnabled: false });
    const fallback = noScriptDom(`noscript:has(iframe[src="${gtmFrame}"])`);
    check(fallback.length === 1 && fallback.parent().is("body"), `${path}: expected one GTM noscript in body`);
    check(fallback.prevAll().toArray().every((node) => {
      // React may insert an empty hidden div for its streaming boundary.
      const element = noScriptDom(node);
      return element.is("div[hidden]") && !element.children().length && !element.text().trim();
    }), `${path}: GTM noscript must be the first authored body element`);
    const frame = fallback.children("iframe");
    check(frame.length === 1 && frame.attr("height") === "0" && frame.attr("width") === "0" &&
      /display\s*:\s*none/.test(frame.attr("style") || "") && /visibility\s*:\s*hidden/.test(frame.attr("style") || ""),
    `${path}: GTM fallback must remain hidden`);
    const structured = $('script[type="application/ld+json"]').toArray();
    check(structured.length >= 2, `${path}: structured data missing`);
    for (const script of structured) {
      const schema = JSON.parse($(script).text());
      check(schema["@context"] === "https://schema.org", `${path}: structured data invalid`);
    }
  }
  console.log("PASS HTTP: security headers, fresh trusted nonces, GTM placement and SEO on four routes");

  phase = "browser launch";
  const browser = await chromium.launch({ executablePath: await executable(), headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    let externalRequests = 0;
    let gtmRequests = 0;
    await context.route("**/*", async (route) => {
      if (route.request().url() === gtmScript && route.request().method() === "GET") {
        gtmRequests++;
        return route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "window.__securityGtmLoads = (window.__securityGtmLoads || 0) + 1;",
        });
      }
      const url = new URL(route.request().url());
      if (url.origin !== base.origin) {
        externalRequests++;
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    await context.routeWebSocket("**/*", (socket) => {
      externalRequests++;
      socket.close();
    });
    const zohoContact = await interceptZohoContact(context, base);
    await context.addInitScript(() => {
      globalThis.__securityViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        globalThis.__securityViolations.push(event.effectiveDirective);
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let consoleErrors = 0;
    let pageErrors = 0;
    let failedResponses = 0;
    page.on("pageerror", () => { pageErrors++; });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      consoleErrors++;
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      failedResponses++;
    });
    async function cleanBrowser(label) {
      check(await page.evaluate(() => globalThis.__securityViolations.length === 0), `${label}: unexpected CSP violation`);
      check(!consoleErrors && !pageErrors && !failedResponses, `${label}: browser errors (console=${consoleErrors}, page=${pageErrors}, HTTP=${failedResponses})`);
      check(!externalRequests, `${label}: attempted nonlocal request or WebSocket`);
      const gtm = await page.evaluate((src) => {
        const bootstrap = document.getElementById("google-tag-manager");
        const injected = [...document.scripts].filter((script) => script.src === src);
        return {
          loads: globalThis.__securityGtmLoads,
          starts: globalThis.dataLayer?.filter((entry) => entry.event === "gtm.js" && typeof entry["gtm.start"] === "number").length,
          scripts: injected.length,
          nonceMatches: !!bootstrap?.nonce && injected[0]?.nonce === bootstrap.nonce,
        };
      }, gtmScript);
      check(gtm.loads === 1 && gtm.starts === 1 && gtm.scripts === 1 && gtm.nonceMatches,
        `${label}: GTM must initialize once and pass its CSP nonce to the loaded script`);
    }
    for (const path of routes) {
      phase = `browser ${path}`;
      const previousGtmRequests = gtmRequests;
      const response = await page.goto(new URL(path, base).href, { waitUntil: "load" });
      check(response?.status() === 200, `${phase}: page unavailable`);
      await cleanBrowser(phase);
      check(gtmRequests === previousGtmRequests + 1, `${phase}: expected one GTM script request per document`);
    }

    phase = "mobile navigation";
    const gtmRequestsBeforeNavigation = gtmRequests;
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    check(await nav.isVisible(), "mobile menu did not open after hydration");
    await nav.getByRole("link", { name: "Contact", exact: true }).click();
    await page.waitForURL(new URL("/contact-us/", base).href);
    await page.locator(".contact-form").waitFor();
    check(await page.getByRole("button", { name: "Menu", exact: true }).getAttribute("aria-expanded") === "false", "mobile menu did not close after navigation");
    await cleanBrowser(phase);
    check(gtmRequests === gtmRequestsBeforeNavigation, "client navigation must not reload GTM");
    console.log("PASS browser: hydration, CSP, GTM initialization and mobile navigation on four routes");

    phase = "GTM fallback without JavaScript";
    const noScriptContext = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    try {
      let fallbackRequests = 0;
      let unexpectedRequests = 0;
      await noScriptContext.route("**/*", async (route) => {
        if (route.request().url() === gtmFrame && route.request().method() === "GET") {
          fallbackRequests++;
          return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body></body></html>" });
        }
        if (new URL(route.request().url()).origin !== base.origin) {
          unexpectedRequests++;
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      const noScriptPage = await noScriptContext.newPage();
      const response = await noScriptPage.goto(base.href, { waitUntil: "load" });
      check(response?.status() === 200, "JavaScript-disabled document unavailable");
      check(await noScriptPage.locator(`body > noscript > iframe[src="${gtmFrame}"]`).count() === 1,
        "GTM iframe missing when JavaScript is disabled");
      check(fallbackRequests === 1 && unexpectedRequests === 0, "GTM fallback must load once under CSP without external traffic");
      console.log("PASS GTM fallback: JavaScript-disabled iframe allowed by CSP; request intercepted without tracking");
    } finally {
      await noScriptContext.close();
    }

    phase = "synthetic intercepted Zoho contact submission";
    await checkZohoContact(page, base, zohoContact);
    await cleanBrowser(phase);
    console.log("PASS form: validation, exact CRM multipart payloads, acceptance and duplicate guard; requests intercepted without delivery");

    // Intentional violations use a separate document, outside normal browser checks.
    phase = "deliberate CSP injection probes";
    const probe = await context.newPage();
    probe.setDefaultTimeout(15000);
    await probe.route(base.href, async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      const policy = response.headers()["content-security-policy"] || "";
      const nonce = /'nonce-([A-Za-z\d+/=_-]+)'/.exec(policy)?.[1] || "";
      const html = await response.text();
      // Inject as parser-inserted HTML. DevTools evaluate is a privileged context
      // and cannot faithfully test whether an injected inline script executes.
      const body = html
        .replace("</head>", `<script nonce="${nonce}">globalThis.__securityAllowedProbe = true</script><script>globalThis.__securityInlineProbe = true</script></head>`)
        .replace("</body>", '<button hidden type="button" id="security-click-probe" onclick="globalThis.__securityClickProbe = true">Probe</button></body>');
      await route.fulfill({ response, body });
    });
    await probe.goto(base.href, { waitUntil: "load" });
    await probe.evaluate(() => {
      document.getElementById("security-click-probe").click();
    });
    await probe.waitForFunction(() => globalThis.__securityViolations.includes("script-src-elem") && globalThis.__securityViolations.includes("script-src-attr"));
    check(await probe.evaluate(() => globalThis.__securityAllowedProbe === true && !globalThis.__securityInlineProbe && !globalThis.__securityClickProbe), "CSP did not enforce nonce-only script execution");
    check(!externalRequests, "probe attempted a nonlocal request");
    console.log("PASS CSP: authorized nonce works; injected inline script and onclick are blocked");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  // Do not print response bodies, browser console contents or form values.
  console.error(`FAIL ${phase}: ${error instanceof CheckFailure ? error.message : error.name}`);
  process.exitCode = 1;
});

import { access, readFile } from "node:fs/promises";
import { load } from "cheerio";
import { chromium } from "playwright";

// Production checks only: run against a local `next start` instance.
// Requests and redirects are restricted to this origin; form values are synthetic.
const base = new URL(process.env.BASE_URL || "http://localhost:3100");
const routes = ["/", "/contact-us/", "/about/", "/faq/"];
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
  for (const name of ["script-src-attr", "object-src", "frame-src", "frame-ancestors", "base-uri"]) {
    check(directives.get(name)?.join(" ") === "'none'", `${label}: ${name} must deny content`);
  }
  check(directives.get("form-action")?.join(" ") === "'self'", `${label}: form destination unrestricted`);
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
    const $ = load(await response.text());
    const expected = pages.find((entry) => entry.route === path);
    check(!!expected, `${path}: metadata baseline missing`);
    check(normalize($("title").text()) === normalize(expected.title), `${path}: title changed`);
    check($("link[rel=canonical]").attr("href") === expected.canonical, `${path}: canonical changed`);
    check($("meta[name=description]").attr("content") === expected.description, `${path}: description changed`);
    check($("h1").length === 1 && normalize($("h1").text()) === normalize(expected.h1), `${path}: H1 changed`);
    const scripts = $("script").toArray();
    check(scripts.length > 0, `${path}: framework scripts missing`);
    check(scripts.every((script) => $(script).attr("nonce") === nonce), `${path}: script nonce mismatch`);
    const structured = $('script[type="application/ld+json"]').toArray();
    check(structured.length >= 2, `${path}: structured data missing`);
    for (const script of structured) {
      const schema = JSON.parse($(script).text());
      check(schema["@context"] === "https://schema.org", `${path}: structured data invalid`);
    }
  }
  console.log("PASS HTTP: security headers, fresh trusted nonces and SEO on four routes");

  phase = "browser launch";
  const browser = await chromium.launch({ executablePath: await executable(), headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    let externalRequests = 0;
    await context.route("**/*", async (route) => {
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
    let expectedUnavailable = false;
    const contactUrl = new URL("/api/contact/", base).href;
    page.on("pageerror", () => { pageErrors++; });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (expectedUnavailable && message.location().url === contactUrl && /503/.test(message.text())) return;
      consoleErrors++;
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      if (expectedUnavailable && response.url() === contactUrl && response.status() === 503) return;
      failedResponses++;
    });
    async function cleanBrowser(label) {
      check(await page.evaluate(() => globalThis.__securityViolations.length === 0), `${label}: unexpected CSP violation`);
      check(!consoleErrors && !pageErrors && !failedResponses, `${label}: browser errors (console=${consoleErrors}, page=${pageErrors}, HTTP=${failedResponses})`);
      check(!externalRequests, `${label}: attempted nonlocal request or WebSocket`);
    }
    for (const path of routes) {
      phase = `browser ${path}`;
      const response = await page.goto(new URL(path, base).href, { waitUntil: "load" });
      check(response?.status() === 200, `${phase}: page unavailable`);
      await cleanBrowser(phase);
    }

    phase = "mobile navigation";
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    check(await nav.isVisible(), "mobile menu did not open after hydration");
    await nav.getByRole("link", { name: "Contact Us", exact: true }).click();
    await page.waitForURL(new URL("/contact-us/", base).href);
    await page.locator(".contact-form").waitFor();
    check(await page.getByRole("button", { name: "Menu", exact: true }).getAttribute("aria-expanded") === "false", "mobile menu did not close after navigation");
    await cleanBrowser(phase);
    console.log("PASS browser: hydration, CSP and mobile navigation on four routes");

    phase = "synthetic local contact submission";
    const form = page.locator(".contact-form");
    await form.locator('[name="firstName"]').fill("Security check");
    await form.locator('[name="email"]').fill("security-check@example.invalid");
    await form.locator('[name="mobile"]').fill("+12025550100");
    await form.locator('[name="service"]').selectOption("Other");
    const other = form.locator('[name="otherService"]');
    check(await other.isVisible() && await other.getAttribute("required") !== null, "Other service did not reveal a required detail field");
    await other.fill("Synthetic local security verification");
    await form.locator('[name="message"]').fill("Synthetic local check; no delivery or storage is expected.");
    expectedUnavailable = true;
    const [response] = await Promise.all([
      page.waitForResponse((result) => result.url() === contactUrl && result.request().method() === "POST"),
      form.getByRole("button", { name: "Submit", exact: true }).click(),
    ]);
    check(response.status() === 503, "contact endpoint changed its disabled-delivery behavior");
    const body = await response.json();
    check(typeof body.message === "string" && /not been sent/i.test(body.message), "contact response did not explain that the message was unsent");
    await form.getByRole("status").filter({ hasText: body.message }).waitFor();
    securityHeaders(new Headers(await response.allHeaders()), "contact API");
    check(/\bno-store\b/.test((await response.headerValue("cache-control")) || ""), "contact response may be cached");
    await cleanBrowser(phase);
    expectedUnavailable = false;
    console.log("PASS form: Other interaction and synthetic local submission remain explicitly unsent (503)");

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

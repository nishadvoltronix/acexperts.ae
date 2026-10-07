import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { writeMigrationReport } from "./validate.mjs";

const base = new URL(process.env.BASE_URL || "http://localhost:3001");
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const result = {
  checkedAt: new Date().toISOString(),
  baseUrl: base.href,
  widths,
  cases: [],
  accessibility: [],
  interactions: [],
  externalRequests: [],
  failures: [],
};
const fail = (kind, path, detail) => {
  result.failures.push({ kind, path, detail });
  console.error(`FAIL ${kind}: ${path} ${JSON.stringify(detail)}`);
};
const recordInteraction = (name, ok, detail = "") => {
  result.interactions.push({ name, ok, detail });
  if (!ok) fail("interaction", name, detail);
};
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
      /* Try the next installed browser. */
    }
  }
  return undefined;
}
async function scrollAndDecode(page) {
  await page.evaluate(async () => {
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += Math.max(innerHeight * 0.8, 400)
    ) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    // Hidden carousel slides may retain lazy images forever. Force a local asset
    // health check after exercising normal scrolling, and bound decode waits.
    [...document.images].forEach((image) => { image.loading = "eager"; });
    await Promise.race([
      Promise.all([...document.images].map((image) => image.decode().catch(() => null))),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
    scrollTo(0, 0);
  });
}
async function main() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
    throw new Error(
      "BASE_URL must point to a loopback host; browser tests never submit to the public site.",
    );
  const input = JSON.parse(await readFile("data/pages.json", "utf8"));
  const pages = Array.isArray(input) ? input : input.pages;
  const identityResponse = await fetch(base, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const identityHtml = await identityResponse.text();
  const expectedTitle = pages.find((page) => page.route === "/")?.title;
  const titleText = identityHtml
    .match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    ?.replaceAll("&amp;", "&");
  if (identityResponse.status !== 200 || titleText !== expectedTitle)
    throw new Error(
      `Refusing browser/form checks: ${base.origin} does not identify as the migrated AC Experts site. Check BASE_URL.`,
    );
  const candidates = [
    ["about", "/about/"],
    ["home", "/"],
    ["service", "/ac-installation-service/"],
    ["projects", "/projects/"],
    ["project", "/project-portfolio/luxury-villa-ac-installation/"],
    ["article", pages.find((page) => page.type === "article")?.route],
    ["blog", "/blog/"],
    ["faq", "/faq/"],
    ["products", "/products/"],
    ["contact", "/contact-us/"],
  ].filter(([, route]) => route);
  await mkdir("docs/screenshots/local", { recursive: true });
  const browser = await chromium.launch({
    executablePath: await executable(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== base.origin
    ) {
      if (!result.externalRequests.includes(url.href))
        result.externalRequests.push(url.href);
      if (["acexperts.ae", "www.acexperts.ae"].includes(url.hostname))
        fail(
          "old-site-dependency",
          route.request().url(),
          "Browser attempted to load the original site",
        );
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = await context.newPage();
  let currentCase = null;
  let expectedApiFailure = false;
  page.on("pageerror", (error) => {
    if (currentCase) currentCase.jsErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      currentCase &&
      !(expectedApiFailure && /503|Service Unavailable/.test(message.text()))
    )
      currentCase.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (
      currentCase &&
      response.status() >= 400 &&
      response.url().startsWith(base.origin) &&
      !(expectedApiFailure && response.url().includes("/api/contact/"))
    )
      currentCase.failedResponses.push({
        url: response.url(),
        status: response.status(),
      });
  });
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [type, path] of candidates) {
        currentCase = {
          type,
          path,
          width,
          jsErrors: [],
          consoleErrors: [],
          failedResponses: [],
        };
        try {
          const response = await page.goto(new URL(path, base).href, {
            waitUntil: "load",
            timeout: 60000,
          });
          currentCase.status = response?.status();
          currentCase.fontsLoaded = await page.evaluate(() => Promise.race([
            document.fonts.ready.then(() => true),
            new Promise((resolve) => setTimeout(() => resolve(false), 8000)),
          ]));
          await scrollAndDecode(page);
          Object.assign(
            currentCase,
            await page.evaluate(() => ({
              viewportWidth: innerWidth,
              documentWidth: document.documentElement.scrollWidth,
              overflowingElements: [
                ...document.querySelectorAll("main *,header *,footer *"),
              ]
                .filter((element) => {
                  const rect = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  return (
                    rect.width > 0 &&
                    style.position !== "fixed" &&
                    (rect.right > innerWidth + 1 || rect.left < -1) &&
                    style.visibility !== "hidden" &&
                    style.display !== "none"
                  );
                })
                .slice(0, 12)
                .map((element) => ({
                  tag: element.tagName,
                  class: element.className,
                  text: element.textContent?.slice(0, 80),
                  right: element.getBoundingClientRect().right,
                })),
              missingImages: [...document.images]
                .filter((image) => !image.complete || !image.naturalWidth)
                .map((image) => ({
                  src: image.currentSrc || image.src,
                  alt: image.alt,
                })),
            })),
          );
          currentCase.overflow = currentCase.documentWidth > width + 1;
          currentCase.ok =
            currentCase.status === 200 &&
            currentCase.fontsLoaded &&
            !currentCase.overflow &&
            !currentCase.missingImages.length &&
            !currentCase.jsErrors.length &&
            !currentCase.consoleErrors.length &&
            !currentCase.failedResponses.length;
          if (!currentCase.ok)
            fail("viewport", `${path} @ ${width}`, {
              status: currentCase.status,
              overflow: currentCase.overflow,
              overflowingElements: currentCase.overflow
                ? currentCase.overflowingElements
                : [],
              missingImages: currentCase.missingImages,
              jsErrors: currentCase.jsErrors,
              consoleErrors: currentCase.consoleErrors,
              failedResponses: currentCase.failedResponses,
            });
          if (
            width === 1440 ||
            (width === 390 && type === "home") ||
            !currentCase.ok
          ) {
            currentCase.screenshot = `docs/screenshots/local/${type}-${width}.png`;
            await page.screenshot({
              path: currentCase.screenshot,
              fullPage: width === 1440,
              animations: "disabled",
            });
          }
          if (width === 1440 || (width === 390 && ["home", "about"].includes(type))) {
            const scan = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
              .analyze();
            const violations = scan.violations.map((item) => ({
              id: item.id,
              impact: item.impact,
              description: item.description,
              help: item.help,
              helpUrl: item.helpUrl,
              nodes: item.nodes.map((node) => ({
                target: node.target,
                failureSummary: node.failureSummary,
              })),
            }));
            result.accessibility.push({
              path,
              width,
              violations,
              incomplete: scan.incomplete.length,
              incompleteChecks: scan.incomplete.map((item) => ({
                id: item.id,
                help: item.help,
                nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
              })),
              passes: scan.passes.length,
            });
            for (const violation of violations)
              fail("accessibility", `${path} @ ${width}`, violation);
          }
        } catch (error) {
          currentCase.ok = false;
          currentCase.error = String(error);
          fail("browser", `${path} @ ${width}`, String(error));
        }
        result.cases.push(currentCase);
      }
      console.log(`Completed ${width}px (${candidates.length} page types).`);
    }
    currentCase = {
      type: "interaction",
      path: "interactive checks",
      jsErrors: [],
      consoleErrors: [],
      failedResponses: [],
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base.href, { waitUntil: "load" });
    const serviceSummary = page.locator(
      'header summary[aria-label="Service pages"]',
    );
    await serviceSummary.focus();
    await page.keyboard.press("Enter");
    recordInteraction(
      "Desktop services opens with keyboard",
      await serviceSummary.evaluate((element) => element.parentElement.open),
    );
    await page.keyboard.press("Escape");
    recordInteraction(
      "Escape closes desktop services",
      !(await serviceSummary.evaluate((element) => element.parentElement.open)),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base.href, { waitUntil: "load" });
    const menu = page.getByRole("button", { name: /Menu/ });
    await menu.focus();
    await page.keyboard.press("Enter");
    const menuOpened =
      (await page.locator(".menu-toggle").getAttribute("aria-expanded")) ===
      "true";
    recordInteraction("Mobile menu opens with keyboard", menuOpened);
    await page.keyboard.press("Escape");
    recordInteraction(
      "Escape closes mobile menu and restores focus",
      await page
        .locator(".menu-toggle")
        .evaluate(
          (element) =>
            element.getAttribute("aria-expanded") === "false" &&
            document.activeElement === element,
        ),
    );
    await menu.click();
    const about = page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "About", exact: true });
    await about.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/about/");
    recordInteraction(
      "Mobile navigation follows local link and closes",
      (await page.locator(".menu-toggle").getAttribute("aria-expanded")) ===
        "false" && new URL(page.url()).origin === base.origin,
    );
    await page.goto(new URL("/faq/", base).href, { waitUntil: "load" });
    const faq = page.locator("main details").first();
    const summary = faq.locator("summary");
    const initialOpen = await faq.evaluate((element) => element.open);
    await summary.focus();
    await page.keyboard.press("Enter");
    recordInteraction(
      "FAQ toggles with keyboard",
      (await faq.evaluate((element) => element.open)) !== initialOpen,
    );
    await page.keyboard.press("Enter");
    recordInteraction(
      "FAQ closes/restores on second keyboard action",
      (await faq.evaluate((element) => element.open)) === initialOpen,
    );
    await page.goto(new URL("/contact-us/", base).href, {
      waitUntil: "load",
    });
    const form = page.locator("main form");
    let posts = 0;
    const countPosts = (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/contact/"
      )
        posts++;
    };
    page.on("request", countPosts);
    await form.getByRole("button", { name: "Submit", exact: true }).click();
    recordInteraction(
      "Empty form is blocked by native validation",
      (await form.evaluate((element) => !element.checkValidity())) &&
        posts === 0,
    );
    await form.locator('[name="firstName"]').fill("Local validation");
    await form
      .locator('[name="email"]')
      .fill("local-validation@example.invalid");
    await form.locator('[name="mobile"]').fill("+971500000000");
    await form.locator('[name="service"]').selectOption({ label: "Repairs" });
    await form
      .locator('[name="message"]')
      .fill("Synthetic local validation. No delivery is expected.");
    expectedApiFailure = true;
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).origin === base.origin &&
        new URL(response.url()).pathname === "/api/contact/" &&
        response.request().method() === "POST",
    );
    await form.getByRole("button", { name: "Submit", exact: true }).click();
    const response = await responsePromise;
    const body = await response.json();
    await page.getByRole("status").filter({ hasText: body.message }).waitFor();
    recordInteraction(
      "Valid local form returns explicit disabled-backend 503",
      response.status() === 503 &&
        posts === 1 &&
        typeof body.message === "string" &&
        body.message.length > 20,
      { status: response.status(), message: body.message },
    );
    expectedApiFailure = false;
    page.off("request", countPosts);
    if (
      currentCase.jsErrors.length ||
      currentCase.consoleErrors.length ||
      currentCase.failedResponses.length
    )
      fail("interaction-console", "interactive checks", currentCase);
    result.interactionConsole = currentCase;
  } catch (error) {
    fail("interaction-exception", "interactive checks", String(error));
  } finally {
    await browser.close();
  }
  result.summary = {
    viewportCases: result.cases.length,
    expectedViewportCases: widths.length * candidates.length,
    accessibilityScans: result.accessibility.length,
    interactionChecks: result.interactions.length,
    failures: result.failures.length,
    passed:
      !result.failures.length &&
      result.cases.length === widths.length * candidates.length,
  };
  await writeFile(
    "docs/browser-validation-results.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeMigrationReport();
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.summary.passed) {
    console.error(JSON.stringify(result.failures.slice(0, 12), null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

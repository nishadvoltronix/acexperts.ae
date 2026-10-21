import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { interceptZohoContact, checkZohoContact } from "./helpers/zoho-contact-check.mjs";

const base = new URL(process.env.BASE_URL || "http://localhost:3001");
const smoke = process.env.REDESIGN_SMOKE === "1";
const artifactDirectory = process.env.ARTIFACT_DIR;
const screenshotDirectory = artifactDirectory ? join(artifactDirectory, "screenshots", "redesign") : "docs/screenshots/redesign";
const outputPath = process.env.REDESIGN_OUTPUT || join(artifactDirectory || "docs", smoke ? "redesign-browser-smoke.json" : "redesign-browser-validation.json");
const requestedRoutes = process.env.REDESIGN_ROUTES ? new Set(process.env.REDESIGN_ROUTES.startsWith("[") ? JSON.parse(process.env.REDESIGN_ROUTES) : process.env.REDESIGN_ROUTES.split(",").map((route) => route.trim())) : null;
const widths = smoke ? [390, 1440] : [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const result = {
  checkedAt: new Date().toISOString(),
  baseUrl: base.href,
  widths,
  cases: [],
  accessibility: [],
  interactions: [],
  consistency: [],
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
  const representativeRoutes = [
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
  const sampleRoutes = new Set(representativeRoutes.map(([, route]) => route));
  const smokeRoutes = new Set(["/", "/ac-installation-service/", pages.find((entry) => entry.type === "article").route, "/contact-us/"]);
  if (requestedRoutes && [...requestedRoutes].some((route) => !pages.some((entry) => entry.route === route))) throw new Error("REDESIGN_ROUTES contains an unknown public route.");
  const candidates = pages.filter((entry) => (!requestedRoutes || requestedRoutes.has(entry.route)) && (!smoke || smokeRoutes.has(entry.route))).map((entry) => [entry.route === "/" ? "home" : entry.route.split("/").filter(Boolean).join("--"), entry.route]);
  await mkdir(screenshotDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath: await executable(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
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
  const zohoContact = await interceptZohoContact(context, base);
  // Keep this historical UI check safe even when local delivery is configured.
  await context.route("**/api/newsletter/", (route) => route.fulfill({
    status: 503,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    json: { ok: false, message: "Your newsletter request has not been sent or saved. Please try again later." },
  }));
  const page = await context.newPage();
  let currentCase = null;
  let expectedApiFailurePath = null;
  page.on("pageerror", (error) => {
    if (currentCase) currentCase.jsErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      currentCase &&
      !(expectedApiFailurePath && /503|Service Unavailable/.test(message.text()))
    )
      currentCase.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (
      currentCase &&
      response.status() >= 400 &&
      response.url().startsWith(base.origin) &&
      !(response.status() === 503 && new URL(response.url()).pathname === expectedApiFailurePath)
    )
      currentCase.failedResponses.push({
        url: response.url(),
        status: response.status(),
      });
  });
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      let sharedDesign = null;
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
              design: {
                header: [...document.querySelectorAll("header.site-header a")].map((element) => [element.getAttribute("href"), element.textContent.trim()]),
                footer: [...document.querySelectorAll("footer.site-footer a")].map((element) => [element.getAttribute("href"), element.textContent.trim()]),
                headerLogo: document.querySelector("header.site-header img")?.getAttribute("src"),
                footerLogo: document.querySelector("footer.site-footer img")?.getAttribute("src"),
                bodyFont: getComputedStyle(document.body).fontFamily,
                headingFont: getComputedStyle(document.querySelector("h1")).fontFamily,
                primary: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
                background: getComputedStyle(document.body).backgroundColor,
                text: getComputedStyle(document.body).color,
              },
              performance: {
                domContentLoadedMs: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd,
                loadMs: performance.getEntriesByType("navigation")[0]?.loadEventEnd,
                jsResources: performance.getEntriesByType("resource").filter((entry) => /\.js(?:\?|$)/.test(entry.name)).length,
                imageResources: performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "img").length,
              },
            })),
          );
          sharedDesign ||= currentCase.design;
          const consistent = JSON.stringify(sharedDesign) === JSON.stringify(currentCase.design);
          result.consistency.push({ path, width, ok: consistent });
          if (!consistent) fail("global-design-consistency", `${path} @ ${width}`, { expected: sharedDesign, actual: currentCase.design });
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
            currentCase.screenshot = join(screenshotDirectory, `${type}-${width}.png`);
            await page.screenshot({
              path: currentCase.screenshot,
              fullPage: width === 1440,
              animations: "disabled",
            });
          }
          if (width === 1440 || (width === 390 && sampleRoutes.has(path))) {
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
      console.log(`Completed ${width}px (${candidates.length} public routes).`);
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
    const testimonials = page.getByRole("region", { name: "Client testimonials" });
    const dots = testimonials.getByRole("group", { name: "Choose testimonial" }).getByRole("button");
    await testimonials.getByRole("button", { name: "Next testimonials" }).click();
    recordInteraction("Next testimonial updates selected dot", (await dots.nth(1).getAttribute("aria-pressed")) === "true");
    await testimonials.getByRole("button", { name: "Previous testimonials" }).click();
    recordInteraction("Previous testimonial restores selected dot", (await dots.nth(0).getAttribute("aria-pressed")) === "true");
    const newsletter = page.locator("footer .newsletter-form");
    const newsletterConsent = newsletter.getByRole("checkbox");
    recordInteraction("Newsletter consent starts unchecked and is required", !(await newsletterConsent.isChecked()) && (await newsletterConsent.getAttribute("required")) !== null);
    let newsletterApiRequests = 0;
    const countNewsletterRequests = (request) => {
      if (request.method() === "POST" || new URL(request.url()).pathname.startsWith("/api/")) newsletterApiRequests++;
    };
    page.on("request", countNewsletterRequests);
    await newsletter.getByRole("textbox", { name: "Your email address" }).fill("invalid-email");
    await newsletter.getByRole("button", { name: "Subscribe to newsletter" }).click();
    recordInteraction("Invalid newsletter email is blocked by native validation", await newsletter.evaluate((element) => !element.checkValidity()) && newsletterApiRequests === 0 && !(await newsletter.getByRole("status").textContent()).trim());
    await newsletter.getByRole("textbox", { name: "Your email address" }).fill("local-validation@example.invalid");
    await newsletter.getByRole("button", { name: "Subscribe to newsletter" }).click();
    recordInteraction("Missing newsletter consent blocks submission without API requests", await newsletter.evaluate((element) => !element.checkValidity()) && newsletterApiRequests === 0 && !(await newsletter.getByRole("status").textContent()).trim());
    await newsletterConsent.check();
    expectedApiFailurePath = "/api/newsletter/";
    const newsletterResponsePromise = page.waitForResponse((response) => new URL(response.url()).origin === base.origin && new URL(response.url()).pathname === "/api/newsletter/" && response.request().method() === "POST");
    await newsletter.getByRole("button", { name: "Subscribe to newsletter" }).click();
    const newsletterResponse = await newsletterResponsePromise;
    const newsletterBody = await newsletterResponse.json();
    const newsletterPayload = newsletterResponse.request().postDataJSON();
    await newsletter.getByRole("status").filter({ hasText: newsletterBody.message }).waitFor();
    recordInteraction("Consented newsletter payload and unavailable feedback (intercepted)", newsletterResponse.status() === 503 && newsletterApiRequests === 1 && newsletterPayload.email === "local-validation@example.invalid" && newsletterPayload.consent === true && newsletterPayload.website === "" && typeof newsletterBody.message === "string" && newsletterBody.message.includes("not been sent or saved") && (await newsletter.getByRole("textbox", { name: "Your email address" }).inputValue()) === "local-validation@example.invalid" && await newsletterConsent.isChecked(), { status: newsletterResponse.status(), liveProviderRequests: 0 });
    expectedApiFailurePath = null;
    page.off("request", countNewsletterRequests);
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
    const mobileTestimonials = page.getByRole("region", { name: "Client testimonials" });
    const firstName = await mobileTestimonials.locator(".testimonial-card strong").first().textContent();
    await mobileTestimonials.getByRole("button", { name: "Next testimonials" }).click();
    recordInteraction("Mobile next testimonial changes the visible customer", (await mobileTestimonials.locator(".testimonial-card strong").first().textContent()) !== firstName);
    await mobileTestimonials.getByRole("group", { name: "Choose testimonial" }).getByRole("button").first().click();
    recordInteraction("Mobile testimonial dot returns to the selected customer", (await mobileTestimonials.locator(".testimonial-card strong").first().textContent()) === firstName);
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
      .getByRole("link", { name: /^About/ });
    await about.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/about/");
    recordInteraction(
      "Mobile navigation follows local link and closes",
      (await page.locator(".menu-toggle").getAttribute("aria-expanded")) ===
        "false" && new URL(page.url()).origin === base.origin,
    );
    const preservedContent = page.locator("main .legacy-home-details");
    await preservedContent.locator("summary").first().focus();
    await page.keyboard.press("Enter");
    await scrollAndDecode(page);
    recordInteraction("Original homepage content disclosure opens with keyboard without overflow", await preservedContent.evaluate((element) => element.open) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const expandedScan = await new AxeBuilder({ page }).include("main .legacy-home-details").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const expandedViolations = expandedScan.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, help: item.help, nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) }));
    result.accessibility.push({ path: "/about/ (expanded original homepage content)", width: 390, violations: expandedViolations, incomplete: expandedScan.incomplete.length, passes: expandedScan.passes.length });
    for (const violation of expandedViolations) fail("accessibility", "/about/ (expanded original homepage content) @ 390", violation);
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
    await page.goto(new URL("/projects/", base).href, { waitUntil: "load" });
    const categories = page.getByRole("navigation", { name: "Project categories" });
    const expectedCategories = ["All", "AC Repair", "AC Maintenance", "AC Installation", "Commercial AC (HVAC)"];
    recordInteraction("Project categories match the approved AC categories", JSON.stringify(await categories.getByRole("button").allTextContents()) === JSON.stringify(expectedCategories));
    for (const category of expectedCategories) {
      const categoryButton = categories.getByRole("button", { name: category, exact: true });
      await categoryButton.click();
      const hasInstallation = category === "All" || category === "AC Installation";
      const projectLinks = await page.locator("#project-results article > a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      const expectedLinks = hasInstallation ? ["/project-portfolio/luxury-villa-ac-installation/"] : [];
      const expectedStatus = `${hasInstallation ? "1 project" : "0 projects"}${category === "All" ? "" : ` in ${category}`}`;
      recordInteraction(`Project category ${category} shows accurate membership and selection`, (await categoryButton.getAttribute("aria-pressed")) === "true" && await categories.locator('button[aria-pressed="true"]').count() === 1 && JSON.stringify(projectLinks) === JSON.stringify(expectedLinks) && (await page.locator(".filter-status").textContent()).trim() === expectedStatus && (hasInstallation ? await page.locator(".project-empty").count() === 0 : (await page.locator(".project-empty").textContent()).includes("No projects published in this category yet.")), { projectLinks, expectedStatus });
    }
    const contactCheck = await checkZohoContact(page, base, zohoContact);
    recordInteraction("Contact uses the exact supplied Zoho iframe without legacy submissions (intercepted)", true, contactCheck);
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
    designConsistencyChecks: result.consistency.length,
    failures: result.failures.length,
    passed:
      !result.failures.length &&
      result.cases.length === widths.length * candidates.length,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(result, null, 2) + "\n",
  );
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

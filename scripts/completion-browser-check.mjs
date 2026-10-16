import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { interceptZohoContact, checkZohoContact, checkZohoContactFailures, checkZohoContactWithoutJavaScript } from "./helpers/zoho-contact-check.mjs";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3112");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Local checks only.");
const output = process.env.ARTIFACT_DIR || "artifacts/completion";
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base: base.href, cases: [], accessibility: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function check(name, action) {
  try { await action(); report.cases.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.cases.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
const zohoContact = await interceptZohoContact(context, base);
const page = await context.newPage();
page.setDefaultTimeout(15000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
// All form requests in this suite are fulfilled in the browser. This verifies
// CRM contact submission and newsletter UI states without delivering mail.
// Real provider acceptance remains a separate launch check.
await context.route("**/api/newsletter/", (route) => route.fulfill({ status: 503, json: { ok: false, message: "Newsletter signup is currently unavailable. Please try again later." } }));
try {
  await check("Homepage content, simplified header and group links", async () => {
    await page.goto(base.href, { waitUntil: "networkidle" });
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("h1").textContent(), "Welcome to Voltronix, AC Service Company in Dubai");
    assert.equal(await page.locator(".top-strip").count(), 0);
    assert.equal(await page.locator("#home-blog .content-card").count(), 3);
    assert.equal(await page.locator("#home-faq details").count(), 8);
    assert.equal(await page.locator("#home-portfolio .home-project-card").count(), 1);
    assert.equal(await page.locator(".promise-band h2").textContent(), "We Make AC Services Simple, Fast & Reliable!");
    assert.equal(await page.locator(".promise-band .promise-audience").count(), 0);
    assert.equal(await page.locator(".promise-grid > div:nth-child(4) strong").textContent(), "Residential & Commercial");
    assert.equal(await page.getByRole("heading", { name: "Inside a split AC" }).count(), 0);
    for (const label of ["Contracting", "DEWA Approvals", "AC Experts", "Switchgear"]) {
      assert(await page.locator(".footer-group").getByRole("link", { name: label, exact: true }).isVisible());
    }
    const faq = page.locator("#home-faq summary").first();
    await faq.focus();
    await page.keyboard.press("Enter");
    assert(await faq.evaluate((el) => el.parentElement.open));
    await page.keyboard.press("Enter");
    assert.equal(await faq.evaluate((el) => el.parentElement.open), false);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".primary-navigation").isVisible(), false);
    assert.equal(await page.getByRole("button", { name: "Menu", exact: true }).evaluate((el) => el === document.activeElement), true);
  });
  for (const width of [1024, 1280, 1440]) {
    await check(`Desktop Services hover, pointer path, click, Escape and keyboard ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base.href, { waitUntil: "networkidle" });
      const disclosure = page.locator(".primary-navigation .nav-dropdown");
      const summary = disclosure.locator("summary");
      const serviceLink = page.locator('.primary-navigation > ul > li.has-dropdown > a');
      const menu = disclosure.locator("ul");
      assert.equal(await serviceLink.getAttribute("href"), "/services/");
      const box = await summary.boundingBox();
      const linkBox = await serviceLink.boundingBox();
      assert(box && box.width >= 24 && box.height >= 24, "Desktop disclosure must meet the WCAG 2.2 minimum target size");
      assert(linkBox && box.x >= linkBox.x + linkBox.width, "Disclosure must not overlap the Services link");
      await serviceLink.hover();
      await menu.waitFor({ state: "visible" });
      assert.equal(await disclosure.evaluate(element => element.open), true, "Hovering the Services link must open its dropdown");
      const firstItem = await menu.locator("a").first().boundingBox();
      assert(firstItem);
      await page.mouse.move(firstItem.x + firstItem.width / 2, firstItem.y + firstItem.height / 2, { steps: 12 });
      await page.waitForTimeout(250);
      assert.equal(await disclosure.evaluate(element => element.open), true, "The pointer must be able to cross into the dropdown without closing it");
      assert(await disclosure.getByRole("link", { name: "HVAC Services", exact: true }).isVisible());
      await page.mouse.move(1, 400);
      await menu.waitFor({ state: "hidden" });
      assert.equal(await disclosure.evaluate(element => element.open), false, "Leaving the entire dropdown area must close hover navigation");
      await summary.hover();
      await menu.waitFor({ state: "visible" });
      assert.equal(await disclosure.evaluate(element => element.open), true, "Hovering the caret must also open service links");
      await summary.click({ position: { x: box.width - 2, y: box.height / 2 } });
      assert.equal(await disclosure.evaluate((element) => element.open), true, "A first click must preserve the menu just opened by pointer hover");
      assert(await disclosure.getByRole("link", { name: "HVAC Services", exact: true }).isVisible());
      await summary.click();
      await menu.waitFor({ state: "hidden" });
      assert.equal(await disclosure.evaluate(element => element.open), false, "A second caret click must close the menu");
      await summary.click();
      await menu.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      assert.equal(await disclosure.evaluate((element) => element.open), false);
      assert.equal(await summary.evaluate((element) => element === document.activeElement), true);
      await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
      await page.waitForTimeout(300);
      assert.equal(await disclosure.evaluate(element => element.open), false, "Escape must stay closed while the pointer remains over the caret");
      await page.keyboard.press("Enter");
      assert.equal(await disclosure.evaluate((element) => element.open), true, "Keyboard activation must remain available");
      await page.keyboard.press("Escape");
      assert.equal(await disclosure.evaluate((element) => element.open), false);
      await page.keyboard.press("Space");
      assert.equal(await disclosure.evaluate(element => element.open), true, "Space must retain native disclosure activation");
      await page.keyboard.press("Escape");
      await page.mouse.move(1, 400);
      await serviceLink.hover();
      await menu.waitFor({ state: "visible" });
      assert.equal(await disclosure.evaluate(element => element.open), true, "Leaving and re-entering restores hover after Escape");
      await serviceLink.click();
      await page.waitForURL(new URL("/services/", base).href);
      assert.equal(await disclosure.evaluate(element => element.open), false, "Service navigation closes the dropdown");
      assert.equal(await page.locator(".top-strip").count(), 0);
      assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    });
  }
  for (const width of [390, 1440]) {
    await check(`Touch Services disclosure and direct navigation ${width}px`, async () => {
      const touchContext = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, isMobile: width < 768, reducedMotion: "reduce" });
      try {
        const touchPage = await touchContext.newPage();
        touchPage.on("pageerror", error => pageErrors.push(error.message));
        await touchPage.goto(base.href, { waitUntil: "networkidle" });
        if (width < 1024) await touchPage.getByRole("button", { name: "Menu", exact: true }).tap();
        const disclosure = touchPage.locator(".primary-navigation .nav-dropdown");
        const summary = disclosure.locator("summary");
        assert.equal(await disclosure.evaluate(element => element.open), false);
        await summary.tap();
        assert.equal(await disclosure.evaluate(element => element.open), true, "First touch must open service links without a hover dependency");
        assert(await disclosure.getByRole("link", { name: "HVAC Services", exact: true }).isVisible());
        await summary.tap();
        assert.equal(await disclosure.evaluate(element => element.open), false, "Second touch must close the disclosure");
        await touchPage.locator('.primary-navigation > ul > li.has-dropdown > a').tap();
        await touchPage.waitForURL(new URL("/services/", base).href);
        assert.equal(await touchPage.locator(".top-strip").count(), 0);
        assert.equal(await touchPage.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0);
        if (width < 1024) assert.equal(await touchPage.locator(".primary-navigation").isVisible(), false);
        assert.equal(await touchPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      } finally { await touchContext.close(); }
    });
  }
  await check("Project filters show real installation and honest empty categories", async () => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(new URL("/projects/", base).href, { waitUntil: "networkidle" });
    const filters = page.getByRole("navigation", { name: "Project categories" });
    assert.equal(await page.locator("#project-results article").count(), 1);
    for (const label of ["AC Repair", "AC Maintenance", "Commercial AC (HVAC)"]) {
      const button = filters.getByRole("button", { name: label, exact: true });
      await button.focus(); await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("#project-results article").count(), 0);
      assert.match(await page.locator("#project-results").textContent(), /No projects published/);
    }
    await filters.getByRole("button", { name: "AC Installation", exact: true }).click();
    assert.equal(await page.locator("#project-results article").count(), 1);
    await page.locator("#project-results article a").click();
    await page.waitForURL("**/project-portfolio/luxury-villa-ac-installation/");
    assert.match(await page.locator("h1").textContent(), /Luxury Villa/);
  });
  await check("Original service CTAs and new service routes", async () => {
    for (const route of ["/ac-installation-service/", "/preventive-ac-maintenance-service/", "/ac-repair-services/", "/emergency-ac-maintenance-service/", "/ac-duct-cleaning-services-in-dubai/", "/hvac-services/"]) {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator("main .shared-cta").count(), 1, route);
      assert(await page.locator('.shared-cta a[href="tel:+97148240002"]').isVisible(), route);
      assert.equal(await page.locator("main h1").count(), 1, route);
      assert.equal(await page.locator(".top-strip").count(), 0, route);
      assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0, route);
    }
  });
  await check("Contact validation, exact CRM multipart payloads, acceptance and duplicate guard (intercepted)", async () => {
    await checkZohoContact(page, base, zohoContact);
  });
  await check("Contact rejection, CAPTCHA, HTTP, unknown response and network failures preserve inputs (intercepted)", async () => {
    await checkZohoContactFailures(page, base, zohoContact);
  });
  await check("Contact provides call/email fallback without JavaScript and prevents native submission", async () => {
    await checkZohoContactWithoutJavaScript(browser, base);
  });
  await check("Newsletter consent, provider failure and confirmation-email acceptance UI", async () => {
    await page.goto(base.href, { waitUntil: "networkidle" });
    const form = page.locator(".newsletter-form");
    const email = form.locator('input[type="email"]');
    const consent = form.locator('input[type="checkbox"]');
    await email.fill("subscriber@example.invalid");
    assert.equal(await consent.isChecked(), false);
    assert.equal(await form.evaluate((el) => el.checkValidity()), false);
    await consent.check();
    await form.getByRole("button", { name: "Subscribe to newsletter" }).click();
    await form.getByRole("status").filter({ hasText: "unavailable" }).waitFor();
    assert.equal(await email.inputValue(), "subscriber@example.invalid");
    let submitted;
    await page.route("**/api/newsletter/", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { ok: true, message: "Check your inbox and confirm your email to complete signup." } });
    });
    await form.getByRole("button", { name: "Subscribe to newsletter" }).click();
    await form.getByRole("status").filter({ hasText: "confirm your email" }).waitFor();
    assert.equal(submitted.consent, true);
  });
  for (const width of [390, 1440]) {
    for (const route of ["/", "/about/", "/services/", "/projects/", "/contact-us/", "/emergency-ac-maintenance-service/", "/ac-duct-cleaning-services-in-dubai/", "/hvac-services/"]) {
      await check(`Accessibility ${width}px ${route}`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
        assert.equal(await page.locator(".top-strip").count(), 0, route);
        assert.equal(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count(), 0, route);
        const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        report.accessibility.push({ width, route, violations: scan.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })), incomplete: scan.incomplete.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })) });
        assert.deepEqual(scan.violations.map((item) => item.id), []);
      });
    }
  }
  await check("No uncaught page errors", async () => assert.deepEqual(pageErrors, []));
} finally {
  await browser.close();
  report.summary = { checks: report.cases.length, failures: report.cases.filter((entry) => !entry.passed).length, accessibilityScans: report.accessibility.length, providerMode: "Browser response mocks; no live provider calls" };
  await writeFile(`${output}/completion-browser-check.json`, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failures) process.exitCode = 1;

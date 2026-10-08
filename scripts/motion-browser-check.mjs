import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Run against `npm run dev`, or set BASE_URL to a local production server.
const base = process.env.BASE_URL || "http://localhost:3001";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
const expectedCounts = ["156", "15+", "200", "100%"];
await mkdir("artifacts", { recursive: true });

async function scrollPage(page) {
  const bottom = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < bottom; top += 350) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
    await page.waitForTimeout(70);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Horizontal overflow while animating");
  }
  await page.waitForTimeout(1500);
}

async function contentIsVisible(page) {
  assert.equal(await page.locator('[data-motion-state="pending"]').count(), 0);
  assert.deepEqual(await page.locator("[data-count-value]").allTextContents(), expectedCounts);
  assert.equal(await page.locator("[data-reveal]").evaluateAll((elements) => elements.filter((el) => getComputedStyle(el).opacity === "0").length), 0);
}

try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", (response) => { if (response.request().resourceType() === "image" && response.status() >= 400) errors.push(`Image ${response.status()}: ${response.url()}`); });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-motion-state="pending"]'));
    const hero = page.locator(".hero-art img");
    assert.equal(await hero.evaluate((img) => img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === "1"), true);
    const links = await page.locator("main a[href]").evaluateAll((elements) => elements.map((el) => el.getAttribute("href")));
    for (const href of ["/contact-us/", "/services/", "/ac-repair-services/", "tel:+97148240002"]) assert(links.includes(href), `Missing CTA ${href}`);
    if (width === 1440) {
      await page.locator(".stats-grid").scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      assert.notDeepEqual(await page.locator("[data-count-value]").allTextContents(), expectedCounts, "Counters should animate on first entry");
      await page.waitForTimeout(1500);
      assert.deepEqual(await page.locator("[data-count-value]").allTextContents(), expectedCounts);
    }
    await scrollPage(page);
    await contentIsVisible(page);
    assert.equal(await page.locator(".site-header").evaluate((el) => Math.round(el.getBoundingClientRect().top)), 0);
    const logos = await page.locator('[aria-label="Brands we service"] img').evaluateAll((images) => images.map((img) => img.alt));
    assert.equal(logos.length, 18);
    assert.equal(new Set(logos).size, 18);

    // A second visit to statistics must leave the final numbers stable.
    await page.locator(".stats-grid").scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    assert.deepEqual(await page.locator("[data-count-value]").allTextContents(), expectedCounts);
    await page.locator(".home-testimonials").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Next testimonials", exact: true }).click();
    assert.equal(await page.locator(".testimonial-position-0 .testimonial-person strong").textContent(), "Juan");
    await page.locator(".home-testimonials").focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator(".testimonial-position-0 .testimonial-person strong").textContent(), "Muhammed Navas");
    if (width < 1024) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      assert.equal(await page.locator(".primary-navigation").isVisible(), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".primary-navigation").isVisible(), false);
    }
    if ([390, 1440].includes(width)) {
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      assert.deepEqual(accessibility.violations.map((issue) => issue.id), []);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `artifacts/motion-home-${width}.png`, fullPage: true, animations: "disabled" });
    }
    if (width === 1440) {
      await page.locator('.primary-navigation a[href="/about/"]').first().click();
      await page.waitForURL("**/about/");
      await page.waitForFunction(() => document.querySelector('[data-motion-state="pending"]'));
      await scrollPage(page);
      assert.equal(await page.locator('[data-motion-state="pending"]').count(), 0);
      await page.locator(".site-header").getByRole("link", { name: "Voltronix home", exact: true }).click();
      await page.waitForURL(base + "/");
      await page.waitForFunction(() => document.querySelector('[data-motion-state="pending"]'));
    }
    assert.deepEqual(errors, []);
    report.push({ width, checks: "scroll reveals, counters, links, unique logos, sticky header, testimonials, navigation, overflow and console passed" });
    console.log(`PASS ${width}px`);
    await context.close();
  }

  for (const mode of ["reduced", "no-javascript", "no-observer", "live-preference"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: mode !== "no-javascript", reducedMotion: mode === "reduced" ? "reduce" : "no-preference" });
    if (mode === "no-observer") await context.addInitScript(() => { window.IntersectionObserver = undefined; });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    if (mode === "live-preference") {
      await page.waitForFunction(() => document.querySelector('[data-motion-state="pending"]'));
      await page.locator(".stats-grid").scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(100);
    }
    await contentIsVisible(page);
    if (["reduced", "live-preference"].includes(mode)) assert.equal(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length), 0);
    report.push({ mode, checks: "All content and final statistics remain visible" });
    console.log(`PASS ${mode}`);
    await context.close();
  }
  await writeFile("artifacts/motion-browser-check.json", JSON.stringify({ base, checked: report }, null, 2) + "\n");
} finally {
  await browser.close();
}

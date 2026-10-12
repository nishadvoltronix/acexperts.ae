import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Local, read-only checks. No form delivery or external infrastructure changes.
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3112");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("BASE_URL must be local.");
const output = process.env.ARTIFACT_DIR || "artifacts/homepage-updates";
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base: base.href, cases: [], accessibility: [], layouts: [], realTiming: null, errors: [], blockedMutations: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const settle = () => new Promise(resolve => setTimeout(resolve, 100));

async function check(name, action) {
  try { await action(); report.cases.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.cases.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

async function openPage({ width = 1440, reducedMotion = "no-preference", clock = false, noObserver = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768, reducedMotion });
  await context.route("**/*", route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      report.blockedMutations.push({ method: route.request().method(), url: route.request().url() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  if (noObserver) await context.addInitScript(() => { window.IntersectionObserver = undefined; });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  if (clock) await page.clock.install({ time: new Date() });
  const response = await page.goto(base.href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  if (clock) await page.clock.pauseAt(new Date(Date.now() + 100));
  await settle();
  return { context, page };
}

async function active(page) {
  const values = await page.locator(".slider-dots button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-pressed") === "true"));
  assert.equal(values.length, 4, "The four testimonial selectors must remain available");
  assert.equal(values.filter(Boolean).length, 1, "Exactly one testimonial must be selected");
  return values.indexOf(true);
}

async function tick(page, milliseconds) {
  await page.clock.runFor(milliseconds);
  await settle();
}

async function showTestimonials(page) {
  await page.locator(".home-testimonials").evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.mouse.move(1, 1);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await settle();
}

async function assertNoOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Page must not overflow horizontally");
}

async function assertNoPlaybackButton(page) {
  assert.equal(await page.locator(".home-testimonials button").count(), 6, "Only previous/next arrows and four testimonial selectors remain");
  assert.equal(await page.getByRole("button", { name: /(?:pause|play).*slideshow|automatic testimonial rotation/i, includeHidden: true }).count(), 0);
}

async function toggleRotationWithKeyboard(page) {
  await page.locator(".home-testimonials").focus();
  await page.keyboard.press("Space");
  await showTestimonials(page);
}

async function assertTestimonialLayout(page, width) {
  const layout = await page.locator(".home-testimonials").evaluate(section => {
    const rectangle = element => {
      const { top, left, right, bottom, width, height } = element.getBoundingClientRect();
      return { top, left, right, bottom, width, height };
    };
    const cards = [...section.querySelectorAll(".testimonial-card")].filter(element => element.getBoundingClientRect().width > 0);
    return {
      active: [...section.querySelectorAll(".slider-dots button")].findIndex(button => button.getAttribute("aria-pressed") === "true"),
      heading: rectangle(section.querySelector(".section-heading")),
      cards: cards.map(rectangle),
      people: cards.map(card => rectangle(card.querySelector(".testimonial-person"))),
      controls: [...section.querySelectorAll("button")].map(rectangle),
      clippedCards: cards.filter(card => card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1).length,
      viewport: window.innerWidth,
    };
  });
  report.layouts.push({ width, ...layout });
  const expectedCards = width < 768 ? 1 : width < 1024 ? 2 : 3;
  assert.equal(layout.cards.length, expectedCards, `${width}px visible card count`);
  assert(layout.cards.every(card => card.top >= layout.heading.bottom + 12), "Every testimonial card must sit clearly below the heading");
  assert(layout.cards.every(card => Math.abs(card.top - layout.cards[0].top) <= 1), "Visible card tops must align");
  assert(layout.cards.every(card => Math.abs(card.bottom - layout.cards[0].bottom) <= 1), "Visible card bottoms must align");
  assert(layout.people.every(person => Math.abs(person.top - layout.people[0].top) <= 1), "Client identity rows must align");
  assert.equal(layout.clippedCards, 0, "Testimonial content must fit inside its cards");
  assert(layout.controls.every(control => control.left >= 0 && control.right <= layout.viewport), "All controls must stay within the viewport");
  assert(layout.controls.every(control => control.width >= 44 && control.height >= 44), "Testimonial controls must retain comfortable touch targets");
  assert(layout.controls.every(control => layout.cards.every(card => control.right <= card.left || control.left >= card.right || control.bottom <= card.top || control.top >= card.bottom)), "Controls must not overlap testimonial cards");
  await assertNoPlaybackButton(page);
}

async function scan(page, width) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  report.accessibility.push({ width, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })) });
  assert.deepEqual(result.violations.map(issue => issue.id), []);
}

try {
  const desktop = await openPage();
  const page = desktop.page;
  await check("Homepage strip removed; internal strip retained after client navigation", async () => {
    assert.equal(await page.locator(".top-strip").count(), 0);
    await page.locator('.primary-navigation a[href="/about/"]').first().click();
    await page.waitForURL("**/about/");
    await page.locator(".top-strip").waitFor({ state: "visible" });
    assert.equal(await page.locator(".top-strip").count(), 1);
    await page.locator(".site-header").getByRole("link", { name: "Voltronix home", exact: true }).click();
    await page.waitForURL(base.href);
    await page.locator(".promise-band h2").waitFor();
    assert.equal(await page.locator(".top-strip").count(), 0);
  });
  await check("Residential & Commercial replaces the old heading without duplicate subtitle", async () => {
    assert.equal((await page.locator(".promise-band h2").textContent()).trim(), "Residential & Commercial");
    assert.equal(await page.locator(".promise-band").getByText("Residential & Commercial", { exact: true }).count(), 1);
    assert.doesNotMatch(await page.locator(".promise-band").textContent(), /We Make AC Services Simple, Fast & Reliable/i);
    assert.equal(await page.locator(".promise-grid > div").count(), 6, "Existing service benefits stay present");
  });
  await check("Real-time autoplay waits three seconds, repeats, and does not announce automatic changes", async () => {
    await showTestimonials(page);
    const start = await active(page);
    const initialAnnouncement = await page.locator('.home-testimonials [role="status"]').textContent();
    const startedAt = performance.now();
    await page.waitForTimeout(2100);
    assert.equal(await active(page), start, "No advance before the three-second interval");
    await page.waitForFunction(expected => document.querySelectorAll('.slider-dots button')[expected]?.getAttribute('aria-pressed') === 'true', (start + 1) % 4, { timeout: 4000 });
    const firstAdvanceMs = performance.now() - startedAt;
    const duration = await page.locator(".testimonial-position-0").evaluate(element => getComputedStyle(element).animationDuration);
    assert.equal(duration, "0.45s", "Slide transition must use the faster requested duration");
    assert.equal(await page.locator(".testimonial-position-0").evaluate(element => getComputedStyle(element).opacity), "1", "Moving testimonial text must retain full contrast throughout the slide");
    await page.waitForFunction(expected => document.querySelectorAll('.slider-dots button')[expected]?.getAttribute('aria-pressed') === 'true', (start + 2) % 4, { timeout: 6000 });
    const secondAdvanceMs = performance.now() - startedAt;
    assert(firstAdvanceMs >= 2300 && firstAdvanceMs <= 4500, `Unexpected first advance: ${firstAdvanceMs}ms`);
    assert(secondAdvanceMs - firstAdvanceMs >= 2500 && secondAdvanceMs - firstAdvanceMs <= 4500, "Repeated advance must retain the three-second interval");
    assert.equal(await page.locator('.home-testimonials [role="status"]').textContent(), initialAnnouncement);
    report.realTiming = { firstAdvanceMs: Math.round(firstAdvanceMs), secondAdvanceMs: Math.round(secondAdvanceMs), transitionDuration: duration };
  });
  await check("Desktop accessibility, overflow and screenshots", async () => {
    await page.getByRole("button", { name: "Next testimonials", exact: true }).click();
    await page.waitForTimeout(1000);
    await assertNoOverflow(page);
    await assertNoPlaybackButton(page);
    await scan(page, 1440);
    await page.screenshot({ path: `${output}/home-testimonials-1440.png`, animations: "disabled" });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `${output}/home-header-1440.png`, animations: "disabled" });
    await page.locator(".promise-band").scrollIntoViewIfNeeded();
    await page.locator(".promise-band").screenshot({ path: `${output}/home-banner-1440.png`, animations: "disabled" });
  });
  await desktop.context.close();

  const controlled = await openPage({ clock: true });
  const timed = controlled.page;
  await check("Autoplay remains stopped offscreen and restarts with a full delay", async () => {
    const start = await active(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), start);
    await showTestimonials(timed);
    await tick(timed, 2500);
    assert.equal(await active(timed), start);
    await tick(timed, 1000);
    assert.equal(await active(timed), (start + 1) % 4);
    await timed.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await settle();
    const offscreen = await active(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), offscreen);
  });
  await check("Hover pauses autoplay, leaving resumes with a full interval", async () => {
    await showTestimonials(timed);
    await timed.locator(".testimonial-position-0 blockquote").hover();
    const start = await active(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), start);
    await timed.mouse.move(1, 1);
    await tick(timed, 2500);
    assert.equal(await active(timed), start);
    await tick(timed, 1000);
    assert.equal(await active(timed), (start + 1) % 4);
  });
  await check("Keyboard focus pauses autoplay until focus leaves the carousel", async () => {
    await timed.locator(".home-testimonials").focus();
    const start = await active(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), start);
    await timed.evaluate(() => document.activeElement.blur());
    await tick(timed, 3500);
    assert.equal(await active(timed), (start + 1) % 4);
  });
  await check("Manual browsing stops rotation; section Space resumes without a visible playback button", async () => {
    await assertNoPlaybackButton(timed);
    const start = await active(timed);
    await timed.getByRole("button", { name: "Next testimonials", exact: true }).click();
    assert.equal(await active(timed), (start + 1) % 4);
    await showTestimonials(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), (start + 1) % 4);
    await toggleRotationWithKeyboard(timed);
    await tick(timed, 3500);
    assert.equal(await active(timed), (start + 2) % 4);
  });
  await check("Space on a carousel button keeps its native action and does not resume autoplay", async () => {
    const dots = timed.locator(".slider-dots button");
    await dots.first().click();
    await dots.nth(2).focus();
    await timed.keyboard.press("Space");
    assert.equal(await active(timed), 2);
    await showTestimonials(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), 2);
    await toggleRotationWithKeyboard(timed);
    await tick(timed, 3500);
    assert.equal(await active(timed), 3);
    await toggleRotationWithKeyboard(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), 3, "Section Space can also stop an automatically rotating carousel");
    await toggleRotationWithKeyboard(timed);
  });
  await check("Simulated document-hidden events pause and resume rotation", async () => {
    await showTestimonials(timed);
    const start = await active(timed);
    await timed.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    try {
      await tick(timed, 16000);
      assert.equal(await active(timed), start);
    } finally {
      await timed.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    }
    await tick(timed, 3500);
    assert.equal(await active(timed), (start + 1) % 4);
  });
  await check("Live reduced-motion preference stops autoplay and transition; reverting resumes", async () => {
    await showTestimonials(timed);
    await timed.emulateMedia({ reducedMotion: "reduce" });
    await settle();
    const start = await active(timed);
    await tick(timed, 16000);
    assert.equal(await active(timed), start);
    await assertNoPlaybackButton(timed);
    assert.equal(await timed.locator(".testimonial-position-0").evaluate(element => getComputedStyle(element).animationName), "none");
    await timed.emulateMedia({ reducedMotion: "no-preference" });
    await settle();
    await tick(timed, 3500);
    assert.equal(await active(timed), (start + 1) % 4);
  });
  await check("Arrows, dots, keyboard and manual announcements remain available", async () => {
    const dots = timed.locator(".slider-dots button");
    await dots.nth(0).click();
    assert.equal(await active(timed), 0);
    await timed.getByRole("button", { name: "Previous testimonials", exact: true }).click();
    assert.equal(await active(timed), 3);
    await timed.getByRole("button", { name: "Next testimonials", exact: true }).click();
    assert.equal(await active(timed), 0);
    await dots.nth(2).click();
    assert.equal(await active(timed), 2);
    await timed.locator(".home-testimonials").focus();
    for (const [key, index] of [["ArrowRight", 3], ["ArrowLeft", 2], ["Home", 0], ["End", 3]]) {
      await timed.keyboard.press(key);
      assert.equal(await active(timed), index);
      assert.match(await timed.locator('.home-testimonials [role="status"]').textContent(), new RegExp(`testimonial ${index + 1} of 4`));
    }
    await toggleRotationWithKeyboard(timed);
    const announcement = await timed.locator('.home-testimonials [role="status"]').textContent();
    assert.equal(announcement, "Automatic testimonial rotation resumed.", "User-requested playback changes need accessible confirmation");
    await tick(timed, 3500);
    assert.equal(await active(timed), 0);
    assert.equal(await timed.locator('.home-testimonials [role="status"]').textContent(), announcement, "Automatic movement must not interrupt screen-reader users");
  });
  await controlled.context.close();

  const mobile = await openPage({ width: 390, clock: true });
  await check("Mobile autoplay and real touch swipe work with 44px selector targets", async () => {
    await showTestimonials(mobile.page);
    const start = await active(mobile.page);
    await tick(mobile.page, 3500);
    assert.equal(await active(mobile.page), (start + 1) % 4);
    const beforeSwipe = await active(mobile.page);
    const grid = await mobile.page.locator(".testimonials-grid").boundingBox();
    assert(grid);
    const session = await mobile.context.newCDPSession(mobile.page);
    const x = grid.x + grid.width * 0.75;
    const y = grid.y + grid.height * 0.45;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 14, y: y + 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
    await settle();
    assert.equal(await active(mobile.page), (beforeSwipe + 1) % 4, "A horizontal touch swipe must advance one slide");
    await showTestimonials(mobile.page);
    await tick(mobile.page, 16000);
    assert.equal(await active(mobile.page), (beforeSwipe + 1) % 4, "Manual swipe must keep rotation stopped after touch interaction ends");
    for (const box of await mobile.page.locator(".slider-dots button").evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })))) {
      assert(box.width >= 44 && box.height >= 44);
    }
  });
  await check("Heading/card alignment, control bounds and responsive layout at 320/390/768/1024/1440px", async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await mobile.page.setViewportSize({ width, height: 900 });
      await tick(mobile.page, 1000);
      assert.equal(await mobile.page.locator(".top-strip").count(), 0);
      await assertNoOverflow(mobile.page);
      await showTestimonials(mobile.page);
      for (let position = 0; position < 4; position++) {
        await mobile.page.locator(".slider-dots button").nth(position).click();
        await tick(mobile.page, 1000);
        assert.equal(await active(mobile.page), position);
        await assertTestimonialLayout(mobile.page, width);
      }
      await mobile.page.screenshot({ path: `${output}/home-testimonials-${width}.png`, animations: "disabled" });
      await mobile.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await mobile.page.screenshot({ path: `${output}/home-header-${width}.png`, animations: "disabled" });
      await mobile.page.locator(".promise-band").evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await tick(mobile.page, 1000);
      await mobile.page.locator(".promise-band").screenshot({ path: `${output}/home-banner-${width}.png`, animations: "disabled" });
      if (width === 390) {
        // axe uses browser timers internally; release the controlled clock while
        // it runs. Manual swipe has already stopped rotation for stable scans.
        await mobile.page.clock.resume();
        await scan(mobile.page, width);
        await mobile.page.clock.pauseAt(new Date(await mobile.page.evaluate(() => Date.now()) + 100));
      }
    }
  });
  await mobile.context.close();

  const reduced = await openPage({ width: 390, clock: true, reducedMotion: "reduce" });
  await check("Initial reduced motion disables autoplay while preserving manual navigation", async () => {
    await showTestimonials(reduced.page);
    const start = await active(reduced.page);
    await tick(reduced.page, 22000);
    assert.equal(await active(reduced.page), start);
    await assertNoPlaybackButton(reduced.page);
    await reduced.page.getByRole("button", { name: "Next testimonials", exact: true }).click();
    assert.equal(await active(reduced.page), (start + 1) % 4);
    assert.equal(await reduced.page.locator(".testimonial-position-0").evaluate(element => getComputedStyle(element).animationName), "none");
    await assertNoOverflow(reduced.page);
  });
  await reduced.context.close();

  const fallback = await openPage({ clock: true, noObserver: true });
  await check("No-IntersectionObserver fallback retains offscreen protection and autoplay", async () => {
    const start = await active(fallback.page);
    await tick(fallback.page, 16000);
    assert.equal(await active(fallback.page), start);
    await showTestimonials(fallback.page);
    await tick(fallback.page, 3500);
    assert.equal(await active(fallback.page), (start + 1) % 4);
    await fallback.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await settle();
    const offscreen = await active(fallback.page);
    await tick(fallback.page, 16000);
    assert.equal(await active(fallback.page), offscreen);
  });
  await fallback.context.close();
  await check("No browser errors or network mutations", async () => {
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.blockedMutations, []);
  });
} catch (error) {
  report.cases.push({ name: "Browser suite completed", passed: false, error: error.message });
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed = report.cases.every(item => item.passed);
  await writeFile(`${output}/homepage-updates-browser-check.json`, JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
if (!report.passed) process.exitCode = 1;

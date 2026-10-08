import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Run against `npm run dev`, or set BASE_URL to a local production server.
const base = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
await mkdir("artifacts", { recursive: true });

async function check(name, work) {
  try {
    const details = await work();
    report.push({ name, passed: true, ...details });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.push({ name, passed: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function controls(page) {
  const viewer = page.locator("[data-ac-viewer]");
  return {
    viewer,
    viewport: viewer.locator("[data-ac-viewport]"),
    slider: viewer.getByRole("slider", { name: "Explode level" }),
    normal: viewer.getByRole("button", { name: "Normal (Assembled)", exact: true }),
    explode: viewer.getByRole("button", { name: "Explode (Separate)", exact: true }),
    loop: viewer.getByRole("button", { name: /^(?:Start|Stop) auto loop animation$/ }),
    start: viewer.getByRole("button", { name: "Start auto loop animation", exact: true }),
    stop: viewer.getByRole("button", { name: "Stop auto loop animation", exact: true }),
  };
}

async function readState(page) {
  return page.locator("[data-ac-viewer]").evaluate((viewer) => {
    const viewport = viewer.querySelector("[data-ac-viewport]");
    const style = getComputedStyle(viewport);
    const slider = viewer.querySelector('input[type="range"]');
    return {
      level: Number(style.getPropertyValue("--ac-explode")),
      x: parseFloat(style.getPropertyValue("--ac-rotate-x")),
      y: parseFloat(style.getPropertyValue("--ac-rotate-y")),
      slider: Number(slider.value),
      valueText: slider.getAttribute("aria-valuetext"),
      output: viewer.querySelector("output").value,
    };
  });
}

async function showModel(page) {
  await controls(page).viewport.evaluate((element) => {
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 150, behavior: "instant" });
  });
  await page.waitForTimeout(100);
}

async function openHome(page) {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-ac-viewer] input[type="range"]');
    return input && !input.disabled;
  });
  await showModel(page);
  await assertPhotoLayersLoaded(page);
  // Allow entry scroll to settle before checking idle autoplay.
  await page.waitForTimeout(1000);
}

async function assertPhotoLayersLoaded(page) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll("[data-ac-part] img")];
    return images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });
  assert.equal(await controls(page).viewer.locator("[data-ac-part] img").count(), 6, "Each of the six parts must render its photographic layer");
}

async function assertPlacement(page) {
  const placement = await controls(page).viewer.evaluate((viewer) => {
    const box = viewer.getBoundingClientRect();
    return {
      followsServices: viewer.previousElementSibling?.id === "our-services",
      viewportHeight: viewer.querySelector("[data-ac-viewport]").getBoundingClientRect().height,
      left: box.left,
      right: box.right,
      pageWidth: document.documentElement.clientWidth,
    };
  });
  assert.equal(placement.followsServices, true, "The viewer must appear directly after Home services");
  assert(placement.viewportHeight <= 421, "The AC viewport must remain compact at every breakpoint");
  assert(Math.abs(placement.left) <= 1 && Math.abs(placement.right - placement.pageWidth) <= 1, "The viewer section must span the page width");
}

async function waitLevel(page, target) {
  await page.waitForFunction((value) => {
    const element = document.querySelector("[data-ac-viewport]");
    return Number(getComputedStyle(element).getPropertyValue("--ac-explode")) === value;
  }, target);
}

function assertSynchronized(state) {
  const percent = Math.round(state.level * 100);
  assert.equal(state.slider, percent, "Slider must reflect the actual visible separation");
  assert.equal(state.output, `${percent}%`);
  assert.equal(state.valueText, `${percent}% separated`);
}

async function assertFrozen(page, duration = 450) {
  const before = await readState(page);
  await page.waitForTimeout(duration);
  const after = await readState(page);
  assert.equal(after.level, before.level, "A stopped viewer must keep the chosen separation");
  assertSynchronized(after);
  return after;
}

async function assertMoving(page) {
  const before = await readState(page);
  await page.waitForFunction((previous) => {
    const element = document.querySelector("[data-ac-viewport]");
    return Math.abs(Number(getComputedStyle(element).getPropertyValue("--ac-explode")) - previous) > 0.001;
  }, before.level, { timeout: 5000 });
  const after = await readState(page);
  assertSynchronized(after);
  return after;
}

async function assertAutoplay(page) {
  await page.mouse.move(0, 0);
  await controls(page).stop.waitFor({ state: "visible", timeout: 5000 });
  assert.equal(await controls(page).stop.getAttribute("aria-pressed"), "true");
  return assertMoving(page);
}

async function hideModel(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(100);
}

async function assertFit(page) {
  const geometry = await page.locator("[data-ac-viewer]").evaluate((viewer) => {
    const viewport = viewer.querySelector("[data-ac-viewport]").getBoundingClientRect();
    const surfaces = [...viewer.querySelectorAll("[data-ac-part] > div")];
    const outsideParts = surfaces.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < viewport.left - 1 || rect.right > viewport.right + 1 || rect.top < viewport.top - 1 || rect.bottom > viewport.bottom + 1;
    }).map((element) => element.parentElement.getAttribute("data-ac-part"));
    const clippedControls = [...viewer.querySelectorAll("button, input, label, output, li")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const parent = viewer.getBoundingClientRect();
      return rect.left < parent.left - 1 || rect.right > parent.right + 1 || element.scrollWidth > element.clientWidth + 1;
    }).map((element) => element.textContent.trim() || element.tagName);
    return { outsideParts, clippedControls, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(geometry.outsideParts, [], "Every AC surface must fit inside the viewport");
  assert.deepEqual(geometry.clippedControls, [], "Control and legend text must not clip");
  assert.equal(geometry.overflow, false, "The page must not overflow horizontally");
}

async function rotateToCorner(page, x, y) {
  await controls(page).viewport.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press(x < 0 ? "ArrowUp" : "ArrowDown");
  for (let i = 0; i < 7; i++) await page.keyboard.press(y < 0 ? "ArrowLeft" : "ArrowRight");
  const state = await readState(page);
  assert.equal(state.x, x);
  assert.equal(state.y, y);
}

async function assertAccessible(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  assert.deepEqual(result.violations.map((issue) => ({ id: issue.id, nodes: issue.nodes.map((node) => node.target) })), []);
}

try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await check(`responsive ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      try {
        await openHome(page);
        const ui = controls(page);
        assert.equal(await ui.viewer.count(), 1);
        await assertPlacement(page);
        assert.deepEqual((await ui.viewer.locator("[data-ac-part]").evaluateAll((parts) => parts.map((part) => part.dataset.acPart))).sort(), ["blower", "chassis", "evaporator", "filter", "front", "pcb"]);
        assert.equal(await ui.viewer.getByRole("list", { name: "AC components" }).locator("li").count(), 6);
        const initial = await readState(page);
        assert(initial.level >= 0 && initial.level <= 1);
        assert.equal(initial.x, 0);
        assert.equal(initial.y, 0);
        assertSynchronized(initial);
        await assertAutoplay(page);
        await assertFit(page);
        await ui.slider.fill("0");
        assert.equal((await readState(page)).level, 0);
        await assertFit(page);
        await ui.slider.fill("100");
        assertSynchronized(await readState(page));
        await assertFit(page);
        for (const [x, y] of [[-8, -10], [-8, 10], [8, -10], [8, 10]]) {
          await rotateToCorner(page, x, y);
          await assertFit(page);
        }
        await page.keyboard.press("Home");
        if ([390, 1440].includes(width)) {
          await showModel(page);
          await page.waitForTimeout(400);
          await assertAccessible(page);
          await ui.viewport.evaluate((element) => element.blur());
          // Viewport captures preserve CSS 3D compositing on emulated mobile Chrome.
          await page.setViewportSize({ width, height: width === 1440 ? 1500 : 1000 });
          await ui.viewer.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - document.querySelector(".site-header").getBoundingClientRect().height - 16, behavior: "instant" }));
          await page.waitForTimeout(1000);
          await ui.slider.fill("100");
          await ui.slider.evaluate((element) => element.blur());
          await page.mouse.move(0, 0);
          await page.waitForTimeout(1800);
          await page.screenshot({ path: `artifacts/ac-viewer-${width}.png`, animations: "disabled" });
          if (width === 1440) {
            await page.locator("#our-services").evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - document.querySelector(".site-header").getBoundingClientRect().height, behavior: "instant" }));
            await page.waitForTimeout(200);
            await ui.slider.fill("100");
            await ui.slider.evaluate((element) => element.blur());
            await page.waitForTimeout(1800);
            await page.screenshot({ path: "artifacts/ac-home-desktop.png", animations: "disabled" });
          }
        }
        assert.deepEqual(errors, []);
        return { checks: "six loaded photographic layers, compact full-width placement immediately after Home services, automatic motion on entry, manual reassembly, four tilt limits, responsive controls, model fit, no horizontal overflow", accessibility: [390, 1440].includes(width) ? "WCAG 2.1 A/AA passed" : undefined };
      } finally {
        await context.close();
      }
    });
  }

  await check("automatic playback and suspension", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await openHome(page);
      const ui = controls(page);
      await assertAutoplay(page);
      // Observe a complete repeating cycle without clicking the loop control.
      await waitLevel(page, 0);
      assertSynchronized(await readState(page));
      await waitLevel(page, 1);
      assertSynchronized(await readState(page));
      await waitLevel(page, 0);
      assertSynchronized(await readState(page));

      await page.reload({ waitUntil: "networkidle" });
      await assertPhotoLayersLoaded(page);
      const restoredVisible = await ui.viewport.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.top < innerHeight && box.bottom > 0;
      });
      assert.equal(restoredVisible, true, "Reload should retain the current visible page position");
      await assertAutoplay(page);

      await hideModel(page);
      await assertFrozen(page, 1900);
      await showModel(page);
      await assertAutoplay(page);

      await ui.stop.click();
      await assertFrozen(page);
      await hideModel(page);
      await assertFrozen(page, 200);
      await showModel(page);
      await assertFrozen(page, 1900);
      assert.equal(await ui.start.getAttribute("aria-pressed"), "false", "Explicit Stop must remain paused after scrolling away and back");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(100);
      await assertFrozen(page, 200);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForTimeout(100);
      await assertFrozen(page, 1900);
      assert.equal(await ui.start.getAttribute("aria-pressed"), "false", "Explicit Stop must remain paused when reduced motion is turned off");
      await ui.start.click();
      await assertMoving(page);
      return { checks: "autoplay on first entry and visible reload, repeated assembled/exploded endpoints, offscreen suspension and resume, explicit Stop retained after scroll scrubbing and motion preference changes, manual restart" };
    } finally {
      await context.close();
    }
  });

  await check("scroll speed and hover interaction", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await openHome(page);
      const ui = controls(page);
      await ui.stop.click();
      await showModel(page);
      await page.mouse.move(0, 0);
      const origin = await page.evaluate(() => window.scrollY);
      async function scrollBy(top) {
        await page.evaluate((distance) => window.scrollBy({ top: distance, behavior: "instant" }), top);
        await page.waitForTimeout(100);
        return readState(page);
      }

      await ui.slider.fill("20");
      const slow = await scrollBy(20);
      assert(slow.level > 0.2, "Downward scrolling must expand the AC");
      assertSynchronized(slow);
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), origin);
      await page.waitForTimeout(100);
      await ui.slider.fill("20");
      const fast = await scrollBy(100);
      assert(fast.level - 0.2 > (slow.level - 0.2) * 3, "A larger scroll movement over the same interval must expand the AC further");
      assertSynchronized(fast);
      const reverse = await scrollBy(-80);
      assert(reverse.level < fast.level, "Upward scrolling must bring the parts together");
      assertSynchronized(reverse);
      await assertFrozen(page, 1700);
      assert.equal(await ui.start.getAttribute("aria-pressed"), "false", "Scroll interaction must preserve the explicit autoplay pause");

      await ui.start.click();
      await assertMoving(page);
      await scrollBy(35);
      await assertFrozen(page, 250);
      await assertAutoplay(page);

      await showModel(page);
      await ui.normal.click();
      await waitLevel(page, 0);
      await assertFrozen(page, 200);
      await ui.viewport.hover();
      await page.waitForTimeout(150);
      const expanding = await readState(page);
      assert(expanding.level > 0 && expanding.level < 1, "Hover must smoothly open the assembled AC");
      assertSynchronized(expanding);
      await waitLevel(page, 1);
      await assertFrozen(page, 1100);
      await page.mouse.move(0, 0);
      await assertFrozen(page, 1100);
      assert.equal(await ui.start.getAttribute("aria-pressed"), "false", "Hover must respect a manual autoplay pause after the pointer leaves");

      await ui.start.click();
      await assertAutoplay(page);
      await waitLevel(page, 0);
      await ui.viewport.hover();
      await page.waitForTimeout(150);
      const hoverLoop = await readState(page);
      assert(hoverLoop.level > 0 && hoverLoop.level < 1, "Hover must open the normal stage during autoplay");
      await waitLevel(page, 1);
      // Keep the pointer inside for a full cycle: hover must never hold it open.
      await waitLevel(page, 0);
      await waitLevel(page, 1);
      assert.equal(await ui.viewport.evaluate((element) => element.matches(":hover")), true);
      assert.equal(await ui.stop.getAttribute("aria-pressed"), "true");
      assertSynchronized(await readState(page));

      await scrollBy(-35);
      await page.waitForTimeout(900);
      await assertMoving(page);
      assert.equal(await ui.viewport.evaluate((element) => element.matches(":hover")), true, "Scroll idle must resume autoplay while still hovered");
      await waitLevel(page, 0);
      await page.mouse.move(0, 0);
      await ui.viewport.hover();
      await page.waitForTimeout(150);
      await page.mouse.move(0, 0);
      await waitLevel(page, 1);
      await waitLevel(page, 0);
      await assertAutoplay(page);
      return { checks: "scroll speed controls separation, hover expands the normal stage without stopping repeated autoplay, scroll idle resumes while hovered, leaving mid-expansion keeps the loop running, manual pause survives hover" };
    } finally {
      await context.close();
    }
  });

  await check("animation, controls, and cleanup", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    try {
      await openHome(page);
      const ui = controls(page);
      await ui.slider.fill("100");
      await ui.normal.click();
      await page.waitForTimeout(220);
      let state = await readState(page);
      assert(state.level > 0 && state.level < 1, "Reassembly should pass through intermediate layers");
      assertSynchronized(state);
      await waitLevel(page, 0);
      await ui.explode.click();
      await page.waitForTimeout(220);
      state = await readState(page);
      assert(state.level > 0 && state.level < 1, "Explode should move smoothly through intermediate layers");
      assertSynchronized(state);
      await waitLevel(page, 1);

      await showModel(page);
      await ui.slider.fill("43");
      state = await readState(page);
      assert.equal(state.level, 0.43, "Slider input must immediately update geometry");
      assertSynchronized(state);
      await ui.start.click();
      state = await readState(page);
      assert(state.level >= 0.43 && state.level < 0.55, "Starting a loop must continue from the selected amount");
      await page.waitForTimeout(300);
      assert((await readState(page)).level > 0.43);
      await ui.stop.click();
      await assertFrozen(page);

      await ui.start.click();
      await page.waitForTimeout(150);
      await ui.slider.fill("62");
      assert.equal((await readState(page)).level, 0.62);
      assert.equal(await ui.start.count(), 1);
      await assertFrozen(page, 2000);

      await ui.start.click();
      await page.waitForTimeout(150);
      await hideModel(page);
      await assertFrozen(page, 1900);
      await showModel(page);
      await assertAutoplay(page);
      await ui.stop.click();
      await assertFrozen(page, 200);

      await ui.start.click();
      await page.waitForTimeout(80);
      await ui.explode.click();
      await page.waitForTimeout(80);
      await ui.normal.click();
      await page.waitForTimeout(80);
      await ui.slider.fill("37");
      assert.equal((await readState(page)).level, 0.37);
      await assertFrozen(page, 2200);

      await ui.slider.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal((await readState(page)).level, 0.38);
      await ui.viewport.focus();
      await page.keyboard.press("ArrowLeft");
      assert.equal((await readState(page)).y, -2);
      assert.equal(await ui.viewport.evaluate((element) => element === document.activeElement), true);
      await page.keyboard.press("ArrowDown");
      assert.equal((await readState(page)).x, 2);
      await page.keyboard.press("Home");
      state = await readState(page);
      assert.equal(state.x, 0);
      assert.equal(state.y, 0);

      await showModel(page);
      const box = await ui.viewport.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 + 35, { steps: 8 });
      await page.mouse.up();
      state = await readState(page);
      assert(state.y < 0 && state.x < 0, "Dragging should tilt both axes with a mouse");

      await showModel(page);
      await ui.start.click();
      await page.waitForTimeout(100);
      await page.locator('.primary-navigation a[href="/about/"]').first().click();
      await page.waitForURL(`${base}/about/`);
      assert.equal(await page.locator("[data-ac-viewer]").count(), 0);
      await page.waitForTimeout(1800);
      await assertAccessible(page);
      await page.locator(".site-header").getByRole("link", { name: "Voltronix home", exact: true }).click();
      await page.waitForURL(`${base}/`);
      await page.waitForFunction(() => {
        const input = document.querySelector('[data-ac-viewer] input[type="range"]');
        return input && !input.disabled;
      });
      await showModel(page);
      await page.waitForTimeout(1000);
      await assertAutoplay(page);
      assert.deepEqual(errors, []);
      return { checks: "smooth synchronized animation, immediate slider, loop continuity/stop, offscreen pause/resume, rapid input cancellation, keyboard and mouse, unmount cleanup and fresh Home autoplay, About has no viewer and passes accessibility" };
    } finally {
      await context.close();
    }
  });

  await check("real touch rotation and page scrolling", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await openHome(page);
      const ui = controls(page);
      await ui.normal.click();
      await waitLevel(page, 0);
      const tapBox = await ui.viewport.boundingBox();
      await page.touchscreen.tap(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2);
      await assertFrozen(page, 900);
      assert.equal((await readState(page)).level, 0, "Touch contact must not trigger hover expansion");
      const session = await context.newCDPSession(page);
      async function swipe(x, y, dx, dy) {
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let step = 1; step <= 10; step++) {
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 10, y: y + dy * step / 10 }] });
          await page.waitForTimeout(20);
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(200);
      }
      let box = await controls(page).viewport.boundingBox();
      await swipe(box.x + box.width / 2, box.y + box.height / 2, -85, 0);
      let state = await readState(page);
      assert(state.y < 0, "Horizontal touch drag should tilt the model");
      assert.equal(state.x, 0);
      assert.equal(await controls(page).start.count(), 1, "Manual touch rotation should stop autoplay");
      await assertFrozen(page, 200);
      await showModel(page);
      const before = await page.evaluate(() => window.scrollY);
      box = await controls(page).viewport.boundingBox();
      await swipe(box.x + box.width / 2, box.y + box.height * 0.8, 0, -120);
      assert(await page.evaluate(() => window.scrollY) > before + 40, "Vertical touch should scroll the page through the viewer");
      state = await readState(page);
      assert.equal(state.x, 0);
      await assertFrozen(page, 200);
      return { checks: "touch does not trigger hover expansion, native horizontal touch rotates, native vertical touch scrolls and scrubs without restarting manually paused autoplay" };
    } finally {
      await context.close();
    }
  });

  for (const mode of ["reduced motion", "live motion preference", "no JavaScript"]) {
    await check(mode, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: mode === "reduced motion" ? "reduce" : "no-preference", javaScriptEnabled: mode !== "no JavaScript" });
      const page = await context.newPage();
      try {
        if (mode === "no JavaScript") {
          await page.goto(`${base}/`, { waitUntil: "networkidle" });
          const ui = controls(page);
          assert.equal(await ui.viewer.getByRole("heading", { name: "Inside a split AC" }).count(), 1);
          assert.equal(await ui.viewer.locator("[data-ac-part]").count(), 6);
          assert.equal(await ui.viewer.getByRole("list", { name: "AC components" }).locator("li").count(), 6);
          assert.equal(await ui.viewer.locator("button:not(:disabled), input:not(:disabled)").count(), 0);
          await showModel(page);
          await assertPhotoLayersLoaded(page);
          await assertPlacement(page);
          const initial = await readState(page);
          assert.equal(initial.level, 1);
          assertSynchronized(initial);
          await assertFit(page);
          return { checks: "six loaded photographic layers, full-width server-rendered exploded view, explanation and legend; controls visibly disabled" };
        }
        await openHome(page);
        const ui = controls(page);
        if (mode === "live motion preference") {
          await assertMoving(page);
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.waitForTimeout(100);
          await assertFrozen(page);
          assert.equal(await ui.loop.isDisabled(), true);
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await assertMoving(page);
          assert.equal(await ui.stop.getAttribute("aria-pressed"), "true", "Autoplay should resume when reduced motion is turned off before any manual stop");
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.waitForTimeout(100);
          await assertFrozen(page);
        }
        assert.equal(await ui.loop.isDisabled(), true);
        await assertFrozen(page);
        await ui.explode.click();
        assert.equal((await readState(page)).level, 1, "Reduced motion should snap to the exploded view");
        await assertFrozen(page);
        await ui.normal.click();
        assert.equal((await readState(page)).level, 0, "Reduced motion should snap to the assembled view");
        await ui.viewport.hover();
        await assertFrozen(page, 900);
        assert.equal((await readState(page)).level, 0, "Reduced motion must suppress hover expansion");
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollBy({ top: 40, behavior: "instant" }));
        await page.waitForTimeout(100);
        await assertFrozen(page, 900);
        assert.equal((await readState(page)).level, 0, "Reduced motion must suppress scroll-driven animation");
        await ui.slider.fill("57");
        assert.equal((await readState(page)).level, 0.57);
        await assertFrozen(page);
        assert.equal(await ui.viewer.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length), 0);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.waitForTimeout(100);
        await assertFrozen(page, 1900);
        assert.equal(await ui.start.isDisabled(), false);
        assert.equal(await ui.start.getAttribute("aria-pressed"), "false", "Manual separation must remain paused when the motion preference changes back");
        await ui.start.click();
        await assertMoving(page);
        return { checks: "autoplay suppressed by reduced motion, instant manual controls, conditional preference resume, explicit manual pause preserved, manual restart" };
      } finally {
        await context.close();
      }
    });
  }
} finally {
  await writeFile("artifacts/ac-viewer-check.json", JSON.stringify({ base, checked: report }, null, 2) + "\n");
  await browser.close();
}

if (report.some((item) => !item.passed)) process.exitCode = 1;

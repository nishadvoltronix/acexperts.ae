import assert from "node:assert/strict";

// Independent oracle from the supplied CRM export; never import app constants.
export const ZOHO_CONTACT_ACTION = "https://crm.zoho.com/crm/WebToLeadForm";
export const ZOHO_CONTACT_ORIGIN = "https://crm.zoho.com";
const ZOHO_ANALYTICS_ACTION = "https://crm.zohopublic.com/crm/WebFormAnalyticsServeServlet?rid=5b4805f1d006ff2815608af029172507770bf9a6e7b730b5d49acee27fb9bf6ad2e5470867ed50a378e9e08757adb369gid5f82bb6bb26448213264d18f05fa425935fb19c58ec3107f5e362d359fe942ccgida5b517382bfb424316610341873ec3722004f02b55c06bcbac306a2e17a9e6c5gid10903e4628f131d4ea1d2ed6f47aebb789b8f7e6f13ad1b05ad123cee7339a75&tw=117cb51c82501e77e334bb49e2714d5a6aa8fc30bc83dde3fb082f3a183e3019&version=v2";
const HIDDEN_FIELDS = {
  xnQsjsdp: "9c3c84d640097544b5382d4704575ce7452d282b048d0101863c1ebb1acc32fb",
  zc_gad: "",
  xmIwtLD: "d33180f3486f1c34048a033013f0a4b331e41c190982a0fa2c23140c3374b925e17874ef7c22cf1ba74f1678c43a549e",
  actionType: "TGVhZHM=",
  returnURL: "null",
  aG9uZXlwb3Q: "",
};
const VALUES = {
  "First Name": "Local CRM check",
  "Last Name": "Tester",
  Email: "local-crm@example.invalid",
  Company: "Synthetic & Test Company",
  Mobile: "+971 50 000 0000",
  LEADCF9: "Local AC project",
  LEADCF12: "Synthetic local check: AC & ventilation \u2014 \u062f\u0628\u064a. No delivery expected.",
};
const DEPARTMENTS = ["VOLTRONIX CONTRACTING LLC", "VOLTRONIX SWITCHGEAR LLC"];
const REQUIRED_FIELDS = ["First Name", "Last Name", "Email", "Mobile", "LEADCF2", "LEADCF9", "LEADCF12"];
const SUCCESS_MESSAGE = "Local intercepted acceptance; no enquiry delivered.";

export async function interceptZohoContact(context, base) {
  const submissions = [], unexpectedPosts = [], unexpectedProviderRequests = [], analyticsRequests = [], replies = [];
  const localOrigin = new URL(base).origin;
  const cors = {
    "access-control-allow-origin": localOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, cache-control, pragma",
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.url() === ZOHO_CONTACT_ACTION && request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (request.url() === ZOHO_CONTACT_ACTION && request.method() === "POST") {
      const reply = replies.shift() || {};
      const contentType = request.headers()["content-type"] || "";
      const data = await new Response(request.postDataBuffer(), { headers: { "content-type": contentType } }).formData();
      submissions.push({ method: request.method(), navigation: request.isNavigationRequest(), contentType, fields: [...data.entries()] });
      if (reply.wait) await reply.wait;
      if (reply.abort) return route.abort(reply.abort);
      return route.fulfill({
        status: reply.status || 200,
        headers: cors,
        ...(reply.body !== undefined
          ? { contentType: reply.contentType || "text/html; charset=utf-8", body: reply.body }
          : { json: reply.json || { actionsubmit: "Splash Message", actionvalue: SUCCESS_MESSAGE } }),
      });
    }
    if (request.url() === ZOHO_ANALYTICS_ACTION && request.method() === "GET") {
      analyticsRequests.push(request.url());
      // Keep optional hooks callable without loading a tracker or sending data.
      return route.fulfill({ status: 200, contentType: "application/javascript", body: "window._wfa_track = { wfa_submit: function () {}, wfa_post_submit: function () {} };" });
    }
    if (request.method() === "POST" && (url.origin !== localOrigin || /^\/api\/contact\/?$/.test(url.pathname))) {
      unexpectedPosts.push(request.url());
      return route.fulfill({ status: 400, headers: cors, contentType: "text/plain", body: "Unexpected form destination blocked by test" });
    }
    if (/(^|\.)(zoho\.com|zohopublic\.com|zohocdn\.com|zohostatic\.com)$/.test(url.hostname)) {
      unexpectedProviderRequests.push(request.url());
      return route.fulfill({ status: 200, headers: cors, contentType: "application/javascript", body: "/* Unexpected provider request blocked by test. */" });
    }
    return route.fallback();
  });
  return { submissions, unexpectedPosts, unexpectedProviderRequests, analyticsRequests, replyNext: (reply) => replies.push(reply) };
}

async function fillContact(form, department, values = VALUES) {
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(value);
  await form.locator('[name="LEADCF2"]').selectOption(department);
}
function assertPayload(actual, department, values = VALUES) {
  assert.equal(actual.method, "POST");
  assert.equal(actual.navigation, false, "The exported CRM form submits using fetch");
  assert.match(actual.contentType, /^multipart\/form-data;\s*boundary=/i);
  const expected = { ...HIDDEN_FIELDS, ...values, LEADCF2: department };
  assert.deepEqual(actual.fields.map(([name]) => name).sort(), Object.keys(expected).sort(), "No missing, duplicate or unexpected submitted fields");
  assert.deepEqual(Object.fromEntries(actual.fields), expected);
}
function assertNoUnexpectedRequests(intercepted) {
  assert.deepEqual(intercepted.unexpectedPosts, [], "No legacy contact API or unexpected destination may receive a POST");
  assert.deepEqual(intercepted.unexpectedProviderRequests, [], "All provider requests must match the supplied CRM export");
}

export async function checkZohoContact(page, base, intercepted) {
  const initialSubmissions = intercepted.submissions.length;
  for (const [index, department] of DEPARTMENTS.entries()) {
    await page.goto(new URL("/contact-us/", base).href, { waitUntil: "load" });
    const form = page.locator(".contact-form");
    assert.equal(await form.getAttribute("id"), "webform5653678000075232001");
    assert.equal(await form.getAttribute("name"), "WebToLeads5653678000075232001");
    assert.equal(await form.getAttribute("action"), ZOHO_CONTACT_ACTION);
    assert.equal((await form.getAttribute("method"))?.toUpperCase(), "POST");
    assert.equal((await form.getAttribute("accept-charset"))?.toUpperCase(), "UTF-8");
    for (const name of REQUIRED_FIELDS) assert.notEqual(await form.locator(`[name="${name}"]`).getAttribute("required"), null, `${name} must be required`);
    assert.equal(await form.locator('[name="Company"]').getAttribute("required"), null, "Company is optional in the CRM export");
    for (const [name, limit] of Object.entries({ "First Name": "40", "Last Name": "80", Email: "100", Company: "200", Mobile: "30", LEADCF9: "255" })) {
      assert.equal(await form.locator(`[name="${name}"]`).getAttribute("maxlength"), limit);
    }
    for (const [name, value] of Object.entries(HIDDEN_FIELDS)) {
      assert.equal(await form.locator(`[name="${name}"]`).inputValue(), value);
      assert.equal(await form.locator(`[name="${name}"]`).isVisible(), false);
    }
    assert.deepEqual(await form.locator('select[name="LEADCF2"] option').evaluateAll((options) => options.map((option) => option.value)), ["", ...DEPARTMENTS]);
    const submit = form.locator('button[type="submit"]');
    await submit.click();
    assert.equal(await form.evaluate((element) => element.checkValidity()), false);
    assert.equal(intercepted.submissions.length, initialSubmissions + index, "Empty form must not submit");
    const values = index === 1 ? { ...VALUES, Company: "" } : VALUES;
    await fillContact(form, department, values);
    if (index === 0) {
      for (const name of REQUIRED_FIELDS) {
        const field = form.locator(`[name="${name}"]`);
        if (name === "LEADCF2") await field.evaluate((element) => { element.selectedIndex = 0; element.dispatchEvent(new Event("change", { bubbles: true })); });
        else await field.fill("");
        await submit.click();
        assert.equal(await field.evaluate((element) => element.checkValidity()), false, `${name} must block empty submission`);
        assert.equal(intercepted.submissions.length, initialSubmissions);
        if (name === "LEADCF2") await field.selectOption(department); else await field.fill(values[name]);
      }
      const email = form.locator('[name="Email"]');
      await email.fill("invalid-email");
      await submit.click();
      assert.equal(await email.evaluate((element) => element.validity.typeMismatch), true);
      assert.equal(intercepted.submissions.length, initialSubmissions);
      await email.fill(values.Email);
    }
    assert.equal(await form.evaluate((element) => element.checkValidity()), true);
    let release;
    intercepted.replyNext({ wait: new Promise((resolve) => { release = resolve; }) });
    try {
      await submit.click();
      await page.waitForFunction(() => document.querySelector('.contact-form button[type="submit"]')?.disabled);
      await form.evaluate((element) => element.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
      await page.waitForTimeout(100);
      assert.equal(intercepted.submissions.length, initialSubmissions + index + 1, "Repeated submits must not create duplicate CRM requests");
      assertPayload(intercepted.submissions.at(-1), department, values);
    } finally { release(); }
    await form.getByRole("status").filter({ hasText: SUCCESS_MESSAGE }).waitFor();
    assert.equal(page.url(), new URL("/contact-us/", base).href, "Splash confirmation stays on the contact page");
    await page.waitForFunction(() => !document.querySelector('.contact-form button[type="submit"]')?.disabled);
    for (const name of Object.keys(values)) assert.equal(await form.locator(`[name="${name}"]`).inputValue(), "", "Accepted submission resets visitor fields");
    assert.equal(await form.locator('[name="LEADCF2"]').inputValue(), "");
    for (const [name, value] of Object.entries(HIDDEN_FIELDS)) assert.equal(await form.locator(`[name="${name}"]`).inputValue(), value, "Reset preserves CRM routing fields");
    assertNoUnexpectedRequests(intercepted);
  }
  return { submissions: intercepted.submissions.length - initialSubmissions, liveProviderRequests: 0 };
}

export async function checkZohoContactFailures(page, base, intercepted) {
  const initialSubmissions = intercepted.submissions.length;
  const failures = [
    { name: "CRM rejection", json: { actionsubmit: "error_msg", message: "Local CRM rejection" } },
    { name: "CAPTCHA rejection", json: { actionsubmit: "Splash Message", invalidCaptcha: "true", actionvalue: "Local CAPTCHA rejection" } },
    { name: "HTTP failure", status: 503, json: { actionsubmit: "Splash Message", actionvalue: SUCCESS_MESSAGE } },
    { name: "Unknown JSON", json: { unexpected: true } },
    { name: "Unexpected HTML", body: "<html><body><h1>Unexpected provider response</h1><script>window.__unsafeProviderHtml = true</script></body></html>" },
    { name: "Network failure", abort: "failed" },
  ];
  for (const failure of failures) {
    await page.goto(new URL("/contact-us/", base).href, { waitUntil: "load" });
    const form = page.locator(".contact-form");
    await fillContact(form, DEPARTMENTS[0]);
    intercepted.replyNext(failure);
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => {
      const form = document.querySelector(".contact-form");
      return !form.querySelector('button[type="submit"]').disabled && form.querySelector('[role="status"]').textContent.trim();
    });
    assertPayload(intercepted.submissions.at(-1), DEPARTMENTS[0]);
    assert.equal(page.url(), new URL("/contact-us/", base).href, `${failure.name} must preserve the contact page`);
    assert.notEqual((await form.getByRole("status").textContent()).trim(), SUCCESS_MESSAGE, `${failure.name} must not report acceptance`);
    for (const [name, value] of Object.entries(VALUES)) assert.equal(await form.locator(`[name="${name}"]`).inputValue(), value, `${failure.name} preserves ${name}`);
    assert.equal(await form.locator('[name="LEADCF2"]').inputValue(), DEPARTMENTS[0]);
    assert.equal(await page.evaluate(() => window.__unsafeProviderHtml), undefined, "Provider HTML must never execute in the website");
    assertNoUnexpectedRequests(intercepted);
  }
  assert.equal(intercepted.submissions.length - initialSubmissions, failures.length);
  return { cases: failures.map(({ name }) => name), submissions: failures.length, liveProviderRequests: 0 };
}

export async function checkZohoContactWithoutJavaScript(browser, base) {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce", serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort("blockedbyclient"));
    const intercepted = await interceptZohoContact(context, base);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(new URL("/contact-us/", base).href, { waitUntil: "load" });
    const form = page.locator(".contact-form");
    assert.equal(await form.locator('button[type="submit"]').isDisabled(), true, "The AJAX-only export must not submit as a document without JavaScript");
    const fallback = page.locator(".contact-form-section noscript");
    assert.equal(await fallback.isVisible(), true);
    assert.match(await fallback.textContent(), /JavaScript/i);
    assert.equal(await fallback.locator('a[href^="tel:"]').count(), 1);
    assert.equal(await fallback.locator('a[href^="mailto:"]').count(), 1);
    await fillContact(form, DEPARTMENTS[0]);
    await form.locator('[name="LEADCF9"]').press("Enter");
    await page.waitForTimeout(100);
    assert.equal(intercepted.submissions.length, 0, "No JavaScript must not generate a misleading native submission");
    assertNoUnexpectedRequests(intercepted);
    return { submissions: 0, liveProviderRequests: 0, fallback: "Call or email" };
  } finally { await context.close(); }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactHandler } from "../lib/contact-request.ts";
import { createNewsletterHandler, MAX_NEWSLETTER_BODY_BYTES } from "../lib/newsletter-request.ts";
import { createMockFormStore, mockStateEnvironment, mockConsentVersions } from "./helpers/mock-form-store.mjs";

const env = {
  ...mockStateEnvironment,
  BREVO_API_KEY: "synthetic-test-key-not-a-credential",
  CONTACT_FROM_EMAIL: "forms@example.invalid",
  CONTACT_TO_EMAIL: "team@example.invalid",
  BREVO_NEWSLETTER_LIST_ID: "42",
  BREVO_NEWSLETTER_DOI_TEMPLATE_ID: "7",
  BREVO_NEWSLETTER_REDIRECT_URL: "https://acexperts.ae/",
};
const enquiry = {
  firstName: "Test", lastName: "Visitor", email: "visitor@example.invalid",
  company: "Test", phone: "", mobile: "+971500000000", service: "Repairs",
  message: "Synthetic enquiry. Do not deliver.", website: "",
};
const signup = { email: "subscriber@example.invalid", consent: true, website: "", ...mockConsentVersions };
const accepted = () => Response.json({ messageId: "<synthetic-receipt@example.invalid>" }, { status: 201 });
function request(body, headers = {}, rawBody) {
  return new Request("https://acexperts.ae/api/contact/", {
    method: "POST", headers: { origin: "https://acexperts.ae", "content-type": "application/json", ...headers },
    body: rawBody ?? JSON.stringify(body), duplex: "half",
  });
}

test("contact delivery uses configured recipient/sender and returns success only after a receipt", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const handler = createContactHandler(undefined, { env, store: createMockFormStore(), fetch: async (url, init) => {
    calls++;
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(init.headers["api-key"], env.BREVO_API_KEY);
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    const payload = JSON.parse(init.body);
    assert.deepEqual(payload.to, [{ email: env.CONTACT_TO_EMAIL }]);
    assert.equal(payload.sender.email, env.CONTACT_FROM_EMAIL);
    assert.equal(payload.replyTo.email, enquiry.email);
    assert.match(payload.headers.idempotencyKey, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    assert.ok(payload.textContent.includes("<script>"));
    assert.ok(!payload.htmlContent.includes("<script>"));
    assert.ok(payload.htmlContent.includes("&lt;script&gt;"));
    await pending;
    return accepted();
  } });
  let complete = false;
  const responsePromise = handler(request({ ...enquiry, message: "<script>alert('test')</script>" })).then((result) => { complete = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(complete, false);
  release();
  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /accepted for delivery/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("contact deduplicates concurrent and reordered normalized submissions without claiming pending delivery", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const handler = createContactHandler(undefined, { env, store: createMockFormStore(), fetch: async () => { calls++; await pending; return accepted(); } });
  const bodies = [enquiry, { ...enquiry, firstName: " Test ", email: "VISITOR@example.invalid" }, Object.fromEntries(Object.entries(enquiry).reverse())];
  const first = handler(request(bodies[0]));
  await new Promise((resolve) => setImmediate(resolve));
  const responses = await Promise.all(bodies.slice(1).map((body) => handler(request(body))));
  for (const response of responses) {
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /already being processed/);
  }
  assert.equal(calls, 1);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await handler(request(bodies[1]))).status, 200);
  assert.equal(calls, 1);
});

test("contact dedupe expires after 30 minutes; changed enquiries still send", async () => {
  let now = 1000;
  let calls = 0;
  const handler = createContactHandler(() => now, { env, store: createMockFormStore(() => now), fetch: async () => { calls++; return accepted(); } });
  await handler(request(enquiry));
  await handler(request({ ...enquiry, message: "A separate synthetic enquiry" }));
  assert.equal(calls, 2);
  now += 30 * 60_000;
  await handler(request(enquiry));
  assert.equal(calls, 3);
});

test("contact rejects invalid data before sending to a configured provider", async () => {
  let calls = 0;
  const handler = createContactHandler(undefined, { env, store: createMockFormStore(), fetch: async () => { calls++; return accepted(); } });
  for (const body of [{ ...enquiry, email: "bad" }, { ...enquiry, website: "spam" }, { ...enquiry, to: "attacker@example.invalid" }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test("contact provider rejection never exposes upstream data and can retry after cooldown", async () => {
  let now = 1000;
  let calls = 0;
  const handler = createContactHandler(() => now, { env, store: createMockFormStore(() => now), fetch: async () => {
    calls++;
    return calls === 1 ? Response.json({ message: "private provider debug", key: env.BREVO_API_KEY }, { status: 401 }) : accepted();
  } });
  const response = await handler(request(enquiry));
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.ok(!text.includes("private provider debug") && !text.includes(env.BREVO_API_KEY));
  assert.equal((await handler(request(enquiry))).status, 502);
  assert.equal(calls, 1);
  now += 60_000;
  assert.equal((await handler(request(enquiry))).status, 200);
  assert.equal(calls, 2);
});

test("provider 5xx, transport errors, invalid receipt and unexpected 2xx remain uncertain", async () => {
  const failures = [
    async () => new Response("upstream", { status: 500 }),
    async () => { throw new Error("network details"); },
    async () => Response.json({}, { status: 201 }),
    async () => new Response("not json", { status: 201 }),
    async () => Response.json({ messageId: "id" }, { status: 200 }),
  ];
  for (const failure of failures) {
    let calls = 0;
    const handler = createContactHandler(undefined, { env, store: createMockFormStore(), fetch: async (...args) => { calls++; return failure(...args); } });
    const response = await handler(request(enquiry));
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /could not confirm/);
    await handler(request(enquiry));
    assert.equal(calls, 1, "uncertain outcomes must not be automatically resent");
  }
});

test("provider 408 and 409 remain uncertain across channels, expiry windows and new handlers", async () => {
  for (const [channel, createHandler, body] of [
    ["contact", createContactHandler, enquiry],
    ["newsletter", createNewsletterHandler, signup],
  ]) {
    for (const providerStatus of [408, 409]) {
      let now = 1000;
      let calls = 0;
      const store = createMockFormStore(() => now);
      const options = { env, store, fetch: async () => {
        calls++;
        return Response.json({ message: "private provider conflict/timeout details" }, { status: providerStatus });
      } };
      const initial = await createHandler(() => now, options)(request(body));
      assert.equal(initial.status, 502, `${channel} provider ${providerStatus}`);
      const initialMessage = (await initial.json()).message;
      assert.match(initialMessage, /could not confirm/);
      assert.ok(!initialMessage.includes("private provider"));
      assert.equal([...store.records.values()][0].status, "uncertain");
      assert.equal([...store.records.values()][0].retryAfter, null);
      for (const elapsed of [60_001, 30 * 60_000 + 1]) {
        now += elapsed;
        const repeated = await createHandler(() => now, options)(request(body));
        assert.equal(repeated.status, 502);
        assert.match((await repeated.json()).message, /could not confirm/);
        assert.equal(calls, 1, `${channel} provider ${providerStatus} must not resend after ${elapsed}ms and handler reinitialization`);
        assert.equal([...store.records.values()][0].status, "uncertain");
      }
    }
  }
});

test("provider timeout aborts the request, reports uncertainty, and suppresses retries", async () => {
  let signal;
  let calls = 0;
  const handler = createContactHandler(undefined, { env, store: createMockFormStore(), timeoutMs: 10, fetch: async (_url, init) => {
    calls++;
    signal = init.signal;
    return new Promise(() => {});
  } });
  const response = await handler(request(enquiry));
  assert.equal(response.status, 504);
  assert.equal(signal.aborted, true);
  assert.match((await response.json()).message, /could not confirm/);
  assert.equal((await handler(request(enquiry))).status, 504);
  assert.equal(calls, 1);
});

test("provider timeout also bounds a stalled success-response body", async () => {
  const handler = createContactHandler(undefined, { env, store: createMockFormStore(), timeoutMs: 10, fetch: async () => new Response(new ReadableStream(), { status: 201 }) });
  assert.equal((await handler(request(enquiry))).status, 504);
});

test("missing or malformed configuration fails closed without a provider request", async () => {
  const noNetwork = () => { assert.fail("Unconfigured forms must not make a network request"); };
  for (const invalid of [{}, { ...env, CONTACT_TO_EMAIL: "invalid" }, { ...env, CONTACT_FROM_EMAIL: undefined }, { ...env, BREVO_API_KEY: "bad\nkey" }]) {
    assert.equal((await createContactHandler(undefined, { env: invalid, store: createMockFormStore(), fetch: noNetwork })(request(enquiry))).status, 503);
  }
  for (const invalid of [{}, { ...env, BREVO_NEWSLETTER_LIST_ID: "0" }, { ...env, BREVO_NEWSLETTER_DOI_TEMPLATE_ID: "7.5" }, { ...env, BREVO_NEWSLETTER_REDIRECT_URL: "http://example.invalid" }]) {
    const response = await createNewsletterHandler(undefined, { env: invalid, store: createMockFormStore(), fetch: noNetwork })(request(signup));
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /not been sent or saved/);
  }
});

test("newsletter initiates double opt-in with explicit consent and no tracking consent", async () => {
  for (const status of [201]) {
    let calls = 0;
    const handler = createNewsletterHandler(undefined, { env, store: createMockFormStore(), fetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.brevo.com/v3/contacts/doubleOptinConfirmation");
      assert.deepEqual(JSON.parse(init.body), {
        email: signup.email, includeListIds: [42], templateId: 7,
        redirectionUrl: "https://acexperts.ae/", contactPixelTrackingConsent: false,
      });
      return new Response(null, { status });
    } });
    const response = await handler(request(signup));
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /confirm your email to subscribe/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const duplicate = await handler(request({ ...signup, email: "SUBSCRIBER@example.invalid" }));
    assert.equal(duplicate.status, 200);
    assert.equal(calls, 1);
  }
});

test("newsletter rejects missing/fake consent, spam traps, invalid addresses and unknown fields", async () => {
  for (const body of [
    null, [], { ...signup, consent: false }, { ...signup, consent: "true" }, { email: signup.email },
    { ...signup, website: "spam" }, { ...signup, admin: true }, { ...signup, email: "invalid" },
    { ...signup, email: "\nsubscriber@example.invalid" }, { ...signup, email: "a".repeat(255) },
  ]) {
    const handler = createNewsletterHandler(undefined, { env, store: createMockFormStore(), fetch: () => { assert.fail("Invalid signup reached provider"); } });
    assert.equal((await handler(request(body))).status, 400);
  }
});

test("newsletter duplicate/provider rejection and timeout never claim subscription", async () => {
  for (const status of [200, 204, 400, 401, 429, 500]) {
    const handler = createNewsletterHandler(undefined, { env, store: createMockFormStore(), fetch: async () => status === 204
      ? new Response(null, { status })
      : Response.json({ code: "duplicate_parameter", message: "private details" }, { status }) });
    const response = await handler(request(signup));
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("private details"));
  }
  const timeout = createNewsletterHandler(undefined, { env, store: createMockFormStore(), timeoutMs: 10, fetch: async () => new Promise(() => {}) });
  assert.equal((await timeout(request(signup))).status, 504);
});

test("newsletter shares origin, body, media, and global abuse guards", async () => {
  const handler = createNewsletterHandler(undefined, { env: {} });
  assert.equal((await handler(request(signup, { origin: "https://attacker.invalid" }))).status, 403);
  assert.equal((await handler(request(signup, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handler(request(signup, { "content-encoding": "gzip" }))).status, 415);
  assert.equal((await handler(request(signup, {}, "{"))).status, 400);
  assert.equal((await handler(request(signup, { "content-length": "1" }, "x".repeat(MAX_NEWSLETTER_BODY_BYTES + 1)))).status, 413);
  let now = 1000;
  const limited = createNewsletterHandler(() => now, { env: {} });
  for (let index = 0; index < 10; index++) assert.equal((await limited(request(signup, { "x-forwarded-for": `192.0.2.${index}` }))).status, 503);
  const response = await limited(request(signup));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  now += 60_000;
  assert.equal((await limited(request(signup))).status, 503);
});

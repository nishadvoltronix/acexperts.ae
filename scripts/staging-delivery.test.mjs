import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContactHandler } from "../lib/contact-request.ts";
import { createNewsletterHandler } from "../lib/newsletter-request.ts";
import { NEWSLETTER_CONSENT_TEXT } from "../lib/newsletter-consent.ts";
import { createMockFormStore, mockStateEnvironment, mockConsentVersions } from "./helpers/mock-form-store.mjs";

// Hermetic staging evidence: every handler receives synthetic configuration and
// a fake fetch and explicitly injected test store. No test reads credentials or
// contacts Brevo/PostgreSQL. Separate shared-store tests exercise real PostgreSQL.
const canary = "synthetic-staging-secret-canary-not-a-real-api-key";
const environment = {
  ...mockStateEnvironment,
  BREVO_API_KEY: canary,
  CONTACT_FROM_EMAIL: "staging-sender@example.invalid",
  CONTACT_TO_EMAIL: "staging-recipient@example.invalid",
  BREVO_NEWSLETTER_LIST_ID: "123",
  BREVO_NEWSLETTER_DOI_TEMPLATE_ID: "456",
  BREVO_NEWSLETTER_REDIRECT_URL: "https://staging.example.invalid/confirmed/",
};
const enquiry = {
  firstName: "Staging", lastName: "Test", email: "visitor@example.invalid",
  company: "", phone: "", mobile: "+971500000000", service: "Repairs",
  message: "Synthetic staging enquiry. Do not deliver.", website: "",
};
const signup = { email: "subscriber@example.invalid", consent: true, website: "", ...mockConsentVersions };
const forms = [
  {
    name: "contact", create: createContactHandler, body: enquiry, rateLimit: 30,
    required: ["BREVO_API_KEY", "CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL"],
    unique: (index) => ({ ...enquiry, message: `Synthetic staging enquiry ${index}. Do not deliver.` }),
  },
  {
    name: "newsletter", create: createNewsletterHandler, body: signup, rateLimit: 10,
    required: ["BREVO_API_KEY", "BREVO_NEWSLETTER_LIST_ID", "BREVO_NEWSLETTER_DOI_TEMPLATE_ID", "BREVO_NEWSLETTER_REDIRECT_URL", "PRIVACY_NOTICE_URL", "PRIVACY_NOTICE_VERSION", "NEWSLETTER_CONSENT_RETENTION_DAYS"],
    unique: (index) => ({ ...signup, email: `subscriber-${index}@example.invalid` }),
  },
];
const fixedTime = () => 1000;
const accepted = () => Response.json({ messageId: "<synthetic-staging-receipt@example.invalid>" }, { status: 201 });

function request(form, body = form.body, origin = "https://acexperts.ae", headers = {}) {
  return new Request(`https://acexperts.ae/api/${form.name}/`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  });
}

async function safeResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const text = await response.text();
  assert.ok(!text.includes(canary), "The synthetic API-key canary must not enter a public response");
  assert.ok(!text.includes("UPSTREAM_PRIVATE_DETAILS"), "Upstream debug text must not enter a public response");
  assert.ok(!text.includes(environment.FORM_STATE_SECRET), "HMAC secret must not enter a public response");
  assert.ok(!text.includes("synthetic-db-password"), "Database password must not enter a public response");
  assert.ok(!JSON.stringify([...response.headers]).includes(canary));
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body), ["message"]);
  assert.equal(typeof body.message, "string");
  return body.message;
}

test("staging environment contract matches implementation and thirteen empty server-only .env.example settings", async () => {
  const [sample, ...implementation] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../lib/form-delivery.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/form-security.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/form-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/form-submissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/newsletter-request.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/privacy-notice.ts", import.meta.url), "utf8"),
  ]);
  const sampleEntries = [...sample.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)]
    .map((match) => [match[1], match[2].trim()]);
  const expected = [...Object.keys(environment), "FORM_ALLOWED_ORIGINS"].sort();
  assert.equal(expected.length, 13);
  assert.deepEqual(sampleEntries.map(([name]) => name).sort(), expected);
  assert.ok(sampleEntries.every(([name, value]) => !name.startsWith("NEXT_PUBLIC_") && value === ""));
  const implementationNames = [...new Set([...implementation.join("\n").matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]))].sort();
  assert.deepEqual(implementationNames, expected);
});

for (const form of forms) {
  test(`${form.name}: every missing required setting returns 503 with zero provider calls and no secret echo`, async (context) => {
    let calls = 0;
    for (const name of form.required) {
      for (const missing of [undefined, ""]) {
        const env = { ...environment, [name]: missing };
        const handler = form.create(fixedTime, { env, store: createMockFormStore(fixedTime), fetch: async () => { calls++; return accepted(); } });
        const message = await safeResponse(await handler(request(form)), 503);
        assert.match(message, /not been sent/);
        assert.ok(!message.includes(name));
      }
    }
    assert.equal(calls, 0);
    context.diagnostic(`${form.required.length * 2} absent/empty-setting cases; provider calls: ${calls}.`);
  });

  test(`${form.name}: provider errors and receipts cannot echo synthetic credentials or upstream details`, async (context) => {
    const sensitive = `${canary}:UPSTREAM_PRIVATE_DETAILS`;
    const responses = [
      { label: "401", fetch: async () => Response.json({ key: canary, message: sensitive }, { status: 401 }), status: 502 },
      { label: "403", fetch: async () => new Response(sensitive, { status: 403 }), status: 502 },
      { label: "429", fetch: async () => new Response(sensitive, { status: 429 }), status: 502 },
      { label: "500", fetch: async () => new Response(sensitive, { status: 500 }), status: 502 },
      { label: "network rejection", fetch: async () => { throw new Error(sensitive); }, status: 502 },
      { label: "201", fetch: async () => Response.json({ messageId: sensitive, apiKey: canary, message: sensitive }, { status: 201 }), status: 200 },
      { label: "unexpected 200", fetch: async () => Response.json({ messageId: sensitive }, { status: 200 }), status: 502 },
      { label: "timeout", fetch: async () => new Promise(() => {}), status: 504 },
    ];
    if (form.name === "contact") responses.push({
      label: "malformed receipt", fetch: async () => new Response(sensitive, { status: 201 }), status: 502,
    });
    for (const scenario of responses) {
      const handler = form.create(fixedTime, { env: { ...environment }, store: createMockFormStore(fixedTime), fetch: scenario.fetch, timeoutMs: 20 });
      await safeResponse(await handler(request(form)), scenario.status);
    }
    context.diagnostic(`${responses.length} synthetic provider outcomes checked; no real provider calls.`);
  });

  test(`${form.name}: independent handlers and reinitialization share accepted/pending duplicate state through the injected store`, async (context) => {
    const calls = [];
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const store = createMockFormStore(fixedTime);
    const options = { env: { ...environment }, store, fetch: async (url, init) => {
      calls.push({ url, payload: JSON.parse(init.body) });
      await pending;
      return accepted();
    } };
    const first = form.create(fixedTime, options);
    const second = form.create(fixedTime, options);
    const initial = first(request(form));
    await new Promise((resolve) => setImmediate(resolve));
    const duplicate = await second(request(form));
    assert.match(await safeResponse(duplicate, 409), /already being processed/);
    assert.equal(calls.length, 1);
    release();
    assert.equal((await initial).status, 200);
    assert.equal((await second(request(form))).status, 200);
    assert.equal(calls.length, 1, "Both independently created handlers use the same completed claim");
    assert.equal((await first(request(form))).status, 200);
    const reinitialized = form.create(fixedTime, options);
    assert.equal((await reinitialized(request(form))).status, 200);
    assert.equal(calls.length, 1, "Handler initialization does not reset the injected store");
    if (form.name === "contact") {
      assert.equal(calls[0].payload.headers.idempotencyKey, [...store.records.values()][0].requestId,
        "Provider idempotency key is the store-owned claim ID");
    }
    context.diagnostic("Three handler initializations share one injected test store: one provider mock call; pending duplicate 409, accepted duplicate 200. This is orchestration evidence, not real database/restart/deployed-cluster evidence.");
  });

  test(`${form.name}: shared injected budget remains ${form.rateLimit}/minute across handlers and reinitialization`, async (context) => {
    let calls = 0;
    let now = 1000;
    const options = { env: { ...environment }, store: createMockFormStore(() => now), fetch: async () => { calls++; return accepted(); } };
    const handlers = Array.from({ length: 3 }, () => form.create(() => now, options));
    for (let index = 0; index < form.rateLimit; index++) {
      const response = await handlers[index % handlers.length](request(form, form.unique(index), "https://acexperts.ae", {
        "x-forwarded-for": `192.0.2.${index + 1}`,
      }));
      assert.equal(response.status, 200);
    }
    for (const handler of [...handlers, form.create(() => now, options)]) {
      const limited = await handler(request(form, form.unique(form.rateLimit)));
      assert.ok(Number(limited.headers.get("retry-after")) >= 1 && Number(limited.headers.get("retry-after")) <= 60);
      await safeResponse(limited, 429);
    }
    assert.equal(calls, form.rateLimit);
    now += 60_000;
    assert.equal((await form.create(() => now, options)(request(form, form.unique(form.rateLimit)))).status, 200);
    assert.equal(calls, form.rateLimit + 1);
    context.diagnostic(`${form.rateLimit} total provider mock calls across four handler initializations in one test-store minute; spoofed forwarded IPs did not multiply the budget. Real PostgreSQL concurrency is tested separately.`);
  });
}

test("staging origins accept only exact configured HTTPS origins and reject cross-site requests", async (context) => {
  const previous = process.env.FORM_ALLOWED_ORIGINS;
  context.after(() => {
    if (previous === undefined) delete process.env.FORM_ALLOWED_ORIGINS;
    else process.env.FORM_ALLOWED_ORIGINS = previous;
  });
  process.env.FORM_ALLOWED_ORIGINS = "https://staging.example.invalid, https://review.example.invalid:8443";
  for (const form of forms) {
    for (const origin of ["https://staging.example.invalid", "https://review.example.invalid:8443"]) {
      let calls = 0;
      const handler = form.create(fixedTime, { env: environment, store: createMockFormStore(fixedTime), fetch: async () => { calls++; return accepted(); } });
      await safeResponse(await handler(request(form, form.body, origin)), 200);
      assert.equal(calls, 1);
    }
    const rejected = [
      "http://staging.example.invalid", "https://staging.example.invalid/",
      "https://staging.example.invalid/path", "https://staging.example.invalid:8443",
      "https://staging.example.invalid.attacker.invalid", "https://other.example.invalid",
      "https://user@staging.example.invalid", "https://*.example.invalid", "null",
    ];
    let calls = 0;
    for (const origin of rejected) {
      const handler = form.create(fixedTime, { env: environment, store: createMockFormStore(fixedTime), fetch: async () => { calls++; return accepted(); } });
      await safeResponse(await handler(request(form, form.body, origin)), 403);
    }
    const handler = form.create(fixedTime, { env: environment, store: createMockFormStore(fixedTime), fetch: async () => { calls++; return accepted(); } });
    await safeResponse(await handler(request(form, form.body, "https://staging.example.invalid", { "sec-fetch-site": "cross-site" })), 403);
    assert.equal(calls, 0);
  }
});

test("malformed staging allowlist settings fail closed even if the Origin matches verbatim", async (context) => {
  const previous = process.env.FORM_ALLOWED_ORIGINS;
  context.after(() => {
    if (previous === undefined) delete process.env.FORM_ALLOWED_ORIGINS;
    else process.env.FORM_ALLOWED_ORIGINS = previous;
  });
  const invalid = [
    "http://staging.example.invalid", "https://staging.example.invalid/",
    "https://staging.example.invalid/path", "https://user@staging.example.invalid", "*", "null",
  ];
  let calls = 0;
  for (const form of forms) {
    for (const origin of invalid) {
      process.env.FORM_ALLOWED_ORIGINS = origin;
      const handler = form.create(fixedTime, { env: environment, store: createMockFormStore(fixedTime), fetch: async () => { calls++; return accepted(); } });
      await safeResponse(await handler(request(form, form.body, origin)), 403);
    }
  }
  assert.equal(calls, 0);
});

test("newsletter consent is required before provider contact; acceptance requests confirmation without changing unsubscribe flags", async (context) => {
  const form = forms[1];
  let calls = 0;
  const captured = [];
  const store = createMockFormStore(fixedTime);
  const options = { env: environment, store, fetch: async (url, init) => {
    assert.equal(store.consents.length, 1, "Checked consent must commit before provider contact");
    assert.equal(store.consents[0].deliveryStatus, "pending", "Provider initiation is not confirmation");
    calls++;
    captured.push({ url, payload: JSON.parse(init.body) });
    return accepted();
  } };
  for (const consent of [undefined, false, "true", "on", 1, null]) {
    const handler = form.create(fixedTime, options);
    await safeResponse(await handler(request(form, { ...signup, consent })), 400);
  }
  assert.equal(calls, 0);
  const message = await safeResponse(await form.create(fixedTime, options)(request(form)), 200);
  assert.equal(calls, 1);
  assert.equal(store.consents.length, 1);
  const evidence = store.consents[0];
  assert.match(evidence.emailHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.wording, NEWSLETTER_CONSENT_TEXT);
  assert.equal(evidence.wordingVersion, signup.consentVersion);
  assert.equal(evidence.noticeVersion, signup.noticeVersion);
  assert.equal(evidence.noticeUrl, environment.PRIVACY_NOTICE_URL);
  assert.equal(evidence.retentionDays, 30);
  assert.equal(evidence.origin, "https://acexperts.ae");
  assert.equal(evidence.listId, 123);
  assert.equal(evidence.templateId, 456);
  assert.equal(evidence.deliveryStatus, "accepted");
  assert.ok(!JSON.stringify(evidence).includes(signup.email), "Consent evidence uses a keyed email digest, not the raw address");
  assert.ok(!Object.hasOwn(evidence, "confirmedAt"), "Initiation must not invent a confirmation event");
  assert.match(message, /confirm your email to subscribe/);
  assert.deepEqual(captured, [{
    url: "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
    payload: {
      email: signup.email, includeListIds: [123], templateId: 456,
      redirectionUrl: environment.BREVO_NEWSLETTER_REDIRECT_URL, contactPixelTrackingConsent: false,
    },
  }]);
  context.diagnostic("Local orchestration proof only: checked, versioned consent enters the injected store before DOI initiation; payload does not overwrite unsubscribe/blocklist fields and contains no tracking consent. Received DOI, list eligibility and withdrawal/suppression still require authorized live account verification.");
});

for (const form of forms) {
  test(`${form.name}: missing durable-store configuration and explicit absent store fail closed without provider calls`, async () => {
    let calls = 0;
    const noSend = async () => { calls++; return accepted(); };
    for (const setting of ["FORM_DATABASE_URL", "FORM_STATE_SECRET", "FORM_STORE_NAMESPACE"]) {
      for (const missing of [undefined, ""]) {
        const options = { env: { ...environment, [setting]: missing }, fetch: noSend };
        // Missing URL makes createPostgresFormStore return null without opening a
        // connection. Missing key/scope disables even an explicitly injected store.
        if (setting !== "FORM_DATABASE_URL") options.store = createMockFormStore(fixedTime);
        await safeResponse(await form.create(fixedTime, options)(request(form)), 503);
      }
    }
    await safeResponse(await form.create(fixedTime, { env: environment, store: null, fetch: noSend })(request(form)), 503);
    assert.equal(calls, 0);
  });

  test(`${form.name}: rate/claim store failures fail closed and do not echo database details`, async () => {
    let calls = 0;
    for (const operation of ["consumeRate", "claim"]) {
      const store = createMockFormStore(fixedTime);
      store[operation] = async () => { throw new Error(`UPSTREAM_PRIVATE_DETAILS synthetic-db-password ${canary}`); };
      const handler = form.create(fixedTime, { env: environment, store, fetch: async () => { calls++; return accepted(); } });
      await safeResponse(await handler(request(form)), 503);
      assert.equal(store.consents.length, 0);
    }
    assert.equal(calls, 0);
  });

  test(`${form.name}: completion acknowledgement failure preserves uncertain ownership and suppresses repeat delivery`, async () => {
    let now = 1000;
    let calls = 0;
    const store = createMockFormStore(() => now);
    store.complete = async () => { throw new Error(`UPSTREAM_PRIVATE_DETAILS ${canary}`); };
    const options = { env: environment, store, fetch: async () => { calls++; return accepted(); } };
    const handler = form.create(() => now, options);
    assert.match(await safeResponse(await handler(request(form)), 502), /could not confirm/);
    assert.equal(calls, 1);
    assert.equal([...store.records.values()][0].status, "pending");
    now += 365 * 24 * 60 * 60_000;
    assert.match(await safeResponse(await form.create(() => now, options)(request(form)), 409), /already being processed/);
    assert.equal(calls, 1, "Unknown completion must never automatically expire and resend");
  });

  test(`${form.name}: lost claim acknowledgement prevents provider contact and keeps the claim blocked`, async () => {
    let now = 1000;
    let calls = 0;
    const store = createMockFormStore(() => now);
    const claim = store.claim;
    store.claim = async (...args) => {
      await claim(...args);
      throw new Error("UPSTREAM_PRIVATE_DETAILS: claim committed but acknowledgement lost");
    };
    const options = { env: environment, store, fetch: async () => { calls++; return accepted(); } };
    await safeResponse(await form.create(() => now, options)(request(form)), 503);
    assert.equal(calls, 0);
    assert.equal([...store.records.values()][0].status, "pending");
    store.claim = claim;
    now += 365 * 24 * 60 * 60_000;
    await safeResponse(await form.create(() => now, options)(request(form)), 409);
    assert.equal(calls, 0, "A possibly committed claim must not be taken over after acknowledgement loss");
  });

  test(`${form.name}: lost completion acknowledgement after commit reuses accepted state without resending`, async () => {
    let calls = 0;
    const store = createMockFormStore(fixedTime);
    const complete = store.complete;
    store.complete = async (...args) => {
      await complete(...args);
      throw new Error("UPSTREAM_PRIVATE_DETAILS: accepted completion committed but acknowledgement lost");
    };
    const options = { env: environment, store, fetch: async () => { calls++; return accepted(); } };
    await safeResponse(await form.create(fixedTime, options)(request(form)), 502);
    assert.equal([...store.records.values()][0].status, "accepted");
    await safeResponse(await form.create(fixedTime, options)(request(form)), 200);
    assert.equal(calls, 1);
  });

  test(`${form.name}: uncertain and timeout states remain suppressed across new handlers beyond normal expiry`, async () => {
    for (const timeout of [false, true]) {
      let now = 1000;
      let calls = 0;
      const store = createMockFormStore(() => now);
      const options = { env: environment, store, timeoutMs: 10, fetch: async () => {
        calls++;
        return timeout ? new Promise(() => {}) : new Response("UPSTREAM_PRIVATE_DETAILS", { status: 500 });
      } };
      const expected = timeout ? 504 : 502;
      await safeResponse(await form.create(() => now, options)(request(form)), expected);
      now += 365 * 24 * 60 * 60_000;
      await safeResponse(await form.create(() => now, options)(request(form)), expected);
      assert.equal(calls, 1);
      assert.equal([...store.records.values()][0].retryAfter, null);
    }
  });
}

test("newsletter rejects stale or missing consent and notice versions before recording or contacting provider", async () => {
  const form = forms[1];
  const mutations = [
    { consentVersion: undefined }, { consentVersion: "old-version" }, { consentVersion: null },
    { noticeVersion: undefined }, { noticeVersion: "old-policy" }, { noticeVersion: null },
  ];
  let calls = 0;
  for (const mutation of mutations) {
    const store = createMockFormStore(fixedTime);
    const handler = form.create(fixedTime, { env: environment, store, fetch: async () => { calls++; return accepted(); } });
    await safeResponse(await handler(request(form, { ...signup, ...mutation })), 400);
    assert.equal(store.consents.length, 0);
  }
  assert.equal(calls, 0);
});

test("newsletter malformed privacy URL, notice version and retention settings fail closed", async () => {
  const form = forms[1];
  let calls = 0;
  const mutations = [
    { PRIVACY_NOTICE_URL: "http://example.invalid/privacy/" },
    { PRIVACY_NOTICE_URL: "https://user:secret@example.invalid/privacy/" },
    { PRIVACY_NOTICE_VERSION: "policy version with spaces" },
    ...["0", "-1", "3651", "1.5", "30 days"].map((value) => ({ NEWSLETTER_CONSENT_RETENTION_DAYS: value })),
  ];
  for (const mutation of mutations) {
    const store = createMockFormStore(fixedTime);
    const handler = form.create(fixedTime, { env: { ...environment, ...mutation }, store, fetch: async () => { calls++; return accepted(); } });
    await safeResponse(await handler(request(form)), 503);
    assert.equal(store.consents.length, 0);
  }
  assert.equal(calls, 0);
});

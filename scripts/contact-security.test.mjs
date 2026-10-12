import assert from "node:assert/strict";
import { test } from "node:test";
import { createContactHandler as createProductionContactHandler, MAX_CONTACT_BODY_BYTES } from "../lib/contact-request.ts";

// Hermetic even when a developer has live delivery credentials in their environment.
const createContactHandler = (now) => createProductionContactHandler(now, {
  env: {},
  fetch: () => { throw new Error("Security tests must never contact a live provider"); },
});

const validBody = {
  firstName: "Test",
  lastName: "",
  email: "contact@example.invalid",
  company: "",
  phone: "",
  mobile: "+971500000000",
  service: "Repairs",
  message: "Synthetic enquiry.\nDo not deliver.",
};

function request(body = validBody, options = {}) {
  const { url = "https://acexperts.ae/api/contact/", headers = {}, rawBody } = options;
  return new Request(url, {
    method: "POST",
    headers: {
      origin: "https://acexperts.ae",
      "content-type": "application/json",
      ...headers,
    },
    body: rawBody ?? JSON.stringify(body),
    duplex: "half",
  });
}

test("unconfigured public form stays explicitly unsent and disables caching", async () => {
  const response = await createContactHandler()(request());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.message, /has not been sent/);
  assert.equal(body.message.includes(validBody.email), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("rejects filled honeypots and accepts the new AC/HVAC enquiry choices", async () => {
  const handler = createContactHandler();
  assert.equal((await handler(request({ ...validBody, website: "https://spam.invalid" }))).status, 400);
  assert.equal((await handler(request({ ...validBody, website: "" }))).status, 503);
  for (const service of ["Duct Cleaning", "HVAC Services"]) {
    assert.equal((await handler(request({ ...validBody, service }))).status, 503);
  }
});

test("accepts Other only with its conditional detail", async () => {
  const handler = createContactHandler();
  assert.equal((await handler(request({ ...validBody, service: "Other", otherService: "Duct cleaning" }))).status, 503);
  for (const otherService of [undefined, "", "  ", 12]) {
    assert.equal((await handler(request({ ...validBody, service: "Other", otherService }))).status, 400);
  }
  assert.equal((await handler(request({ ...validBody, otherService: "unexpected" }))).status, 400);
});

test("rejects unexpected fields, invalid types, invalid services, missing values, and excess lengths", async () => {
  const invalidBodies = [
    null, [], "text", { ...validBody, admin: "true" },
    { ...validBody, service: "<script>alert(1)</script>" },
    { ...validBody, firstName: " " }, { ...validBody, firstName: "A".repeat(101) },
    { ...validBody, lastName: "A".repeat(101) }, { ...validBody, company: "A".repeat(201) },
    { ...validBody, mobile: "1".repeat(31) }, { ...validBody, phone: "1".repeat(31) },
    { ...validBody, message: "A".repeat(5001) },
    { ...validBody, email: "invalid" }, { ...validBody, email: "a".repeat(243) + "@example.com" },
    { ...validBody, email: "test@example.invalid\r\nBcc: victim@example.invalid" },
    { ...validBody, phone: { $ne: null } }, { ...validBody, message: "bad\u0000text" },
    { ...validBody, service: "Other", otherService: "a".repeat(201) },
  ];
  const handler = createContactHandler();
  for (const body of invalidBodies) assert.equal((await handler(request(body))).status, 400);
  assert.equal((await handler(request(undefined, { rawBody: '{"__proto__":"unexpected"}' }))).status, 400);
});

test("rejects malformed JSON and returns generic errors without submitted data", async () => {
  const response = await createContactHandler()(request(undefined, { rawBody: '{"password":"private-value"' }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Unable to process this request." });
});

test("validates required mobile and optional phone without rejecting normal international formatting", async () => {
  const handler = createContactHandler();
  for (const number of ["+12025550100", "+971 (50) 000-0000", "04 824 0002", "050.000.0000"]) {
    assert.equal((await handler(request({ ...validBody, mobile: number, phone: number }))).status, 503);
  }
  for (const number of ["not-a-number", "123", "1".repeat(16), "++971500000000", "+971500000000;bad"]) {
    assert.equal((await handler(request({ ...validBody, mobile: number }))).status, 400);
    assert.equal((await handler(request({ ...validBody, phone: number }))).status, 400);
  }
  assert.equal((await handler(request({ ...validBody, mobile: "" }))).status, 400);
  assert.equal((await handler(request({ ...validBody, phone: " " }))).status, 503);
});

test("rejects non-JSON, encoded bodies, and malformed Content-Length", async () => {
  const handler = createContactHandler();
  for (const headers of [
    { "content-type": "text/plain" },
    { "content-type": "application/x-www-form-urlencoded" },
    { "content-type": "multipart/form-data; boundary=upload" },
    { "content-encoding": "gzip" },
  ]) assert.equal((await handler(request(undefined, { headers }))).status, 415);
  assert.equal((await handler(request(undefined, { headers: { "content-length": "bogus" } }))).status, 400);
  assert.equal((await handler(request(undefined, { headers: { "content-type": "application/json; charset=utf-8" } }))).status, 503);
});

test("rejects foreign, null, absent, or spoofed origins without trusting forwarding headers", async () => {
  const handler = createContactHandler();
  for (const origin of ["https://attacker.invalid", "null", "", "https://acexperts.ae.attacker.invalid", "https://acexperts.ae/"]) {
    assert.equal((await handler(request(undefined, {
      url: "https://attacker.invalid/api/contact/",
      headers: { origin, host: "attacker.invalid", "x-forwarded-host": "acexperts.ae", "x-forwarded-proto": "https" },
    }))).status, 403);
  }
  const missing = request();
  missing.headers.delete("origin");
  assert.equal((await handler(missing)).status, 403);
  assert.equal((await handler(request(undefined, { headers: { "sec-fetch-site": "cross-site" } }))).status, 403);
  assert.equal((await handler(request(undefined, { headers: { origin: "http://localhost:3001" } }))).status, 403);
});

test("allows canonical www and matching loopback origins for local form use", async () => {
  const handler = createContactHandler();
  for (const origin of ["https://www.acexperts.ae", "http://localhost:3001", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal((await handler(request(undefined, { url: `${origin}/api/contact/`, headers: { origin } }))).status, 503);
  }
});

test("allows explicit loopback hostname aliases only at the same protocol and port", async () => {
  for (const protocol of ["http", "https"]) {
    const handler = createContactHandler();
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      for (const originHost of ["localhost", "127.0.0.1", "[::1]"]) {
        const response = await handler(request(undefined, {
          url: `${protocol}://${host}:3112/api/contact/`,
          headers: { origin: `${protocol}://${originHost}:3112`, "sec-fetch-site": "same-origin" },
        }));
        assert.equal(response.status, 503, `${host} should accept the local alias ${originHost}`);
      }
    }
  }
});

test("loopback exceptions reject foreign hosts, wrong ports/schemes and malformed origins", async () => {
  const handler = createContactHandler();
  for (const origin of [
    "http://127.0.0.1:3113", "https://127.0.0.1:3112", "http://127.0.0.1",
    "http://localhost:3113", "http://[::1]:3113", "https://[::1]:3112",
    "http://attacker.invalid:3112", "http://localhost.attacker.invalid:3112",
    "http://127.0.0.2:3112", "http://0.0.0.0:3112", "http://2130706433:3112",
    "http://127.0.0.1:3112/", "http://127.0.0.1:3112/path", "http://127.0.0.1:3112?query=1",
    "http://127.0.0.1:3112#fragment", "http://user:password@127.0.0.1:3112",
  ]) {
    assert.equal((await handler(request(undefined, {
      url: "http://localhost:3112/api/contact/", headers: { origin },
    }))).status, 403, `Unexpectedly allowed ${origin}`);
  }
  assert.equal((await handler(request(undefined, {
    url: "http://localhost:3112/api/contact/",
    headers: { origin: "http://127.0.0.1:3112", "sec-fetch-site": "cross-site" },
  }))).status, 403);
  for (const url of ["http://attacker.invalid:3112/api/contact/", "https://acexperts.ae/api/contact/"]) {
    assert.equal((await handler(request(undefined, {
      url, headers: { origin: "http://127.0.0.1:3112", "x-forwarded-host": "localhost:3112" },
    }))).status, 403);
  }
});

test("bounds actual body bytes when the declared length is missing or dishonest", async () => {
  const oversized = JSON.stringify({ ...validBody, message: "x".repeat(MAX_CONTACT_BODY_BYTES) });
  const handler = createContactHandler();
  assert.equal((await handler(request(undefined, { rawBody: oversized }))).status, 413);
  assert.equal((await handler(request(undefined, { rawBody: oversized, headers: { "content-length": "1" } }))).status, 413);
  assert.equal((await handler(request(undefined, { headers: { "content-length": String(MAX_CONTACT_BODY_BYTES + 1) } }))).status, 413);
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_CONTACT_BODY_BYTES));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() { canceled = true; },
  });
  assert.equal((await handler(request(undefined, { rawBody: stream }))).status, 413);
  assert.equal(canceled, true);
});

test("rate limits before reading another body and cannot be bypassed with forged client IPs", async () => {
  let clock = 1000;
  const handler = createContactHandler(() => clock);
  for (let index = 0; index < 30; index++) {
    assert.equal((await handler(request(undefined, { headers: { "x-forwarded-for": `192.0.2.${index}` } }))).status, 503);
  }
  const limited = await handler(request(undefined, { rawBody: "malformed", headers: { "x-forwarded-for": "198.51.100.1" } }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  clock += 59_001;
  assert.equal((await handler(request())).headers.get("retry-after"), "1");
  clock += 999;
  assert.equal((await handler(request())).status, 503);
});

test("cancels a stalled request and responds with a generic timeout", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  const pending = createContactHandler()(request(undefined, { rawBody: stream }));
  context.mock.timers.tick(5000);
  const response = await pending;
  assert.equal(response.status, 408);
  assert.deepEqual(await response.json(), { message: "Unable to process this request." });
  assert.equal(canceled, true);
});

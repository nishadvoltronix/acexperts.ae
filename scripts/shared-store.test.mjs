import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Pool } from "pg";
import { createPostgresFormStore } from "../lib/form-store.ts";
import { createContactHandler } from "../lib/contact-request.ts";
import { createNewsletterHandler } from "../lib/newsletter-request.ts";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "../lib/newsletter-consent.ts";

const database = process.env.FORM_TEST_DATABASE_URL;
const skip = database ? false : "Set FORM_TEST_DATABASE_URL to an isolated local acexperts_test database to run real PostgreSQL integration tests.";
function databaseConfiguration(value) {
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    || decodeURIComponent(parsed.username) !== "acexperts_test"
    || decodeURIComponent(parsed.pathname) !== "/acexperts_test"
    || parsed.search || parsed.hash || /[?#]/.test(value)) throw new Error("Integration tests require the isolated local acexperts_test role/database.");
  return { host: parsed.hostname.replace(/^\[|\]$/g, ""), port: Number(parsed.port || 5432),
    user: "acexperts_test", password: decodeURIComponent(parsed.password), database: "acexperts_test",
    ssl: false, max: 4, connectionTimeoutMillis: 1500, query_timeout: 3000, statement_timeout: 2500 };
}
// A supplied but unsafe URL is an error, never a silent skip.
let adminConfiguration;
if (database) {
  try { adminConfiguration = databaseConfiguration(database); }
  catch { throw new Error("Refusing unsafe FORM_TEST_DATABASE_URL; use only the isolated local acexperts_test role/database."); }
}

async function fixture(run) {
  const scope = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool(adminConfiguration);
  admin.on("error", () => {});
  const stores = [];
  const env = {
    FORM_DATABASE_URL: database, FORM_STORE_NAMESPACE: scope, FORM_STATE_SECRET: "a".repeat(64),
    BREVO_API_KEY: "synthetic-test-key-not-a-credential", CONTACT_FROM_EMAIL: "forms@example.invalid",
    CONTACT_TO_EMAIL: "team@example.invalid", BREVO_NEWSLETTER_LIST_ID: "42", BREVO_NEWSLETTER_DOI_TEMPLATE_ID: "7",
    BREVO_NEWSLETTER_REDIRECT_URL: "https://acexperts.ae/", PRIVACY_NOTICE_URL: "https://example.invalid/privacy/",
    PRIVACY_NOTICE_VERSION: "test-policy-v1", NEWSLETTER_CONSENT_RETENTION_DAYS: "30",
  };
  const store = (overrides = {}) => {
    const result = createPostgresFormStore({ ...env, ...overrides });
    assert.ok(result, "The test fixture must produce a configured store.");
    stores.push(result);
    return result;
  };
  try {
    const version = await admin.query("SELECT version FROM acexperts_forms.schema_version WHERE singleton = true");
    assert.equal(version.rows[0]?.version, 1, "Apply db/migrations/001-form-state.sql to the isolated test database first.");
    await run({ scope, admin, env, store });
  } finally {
    await Promise.all(stores.map((instance) => instance.close().catch(() => {})));
    // Bound cleanup to this fixture's unpredictable namespace, never schema DDL.
    try {
      for (const table of ["consent_events", "submissions", "rate_limits", "namespace_settings"]) {
        await admin.query(`DELETE FROM acexperts_forms.${table} WHERE scope = $1`, [scope]);
      }
    } finally { await admin.end(); }
  }
}

function worker(env) {
  const child = fork(fileURLToPath(new URL("./helpers/shared-store-worker.mjs", import.meta.url)), [], {
    env: { ...process.env, FORM_TEST_DATABASE_URL: database, FORM_STORE_NAMESPACE: env.FORM_STORE_NAMESPACE,
      FORM_STATE_SECRET: env.FORM_STATE_SECRET, NODE_NO_WARNINGS: "1" },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const ready = new Promise((resolve, reject) => {
    child.once("message", (message) => message.ready ? resolve() : reject(new Error("Test worker did not become ready.")));
    child.once("error", () => reject(new Error("Test worker could not start.")));
    child.once("exit", () => reject(new Error("Test worker exited before readiness.")));
  });
  return async (message) => {
    const timer = setTimeout(() => child.kill(), 15_000);
    try {
      await ready;
      return await new Promise((resolve, reject) => {
        child.once("message", (response) => response.error ? reject(new Error(response.error)) : resolve(response.result));
        child.once("exit", () => reject(new Error("Test worker failed.")));
        child.once("error", () => reject(new Error("Test worker failed.")));
        child.send(message);
      });
    } finally { clearTimeout(timer); if (child.connected) child.disconnect(); }
  };
}

const digest = (digit = "1") => digit.repeat(64);
const consent = {
  emailHash: digest("e"), wording: NEWSLETTER_CONSENT_TEXT, wordingVersion: NEWSLETTER_CONSENT_VERSION,
  noticeUrl: "https://example.invalid/privacy/", noticeVersion: "test-policy-v1", origin: "https://acexperts.ae",
  listId: 42, templateId: 7, retentionDays: 30,
};
const enquiry = { firstName: "Shared", lastName: "Store", email: "shared-test@example.invalid", company: "Synthetic",
  phone: "", mobile: "+971500000000", service: "Repairs", message: "Mock delivery only. Never send this message.", website: "" };
const signup = { email: "shared-signup@example.invalid", consent: true, website: "",
  consentVersion: NEWSLETTER_CONSENT_VERSION, noticeVersion: "test-policy-v1" };
const request = (body, channel = "contact") => new Request(`https://acexperts.ae/api/${channel}/`, {
  method: "POST", headers: { origin: "https://acexperts.ae", "content-type": "application/json" }, body: JSON.stringify(body),
});
const accepted = () => Response.json({ messageId: "<mock-only@example.invalid>" }, { status: 201 });

test("PostgreSQL: unsafe/missing configuration fails closed without opening a connection", { skip }, async () => {
  await fixture(async ({ env }) => {
    for (const key of ["FORM_DATABASE_URL", "FORM_STATE_SECRET", "FORM_STORE_NAMESPACE"]) {
      assert.equal(createPostgresFormStore({ ...env, [key]: "" }), null);
    }
    for (const value of ["postgresql://u:p@localhost/db?sslmode=disable", "postgresql://u:p@localhost/db#fragment",
      "postgresql://u@localhost/db", "http://u:p@localhost/db", "postgresql://u:p@localhost:0/db", "postgresql://u:p@localhost/a/b"]) {
      assert.equal(createPostgresFormStore({ ...env, FORM_DATABASE_URL: value }), null);
    }
    assert.equal(createPostgresFormStore({ ...env, FORM_STATE_SECRET: "not-a-key" }), null);
    assert.equal(createPostgresFormStore({ ...env, FORM_STORE_NAMESPACE: "unsafe namespace" }), null);
  });
});

test("PostgreSQL: independent pools atomically acquire exactly one concurrent submission", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const pools = Array.from({ length: 4 }, () => store());
    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => pools[i % pools.length].claim("contact", digest())));
    assert.equal(claims.filter((claim) => claim.acquired).length, 1);
    assert.equal(new Set(claims.map((claim) => claim.requestId)).size, 1);
    assert.ok(claims.every((claim) => claim.status === "pending"));
    assert.equal((await admin.query("SELECT count(*)::integer AS count FROM acexperts_forms.submissions WHERE scope = $1", [scope])).rows[0].count, 1);
  });
});

test("PostgreSQL: separate Node processes share claims and persist pending/accepted after reconnect", { skip }, async () => {
  await fixture(async ({ env, store }) => {
    const workers = Array.from({ length: 3 }, () => worker(env));
    const claims = await Promise.all(workers.map((run) => run({ operation: "claim", channel: "contact", digest: digest() })));
    assert.equal(claims.filter((claim) => claim.acquired).length, 1);
    const requestId = claims[0].requestId;
    assert.ok(claims.every((claim) => claim.requestId === requestId));
    const nextPool = store();
    assert.deepEqual(await nextPool.claim("contact", digest()), { acquired: false, requestId, status: "pending" });
    await nextPool.complete("contact", digest(), requestId, "accepted");
    await nextPool.close();
    assert.deepEqual(await worker(env)({ operation: "claim", channel: "contact", digest: digest() }),
      { acquired: false, requestId, status: "accepted" });
  });
});

test("PostgreSQL: contact30/newsletter10 budgets are shared across pools and Node processes", { skip }, async () => {
  await fixture(async ({ store, admin, scope, env }) => {
    for (const [channel, limit] of [["contact", 30], ["newsletter", 10]]) {
      const first = store();
      assert.equal((await first.consumeRate(channel, limit)).allowed, true);
      // Freeze this fixture's bucket ahead of the database minute boundary to
      // make concurrent-cap assertions independent of wall-clock rollover.
      await admin.query("UPDATE acexperts_forms.rate_limits SET window_start = date_trunc('minute', clock_timestamp()) + interval '2 minutes' WHERE scope = $1 AND channel = $2", [scope, channel]);
      const count = limit;
      const [external, local] = await Promise.all([
        worker(env)({ operation: "rate", channel, limit, count }),
        Promise.all(Array.from({ length: count }, (_, i) => (i % 2 ? first : store()).consumeRate(channel, limit))),
      ]);
      assert.equal([...external, ...local].filter((result) => result.allowed).length + 1, limit);
      assert.ok([...external, ...local].every((result) => Number.isInteger(result.retryAfter) && result.retryAfter >= 1));
      const row = (await admin.query("SELECT hits FROM acexperts_forms.rate_limits WHERE scope = $1 AND channel = $2", [scope, channel])).rows[0];
      assert.equal(row.hits, limit + 1);
    }
  });
});

test("PostgreSQL: a different HMAC key in the same namespace fails closed", { skip }, async () => {
  await fixture(async ({ store }) => {
    const primary = store();
    await primary.consumeRate("contact", 30);
    const mismatched = store({ FORM_STATE_SECRET: "b".repeat(64) });
    await assert.rejects(mismatched.consumeRate("contact", 30), { message: "Shared form store unavailable." });
    await assert.rejects(mismatched.claim("contact", digest()), { message: "Shared form store unavailable." });
    assert.equal((await primary.claim("contact", digest())).acquired, true);
  });
});

test("PostgreSQL: expiry uses database time and accepted/rejected acquire a new owner only after expiry", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const instance = store();
    for (const [status, key] of [["accepted", digest("2")], ["rejected", digest("3")]]) {
      const claim = await instance.claim("contact", key);
      await instance.complete("contact", key, claim.requestId, status);
      const originalNow = Date.now;
      try {
        Date.now = () => 8_640_000_000_000_000;
        assert.equal((await instance.claim("contact", key)).acquired, false);
      } finally { Date.now = originalNow; }
      const row = (await admin.query("SELECT EXTRACT(EPOCH FROM (retry_after - updated_at)) AS seconds FROM acexperts_forms.submissions WHERE scope = $1 AND digest = $2", [scope, key])).rows[0];
      assert.ok(Math.abs(Number(row.seconds) - (status === "accepted" ? 1800 : 60)) < 1);
      await admin.query("UPDATE acexperts_forms.submissions SET retry_after = clock_timestamp() - interval '1 second' WHERE scope = $1 AND digest = $2", [scope, key]);
      const next = await instance.claim("contact", key);
      assert.equal(next.acquired, true);
      assert.notEqual(next.requestId, claim.requestId);
    }
  });
});

test("PostgreSQL: old pending/uncertain/timeout claims never automatically resend", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const first = store();
    for (const [status, key] of [["pending", digest("4")], ["uncertain", digest("5")], ["timeout", digest("6")]]) {
      const claim = await first.claim("contact", key);
      if (status !== "pending") await first.complete("contact", key, claim.requestId, status);
      await admin.query("UPDATE acexperts_forms.submissions SET created_at = clock_timestamp() - interval '10 years', updated_at = clock_timestamp() - interval '10 years' WHERE scope = $1 AND digest = $2", [scope, key]);
      assert.deepEqual(await store().claim("contact", key), { acquired: false, requestId: claim.requestId, status });
    }
  });
});

test("PostgreSQL: only the pending request owner can complete; stale owners cannot overwrite retries", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const instance = store();
    const original = await instance.claim("contact", digest());
    await assert.rejects(instance.complete("contact", digest(), randomUUID(), "accepted"));
    await instance.complete("contact", digest(), original.requestId, "rejected");
    await admin.query("UPDATE acexperts_forms.submissions SET retry_after = clock_timestamp() - interval '1 second' WHERE scope = $1", [scope]);
    const replacement = await instance.claim("contact", digest());
    await assert.rejects(instance.complete("contact", digest(), original.requestId, "accepted"));
    assert.deepEqual(await instance.claim("contact", digest()), { acquired: false, requestId: replacement.requestId, status: "pending" });
    await instance.complete("contact", digest(), replacement.requestId, "accepted");
    await assert.rejects(instance.complete("contact", digest(), replacement.requestId, "rejected"));
  });
});

test("PostgreSQL: consent evidence persists atomically without raw email or inferred confirmation", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const first = store();
    const claim = await first.claim("newsletter", digest(), consent);
    const row = (await admin.query("SELECT *, EXTRACT(EPOCH FROM (retain_until - recorded_at)) AS retained_seconds FROM acexperts_forms.consent_events WHERE scope = $1", [scope])).rows[0];
    assert.equal(row.request_id, claim.requestId);
    assert.equal(row.email_hash, consent.emailHash);
    assert.equal(row.wording, NEWSLETTER_CONSENT_TEXT);
    assert.equal(row.wording_version, NEWSLETTER_CONSENT_VERSION);
    assert.equal(row.notice_url, consent.noticeUrl);
    assert.equal(row.notice_version, consent.noticeVersion);
    assert.equal(row.origin, consent.origin);
    assert.equal(Number(row.list_id), consent.listId);
    assert.equal(Number(row.template_id), consent.templateId);
    assert.equal(row.delivery_status, "pending");
    assert.equal(row.confirmation_state, "not_verified");
    assert.ok(Math.abs(Number(row.retained_seconds) - 30 * 86400) < 1);
    assert.ok(!JSON.stringify(row).includes(signup.email));
    await first.close();
    const second = store();
    assert.equal((await second.claim("newsletter", digest(), consent)).acquired, false);
    await second.complete("newsletter", digest(), claim.requestId, "accepted");
    const completed = (await admin.query("SELECT delivery_status, confirmation_state FROM acexperts_forms.consent_events WHERE scope = $1", [scope])).rows;
    assert.deepEqual(completed, [{ delivery_status: "accepted", confirmation_state: "not_verified" }]);
  });
});

test("PostgreSQL: consent insertion errors roll back the submission claim", { skip }, async () => {
  await fixture(async ({ store, admin, scope }) => {
    const instance = store();
    await assert.rejects(instance.claim("newsletter", digest(), { ...consent, wording: "SQL text cannot contain a NUL\0character" }),
      { message: "Shared form store unavailable." });
    assert.equal((await admin.query("SELECT count(*)::integer AS count FROM acexperts_forms.submissions WHERE scope = $1", [scope])).rows[0].count, 0);
    assert.equal((await admin.query("SELECT count(*)::integer AS count FROM acexperts_forms.consent_events WHERE scope = $1", [scope])).rows[0].count, 0);
  });
});

test("PostgreSQL: independent contact handlers dispatch one mocked provider request", { skip }, async () => {
  await fixture(async ({ store, env, admin, scope }) => {
    let calls = 0;
    let providerStarted;
    const started = new Promise((resolve) => { providerStarted = resolve; });
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const fetch = async (url, init) => {
      assert.equal(url, "https://api.brevo.com/v3/smtp/email");
      const committed = (await admin.query("SELECT * FROM acexperts_forms.submissions WHERE scope = $1", [scope])).rows;
      assert.equal(committed.length, 1);
      assert.equal(committed[0].status, "pending");
      assert.equal(JSON.parse(init.body).headers.idempotencyKey, committed[0].request_id);
      assert.ok(!JSON.stringify(committed).includes(enquiry.email));
      assert.ok(!JSON.stringify(committed).includes(enquiry.message));
      calls++;
      providerStarted();
      await pending;
      return accepted();
    };
    const one = createContactHandler(undefined, { env, store: store(), fetch });
    const two = createContactHandler(undefined, { env, store: store(), fetch });
    const first = one(request(enquiry));
    try {
      await started;
      assert.equal((await two(request(enquiry))).status, 409);
    } finally { release(); }
    assert.equal((await first).status, 200);
    assert.equal((await two(request(enquiry))).status, 200);
    assert.equal(calls, 1);
  });
});

test("PostgreSQL: newsletter handler commits checked consent before mocked DOI dispatch", { skip }, async () => {
  await fixture(async ({ store, env, admin, scope }) => {
    let calls = 0;
    const handler = createNewsletterHandler(undefined, { env, store: store(), fetch: async (url) => {
      assert.equal(url, "https://api.brevo.com/v3/contacts/doubleOptinConfirmation");
      calls++;
      const rows = (await admin.query("SELECT delivery_status, confirmation_state, wording_version, notice_version FROM acexperts_forms.consent_events WHERE scope = $1", [scope])).rows;
      assert.deepEqual(rows, [{ delivery_status: "pending", confirmation_state: "not_verified", wording_version: NEWSLETTER_CONSENT_VERSION, notice_version: "test-policy-v1" }]);
      return new Response(null, { status: 201 });
    } });
    for (const body of [{ ...signup, consent: false }, { ...signup, consentVersion: "obsolete" }, { ...signup, noticeVersion: "obsolete" }]) {
      assert.equal((await handler(request(body, "newsletter"))).status, 400);
    }
    assert.equal((await handler(request(signup, "newsletter"))).status, 200);
    assert.equal((await handler(request(signup, "newsletter"))).status, 200);
    assert.equal(calls, 1);
    assert.equal((await admin.query("SELECT delivery_status FROM acexperts_forms.consent_events WHERE scope = $1", [scope])).rows[0].delivery_status, "accepted");
  });
});

test("PostgreSQL: provider receipt plus database completion failure stays blocked without resend", { skip }, async () => {
  await fixture(async ({ store, env, admin, scope }) => {
    let calls = 0;
    let lock;
    const fetch = async () => {
      calls++;
      lock = await admin.connect();
      await lock.query("BEGIN");
      await lock.query("SELECT request_id FROM acexperts_forms.submissions WHERE scope = $1 FOR UPDATE", [scope]);
      return accepted();
    };
    const one = createContactHandler(undefined, { env, store: store(), fetch });
    let response;
    try { response = await one(request(enquiry)); }
    finally { if (lock) { await lock.query("ROLLBACK"); lock.release(); } }
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /could not confirm delivery/);
    const two = createContactHandler(undefined, { env, store: store(), fetch });
    assert.equal((await two(request(enquiry))).status, 409);
    assert.equal(calls, 1);
    assert.equal((await admin.query("SELECT status FROM acexperts_forms.submissions WHERE scope = $1", [scope])).rows[0].status, "pending");
  });
});

test("PostgreSQL: database outage returns generic errors and handlers never call provider", { skip }, async () => {
  await fixture(async ({ store, env }) => {
    const unreachable = new URL(database);
    unreachable.port = "9";
    unreachable.password = "synthetic-secret-canary";
    const instance = store({ FORM_DATABASE_URL: unreachable.href });
    await assert.rejects(instance.claim("contact", digest()), (error) => error.message === "Shared form store unavailable."
      && !error.stack.includes("synthetic-secret-canary"));
    let calls = 0;
    const handler = createContactHandler(undefined, { env, store: instance, fetch: async () => { calls++; return accepted(); } });
    const response = await handler(request(enquiry));
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.ok(!text.includes("synthetic-secret-canary") && !text.includes("postgres"));
    assert.equal(calls, 0);
  });
});

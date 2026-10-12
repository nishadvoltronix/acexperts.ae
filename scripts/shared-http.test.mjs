import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Pool } from "pg";
import { NEWSLETTER_CONSENT_VERSION } from "../lib/newsletter-consent.ts";

const database = process.env.FORM_TEST_DATABASE_URL;
const skip = database ? false : "Set FORM_TEST_DATABASE_URL to the isolated local acexperts_test role/database for real HTTP/PostgreSQL process tests.";
let configuration;
if (database) {
  try {
    const url = new URL(database);
    if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || decodeURIComponent(url.username) !== "acexperts_test"
      || decodeURIComponent(url.pathname) !== "/acexperts_test" || !url.password
      || url.search || url.hash || /[?#\r\n\0]/.test(database)) throw new Error();
    configuration = { host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432),
      user: "acexperts_test", password: decodeURIComponent(url.password), database: "acexperts_test",
      ssl: false, max: 2, connectionTimeoutMillis: 1500, query_timeout: 3000, statement_timeout: 2500 };
  } catch { throw new Error("Refusing unsafe FORM_TEST_DATABASE_URL; only the isolated local acexperts_test role/database is permitted."); }
}

const enquiry = { firstName: "HTTP", lastName: "Test", email: "http-test@example.invalid", company: "Synthetic",
  phone: "", mobile: "+971500000000", service: "Repairs", message: "Synthetic HTTP test; provider calls are intercepted.", website: "" };
const signup = { email: "http-signup@example.invalid", consent: true, website: "",
  consentVersion: NEWSLETTER_CONSENT_VERSION, noticeVersion: "test-policy-v1" };

function createWorker(scope, hold = false) {
  // Do not inherit any real provider/database settings into a test server.
  const child = fork(fileURLToPath(new URL("./helpers/shared-http-worker.mjs", import.meta.url)), [], {
    env: { SystemRoot: process.env.SystemRoot, NODE_NO_WARNINGS: "1", FORM_TEST_DATABASE_URL: database,
      FORM_STORE_NAMESPACE: scope, HTTP_TEST_HOLD_PROVIDER: hold ? "1" : "0" },
    stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
  });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const pending = new Map();
  const providerCounts = { contact: 0, newsletter: 0 };
  const observers = [];
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const startupTimeout = setTimeout(() => { readyReject(new Error("Local HTTP test worker did not become ready.")); child.kill(); }, 10_000);
  child.on("message", (message) => {
    if (message.ready) { clearTimeout(startupTimeout); readyResolve(message); }
    if (message.event === "provider") {
      providerCounts[message.channel] = message.calls;
      for (const observe of observers) observe();
    }
    if (pending.has(message.id)) {
      const command = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(command.timer);
      if (message.error) command.reject(new Error("Local HTTP test command failed."));
      else command.resolve(message);
    }
  });
  const failed = () => {
    clearTimeout(startupTimeout);
    readyReject(new Error("Local HTTP test worker exited before readiness."));
    for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("Local HTTP test worker exited.")); }
    pending.clear();
  };
  child.once("error", failed);
  child.once("exit", failed);
  async function command(action) {
    await ready;
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Local HTTP test command timed out.")); }, 10_000);
      pending.set(id, { resolve, reject, timer });
      child.send({ id, action }, (error) => {
        if (error) { pending.delete(id); clearTimeout(timer); reject(new Error("Local HTTP test command could not be sent.")); }
      });
    });
  }
  let stopped = false;
  return {
    ready,
    command,
    providerCounts,
    async waitForProvider(channel) {
      if (providerCounts[channel]) return;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Fake provider was not reached.")), 10_000);
        const observe = () => {
          if (providerCounts[channel]) { clearTimeout(timer); observers.splice(observers.indexOf(observe), 1); resolve(); }
        };
        observers.push(observe);
      });
    },
    async post(channel, body) {
      const { port } = await ready;
      const origin = `http://127.0.0.1:${port}`;
      const response = await fetch(`${origin}/api/${channel}/`, {
        method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 200 + 1)}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      });
      const text = await response.text();
      assert.ok(!text.includes("synthetic-http-test-key") && !text.includes(configuration.password) && !text.includes("postgresql://"));
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      return { status: response.status, message: JSON.parse(text).message, retryAfter: Number(response.headers.get("retry-after")) };
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      let timer;
      try {
        await command("stop");
        const outcome = await Promise.race([
          exited,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Local HTTP test worker required forced termination instead of clean shutdown.")), 3000); }),
        ]);
        assert.equal(outcome.code, 0, "Local HTTP worker must exit successfully after closing its server and PostgreSQL pools");
        assert.equal(outcome.signal, null, "Local HTTP worker must shut down without a termination signal");
      } finally {
        clearTimeout(timer);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill();
          let cleanupTimer;
          try {
            await Promise.race([exited, new Promise((_, reject) => {
              cleanupTimer = setTimeout(() => reject(new Error("Owned HTTP test worker could not be terminated.")), 3000);
            })]);
          } finally { clearTimeout(cleanupTimer); }
        }
        // Never echo captured output in an assertion diff if a future regression
        // accidentally logs sensitive connection/request details.
        assert.ok(output.length === 0, "Local HTTP worker emitted unexpected output; values withheld to protect secrets");
      }
    },
  };
}

async function fixture(run) {
  const scope = `http_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool(configuration);
  admin.on("error", () => {});
  const workers = [];
  const worker = (hold = false) => {
    const instance = createWorker(scope, hold);
    workers.push(instance);
    return instance;
  };
  try {
    const version = await admin.query("SELECT version FROM acexperts_forms.schema_version WHERE singleton = true");
    assert.equal(version.rows[0]?.version, 1, "Apply the form-state migration to the isolated test database first.");
    await run({ scope, admin, worker });
  } finally {
    try {
      const results = await Promise.allSettled(workers.map((instance) => instance.stop()));
      for (const result of results) if (result.status === "rejected") throw result.reason;
    } finally {
      try {
        // No schema/global mutation; delete only the random namespace owned here.
        for (const table of ["consent_events", "submissions", "rate_limits", "namespace_settings"])
          await admin.query(`DELETE FROM acexperts_forms.${table} WHERE scope = $1`, [scope]);
      } finally { await admin.end(); }
    }
  }
}

test("HTTP/PostgreSQL: two real Node servers suppress concurrent duplicates and preserve accepted state after process replacement", { skip, timeout: 60_000 }, async (context) => {
  await fixture(async ({ scope, admin, worker }) => {
    const first = worker(true);
    const second = worker();
    const firstIdentity = await first.ready;
    const secondIdentity = await second.ready;
    assert.notEqual(firstIdentity.pid, secondIdentity.pid);
    assert.notEqual(firstIdentity.port, secondIdentity.port);
    for (const [channel, body] of [["contact", enquiry], ["newsletter", signup]]) {
      if (channel === "newsletter") await first.command("hold");
      const initial = first.post(channel, body);
      await first.waitForProvider(channel);
      const duplicate = await second.post(channel, body);
      assert.equal(duplicate.status, 409);
      assert.match(duplicate.message, /already being processed/);
      assert.deepEqual((await admin.query("SELECT status FROM acexperts_forms.submissions WHERE scope=$1 AND channel=$2", [scope, channel])).rows, [{ status: "pending" }]);
      if (channel === "newsletter") {
        const consent = (await admin.query("SELECT delivery_status, confirmation_state, wording_version, notice_version FROM acexperts_forms.consent_events WHERE scope=$1", [scope])).rows;
        assert.deepEqual(consent, [{ delivery_status: "pending", confirmation_state: "not_verified", wording_version: NEWSLETTER_CONSENT_VERSION, notice_version: "test-policy-v1" }]);
      }
      await first.command("release");
      assert.equal((await initial).status, 200);
      assert.equal((await second.post(channel, body)).status, 200);
      assert.equal((await first.command("stats")).calls[channel], 1);
      assert.equal((await second.command("stats")).calls[channel], 0);
    }
    await first.stop();
    await second.stop();
    const replacement = worker();
    assert.ok(![firstIdentity.pid, secondIdentity.pid].includes((await replacement.ready).pid));
    for (const [channel, body] of [["contact", enquiry], ["newsletter", signup]])
      assert.equal((await replacement.post(channel, body)).status, 200);
    assert.deepEqual((await replacement.command("stats")).calls, { contact: 0, newsletter: 0 });
    context.diagnostic("Real localhost HTTP + separate Node processes + real PostgreSQL: one fake provider dispatch per channel, pending409, accepted200, zero dispatches after both original processes were stopped and replaced. No Brevo request was made.");
  });
});

test("HTTP/PostgreSQL: contact30 and newsletter10 budgets apply across HTTP servers and fresh processes", { skip, timeout: 60_000 }, async (context) => {
  await fixture(async ({ scope, admin, worker }) => {
    const workers = [worker(), worker()];
    await Promise.all(workers.map((instance) => instance.ready));
    for (const [channel, limit, body] of [["contact", 30, enquiry], ["newsletter", 10, signup]]) {
      const unique = (index) => channel === "contact" ? { ...body, message: `HTTP synthetic unique enquiry ${index}` } : { ...body, email: `http-${index}@example.invalid` };
      assert.equal((await workers[0].post(channel, unique(0))).status, 200);
      // Keep this random fixture's bucket in one database interval even if the
      // wall clock crosses a minute mid-test. No other namespace is modified.
      await admin.query("UPDATE acexperts_forms.rate_limits SET window_start=date_trunc('minute', clock_timestamp()) + interval '2 minutes' WHERE scope=$1 AND channel=$2", [scope, channel]);
      const responses = await Promise.all(Array.from({ length: limit - 1 }, (_, index) => workers[(index + 1) % 2].post(channel, unique(index + 1))));
      assert.ok(responses.every((response) => response.status === 200));
      for (const instance of workers) {
        const response = await instance.post(channel, unique(limit));
        assert.equal(response.status, 429);
        assert.ok(response.retryAfter >= 1 && response.retryAfter <= 180);
      }
      const counts = await Promise.all(workers.map((instance) => instance.command("stats")));
      assert.equal(counts.reduce((sum, item) => sum + item.calls[channel], 0), limit);
    }
    await Promise.all(workers.map((instance) => instance.stop()));
    const replacement = worker();
    for (const [channel, body] of [["contact", enquiry], ["newsletter", signup]]) {
      assert.equal((await replacement.post(channel, body)).status, 429);
      assert.equal((await replacement.command("stats")).calls[channel], 0);
    }
    context.diagnostic("Real HTTP budgets remained30 contact/10 newsletter across two servers and replacement, despite varying forwarded IP headers. The test moves only its own bucket two minutes forward to prevent timing flakiness; this is not a production clock change.");
  });
});

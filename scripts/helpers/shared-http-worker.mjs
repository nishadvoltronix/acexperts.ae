import { createServer } from "node:http";
import { Readable } from "node:stream";

// TEST ONLY: refuse standalone execution and every nonlocal/non-test database.
function safeDatabase(value) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && decodeURIComponent(url.username) === "acexperts_test"
      && decodeURIComponent(url.pathname) === "/acexperts_test"
      && Boolean(url.password) && !url.search && !url.hash && !/[?#\r\n\0]/.test(value);
  } catch { return false; }
}
if (!process.send || !safeDatabase(process.env.FORM_TEST_DATABASE_URL)
  || !/^http_test_[a-f0-9]{32}$/.test(process.env.FORM_STORE_NAMESPACE ?? "")) process.exit(2);

// Defense in depth: this process cannot call a provider through native fetch.
// The only transport passed into handlers is the deterministic fake below.
globalThis.fetch = async () => { throw new Error("Network fetch is disabled in the local HTTP test worker."); };
const { createPostgresFormStore } = await import("../../lib/form-store.ts");
const { createContactHandler } = await import("../../lib/contact-request.ts");
const { createNewsletterHandler } = await import("../../lib/newsletter-request.ts");
const env = {
  FORM_DATABASE_URL: process.env.FORM_TEST_DATABASE_URL,
  FORM_STORE_NAMESPACE: process.env.FORM_STORE_NAMESPACE,
  FORM_STATE_SECRET: "7".repeat(64),
  BREVO_API_KEY: "synthetic-http-test-key-not-a-credential",
  CONTACT_FROM_EMAIL: "forms@example.invalid", CONTACT_TO_EMAIL: "team@example.invalid",
  BREVO_NEWSLETTER_LIST_ID: "42", BREVO_NEWSLETTER_DOI_TEMPLATE_ID: "7",
  BREVO_NEWSLETTER_REDIRECT_URL: "https://example.invalid/confirmed/",
  PRIVACY_NOTICE_URL: "https://example.invalid/privacy/", PRIVACY_NOTICE_VERSION: "test-policy-v1",
  NEWSLETTER_CONSENT_RETENTION_DAYS: "30",
};
const stores = [createPostgresFormStore(env), createPostgresFormStore(env)];
if (stores.some((store) => !store)) process.exit(2);
const calls = { contact: 0, newsletter: 0 };
let release;
let held;
function hold() { held = new Promise((resolve) => { release = resolve; }); }
function unblock() { release?.(); release = undefined; held = undefined; }
if (process.env.HTTP_TEST_HOLD_PROVIDER === "1") hold();
const fakeProvider = async (url) => {
  const channel = url === "https://api.brevo.com/v3/smtp/email" ? "contact"
    : url === "https://api.brevo.com/v3/contacts/doubleOptinConfirmation" ? "newsletter" : null;
  if (!channel) throw new Error("Unexpected fake provider target.");
  calls[channel]++;
  process.send?.({ event: "provider", channel, calls: calls[channel] });
  if (held) await held;
  return Response.json({ messageId: "<fake-http-receipt@example.invalid>" }, { status: 201 });
};
const handlers = {
  "/api/contact/": createContactHandler(undefined, { env, store: stores[0], fetch: fakeProvider }),
  "/api/newsletter/": createNewsletterHandler(undefined, { env, store: stores[1], fetch: fakeProvider }),
};
let port;
const server = createServer(async (incoming, outgoing) => {
  try {
    const handler = handlers[incoming.url];
    if (!handler || incoming.method !== "POST") {
      outgoing.writeHead(404).end();
      return;
    }
    const headers = new Headers();
    for (let index = 0; index < incoming.rawHeaders.length; index += 2)
      headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
    const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, {
      method: "POST", headers, body: Readable.toWeb(incoming), duplex: "half",
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "Content-Type": "application/json" }).end('{"message":"Local test worker failed."}');
  }
});
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
let stopping;
function stop() {
  stopping ??= (async () => {
    unblock();
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    await Promise.all(stores.map((store) => store.close()));
  })();
  return stopping;
}
process.on("message", async (message) => {
  try {
    if (message?.action === "stats") process.send?.({ id: message.id, calls });
    else if (message?.action === "release") { unblock(); process.send?.({ id: message.id, ok: true }); }
    else if (message?.action === "hold") { hold(); process.send?.({ id: message.id, ok: true }); }
    else if (message?.action === "stop") {
      await stop();
      process.send?.({ id: message.id, ok: true }, () => process.disconnect());
    } else process.send?.({ id: message?.id, error: "Unsupported local test operation." });
  } catch { process.send?.({ id: message?.id, error: "Local HTTP test worker failed." }); }
});
process.once("disconnect", () => { void stop().then(() => process.exit(0), () => process.exit(2)); });
server.once("error", () => { process.send?.({ error: "Local HTTP test listener failed." }); process.exit(2); });
server.listen(0, "127.0.0.1", () => {
  port = server.address().port;
  process.send?.({ ready: true, port, pid: process.pid });
});

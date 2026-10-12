import { createPostgresFormStore } from "../../lib/form-store.ts";

// This helper is intentionally incapable of using a production database.
function localTestDatabase(value) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && decodeURIComponent(url.username) === "acexperts_test"
      && decodeURIComponent(url.pathname) === "/acexperts_test"
      && !url.search && !url.hash;
  } catch { return false; }
}

if (!process.send || !localTestDatabase(process.env.FORM_TEST_DATABASE_URL)) process.exit(2);
const store = createPostgresFormStore({
  FORM_DATABASE_URL: process.env.FORM_TEST_DATABASE_URL,
  FORM_STATE_SECRET: process.env.FORM_STATE_SECRET,
  FORM_STORE_NAMESPACE: process.env.FORM_STORE_NAMESPACE,
});
if (!store) process.exit(2);
process.send({ ready: true });
process.once("message", async (message) => {
  try {
    let result;
    if (message.operation === "claim") {
      result = await store.claim(message.channel, message.digest);
    } else if (message.operation === "rate") {
      result = await Promise.all(Array.from({ length: message.count }, () => store.consumeRate(message.channel, message.limit)));
    } else throw new Error("Unsupported test operation.");
    await store.close();
    process.send({ result }, () => process.disconnect());
  } catch {
    try { await store.close(); } catch { /* Never expose connection errors. */ }
    process.send({ error: "Local shared-store worker failed." }, () => process.disconnect());
  }
});

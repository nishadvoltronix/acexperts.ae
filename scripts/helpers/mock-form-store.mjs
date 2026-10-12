import { randomUUID } from "node:crypto";

// TEST ONLY. Application handlers must explicitly receive this test double;
// production imports PostgreSQL and has no in-memory fallback. This helper
// models atomic store outcomes, not PostgreSQL persistence or multi-process IO.
export function createMockFormStore(now = Date.now) {
  const records = new Map();
  const rates = new Map();
  const consents = [];
  return {
    records,
    consents,
    async consumeRate(channel, limit) {
      const minute = Math.floor(now() / 60_000) * 60_000;
      let rate = rates.get(channel);
      if (!rate || rate.start < minute) {
        rate = { start: minute, hits: 0 };
        rates.set(channel, rate);
      }
      rate.hits++;
      return { allowed: rate.hits <= limit, retryAfter: Math.max(1, Math.ceil((rate.start + 60_000 - now()) / 1000)) };
    },
    async claim(channel, digest, consent) {
      const key = `${channel}:${digest}`;
      const existing = records.get(key);
      if (existing && !(existing.retryAfter !== null && existing.retryAfter <= now()))
        return { acquired: false, requestId: existing.requestId, status: existing.status };
      const requestId = randomUUID();
      records.set(key, { channel, digest, requestId, status: "pending", retryAfter: null });
      if (consent) consents.push({ ...structuredClone(consent), requestId, deliveryStatus: "pending" });
      return { acquired: true, requestId, status: "pending" };
    },
    async complete(channel, digest, requestId, status) {
      const row = records.get(`${channel}:${digest}`);
      if (!row || row.status !== "pending" || row.requestId !== requestId)
        throw new Error("TEST STORE: invalid completion owner/state");
      row.status = status;
      row.retryAfter = status === "accepted" ? now() + 30 * 60_000 : status === "rejected" ? now() + 60_000 : null;
      const evidence = consents.find((entry) => entry.requestId === requestId);
      if (evidence) evidence.deliveryStatus = status;
    },
    async close() {},
  };
}

export const mockStateEnvironment = {
  FORM_DATABASE_URL: "postgresql://unit:synthetic-db-password@127.0.0.1:5432/acexperts_unit",
  FORM_STATE_SECRET: "11".repeat(32),
  FORM_STORE_NAMESPACE: "unit",
  PRIVACY_NOTICE_URL: "https://example.invalid/privacy/",
  PRIVACY_NOTICE_VERSION: "test-policy-v1",
  NEWSLETTER_CONSENT_RETENTION_DAYS: "30",
};

export const mockConsentVersions = {
  consentVersion: "2026-10-12-v1",
  noticeVersion: "test-policy-v1",
};

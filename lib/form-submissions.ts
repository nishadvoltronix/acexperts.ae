import { createHmac } from "node:crypto";
import { createPostgresFormStore, type FormStore, type FormChannel, type ConsentEvidence } from "./form-store.ts";
import type { DeliveryOptions, DeliveryResult } from "./form-delivery.ts";

export type SubmissionOptions = DeliveryOptions & { store?: FormStore | null };
export type SubmissionResult = { status: DeliveryResult["status"] | "pending" | "unavailable" };

export function createSubmissionState(options: SubmissionOptions = {}) {
  const env = options.env ?? process.env;
  const secret = env.FORM_STATE_SECRET;
  const namespace = env.FORM_STORE_NAMESPACE;
  const configured = Boolean(secret && /^[a-fA-F0-9]{64}$/.test(secret) && namespace && /^[a-z0-9_-]{1,64}$/.test(namespace));
  const store = configured ? (options.store === undefined ? createPostgresFormStore(env) : options.store) : null;
  const digest = (purpose: string, value: unknown) => createHmac("sha256", Buffer.from(secret!, "hex"))
    .update(JSON.stringify([namespace, purpose, value])).digest("hex");
  return {
    available: Boolean(store),
    // The database budget is shared by every instance, using PostgreSQL's clock.
    rateLimiter(channel: FormChannel, limit: number) {
      return store ? () => store.consumeRate(channel, limit) : undefined;
    },
    emailHash(email: string) { return store ? digest("newsletter-email", email) : ""; },
    async submit(channel: FormChannel, normalized: object, send: (requestId: string) => Promise<DeliveryResult>, consent?: ConsentEvidence): Promise<SubmissionResult> {
      if (!store) return { status: "unconfigured" };
      const key = digest(channel, normalized);
      let claim;
      try { claim = await store.claim(channel, key, consent); }
      catch { return { status: "unavailable" }; }
      if (!claim.acquired) return { status: claim.status };
      // Claim and newsletter consent commit BEFORE delivery. A crash or ambiguous
      // commit must never cause automatic takeover or a second provider request.
      let outcome: DeliveryResult;
      try { outcome = await send(claim.requestId); }
      catch { outcome = { status: "uncertain" }; }
      const storedStatus = outcome.status === "unconfigured" ? "rejected" : outcome.status;
      try { await store.complete(channel, key, claim.requestId, storedStatus); }
      catch { return { status: "uncertain" }; }
      return outcome;
    },
  };
}

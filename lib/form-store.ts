import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { PoolClient, PoolConfig } from "pg";

export type FormChannel = "contact" | "newsletter";
export type StoredStatus = "pending" | "accepted" | "rejected" | "uncertain" | "timeout";
export type ConsentEvidence = {
  emailHash: string;
  wording: string;
  wordingVersion: string;
  noticeUrl: string;
  noticeVersion: string | null;
  origin: string;
  listId: number;
  templateId: number;
  retentionDays: number;
};

export interface FormStore {
  consumeRate(channel: FormChannel, limit: number): Promise<{ allowed: boolean; retryAfter: number }>;
  claim(channel: FormChannel, digest: string, consent?: ConsentEvidence): Promise<{
    acquired: boolean;
    requestId: string;
    status: StoredStatus;
  }>;
  complete(channel: FormChannel, digest: string, requestId: string, status: Exclude<StoredStatus, "pending">): Promise<void>;
  close(): Promise<void>;
}

type StoreEnvironment = Record<string, string | undefined>;
const DIGEST = /^[a-f0-9]{64}$/;
const VERSION = /^[a-zA-Z0-9._-]{1,100}$/;
const REQUEST_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const unavailable = () => new Error("Shared form store unavailable.");

function configuration(env: StoreEnvironment): { scope: string; fingerprint: string; pool: PoolConfig } | null {
  const scope = env.FORM_STORE_NAMESPACE?.trim() ?? "";
  const connection = env.FORM_DATABASE_URL?.trim() ?? "";
  const secret = env.FORM_STATE_SECRET?.trim() ?? "";
  if (!/^[a-z0-9_-]{1,64}$/.test(scope) || !/^[a-fA-F0-9]{64}$/.test(secret)
    || !connection || /[?#\r\n\0]/.test(connection)) return null;
  try {
    const parsed = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password) return null;
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    if (!user || !password || !database || /[\x00-\x1f\x7f]/.test(user + password + database) || /[/\\]/.test(database)) return null;
    if (user.length > 128 || password.length > 1024 || database.length > 128) return null;
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    const port = parsed.port ? Number(parsed.port) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase());
    return {
      scope,
      fingerprint: createHash("sha256").update(Buffer.from(secret, "hex")).digest("hex"),
      // Explicit fields prevent URL sslmode/sslcert parameters overriding TLS.
      pool: {
        host,
        port,
        user,
        password,
        database,
        ssl: loopback ? false : { rejectUnauthorized: true },
        max: 3,
        connectionTimeoutMillis: 1500,
        query_timeout: 2000,
        statement_timeout: 1500,
        idle_in_transaction_session_timeout: 5000,
        idleTimeoutMillis: 10_000,
        allowExitOnIdle: true,
        application_name: "acexperts-forms",
      },
    };
  } catch {
    return null;
  }
}

function validChannel(channel: FormChannel) {
  return channel === "contact" || channel === "newsletter";
}

function validConsent(consent: ConsentEvidence): boolean {
  try {
    const origin = new URL(consent.origin);
    const notice = new URL(consent.noticeUrl);
    return DIGEST.test(consent.emailHash)
      && typeof consent.wording === "string" && consent.wording.length > 0 && consent.wording.length <= 2000
      && VERSION.test(consent.wordingVersion)
      && (consent.noticeVersion === null || VERSION.test(consent.noticeVersion))
      && consent.origin.length <= 512 && origin.origin === consent.origin
      && (origin.protocol === "https:" || (origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
      && consent.noticeUrl.length <= 2048 && notice.protocol === "https:" && !notice.username && !notice.password
      && Number.isSafeInteger(consent.listId) && consent.listId > 0
      && Number.isSafeInteger(consent.templateId) && consent.templateId > 0
      && Number.isInteger(consent.retentionDays) && consent.retentionDays >= 1 && consent.retentionDays <= 3650;
  } catch {
    return false;
  }
}

/** No connections or schema mutations occur until an operation is requested. */
export function createPostgresFormStore(env: StoreEnvironment = process.env): FormStore | null {
  const loaded = configuration(env);
  if (!loaded) return null;
  const config = loaded;
  const pool = new Pool(config.pool);
  // An idle connection can fail independently of a request. Never log driver
  // errors: they may contain connection details. Request failures stay generic.
  pool.on("error", () => {});

  async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient | undefined;
    let destroy = false;
    const connectionError = () => { destroy = true; };
    try {
      client = await pool.connect();
      client.on("error", connectionError);
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '1000ms'; SET LOCAL statement_timeout = '1500ms'; SET LOCAL synchronous_commit = on; SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
      const version = await client.query<{ version: number }>("SELECT version FROM acexperts_forms.schema_version WHERE singleton = true");
      if (version.rowCount !== 1 || version.rows[0].version !== 1) throw unavailable();
      await client.query(`
        INSERT INTO acexperts_forms.namespace_settings (scope, key_fingerprint) VALUES ($1, $2)
        ON CONFLICT (scope) DO NOTHING
      `, [config.scope, config.fingerprint]);
      const namespace = await client.query<{ key_fingerprint: string }>(
        "SELECT key_fingerprint FROM acexperts_forms.namespace_settings WHERE scope = $1", [config.scope]);
      if (namespace.rowCount !== 1 || namespace.rows[0].key_fingerprint !== config.fingerprint) throw unavailable();
      const result = await operation(client);
      if (destroy) throw unavailable();
      await client.query("COMMIT");
      return result;
    } catch {
      // A lost COMMIT acknowledgement has an unknown outcome. Destroy the
      // connection; do not retry a claim/provider request automatically.
      destroy = true;
      if (client) {
        try { await client.query("ROLLBACK"); } catch { /* Discard below. */ }
      }
      throw unavailable();
    } finally {
      client?.removeListener("error", connectionError);
      client?.release(destroy);
    }
  }

  return {
    async consumeRate(channel, limit) {
      if (!validChannel(channel) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100_000) throw unavailable();
      return transaction(async (client) => {
        const result = await client.query<{ hits: number; retry_after: number }>(`
          INSERT INTO acexperts_forms.rate_limits AS existing (scope, channel, window_start, hits)
          VALUES ($1, $2, date_trunc('minute', clock_timestamp()), 1)
          ON CONFLICT (scope, channel) DO UPDATE SET
            window_start = GREATEST(existing.window_start, EXCLUDED.window_start),
            hits = CASE WHEN existing.window_start >= EXCLUDED.window_start
              THEN LEAST(existing.hits + 1, $3::integer + 1) ELSE 1 END
          RETURNING hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM
            (window_start + interval '1 minute' - clock_timestamp()))))::integer AS retry_after
        `, [config.scope, channel, limit]);
        if (result.rowCount !== 1) throw unavailable();
        return { allowed: result.rows[0].hits <= limit, retryAfter: result.rows[0].retry_after };
      });
    },

    async claim(channel, digest, consent) {
      if (!validChannel(channel) || !DIGEST.test(digest)
        || (channel === "newsletter" && (!consent || !validConsent(consent)))
        || (channel === "contact" && consent !== undefined)) throw unavailable();
      return transaction(async (client) => {
        const candidateId = randomUUID();
        const inserted = await client.query(`
          INSERT INTO acexperts_forms.submissions (scope, channel, digest, request_id, status)
          VALUES ($1, $2, $3, $4, 'pending')
          ON CONFLICT (scope, channel, digest) DO NOTHING
          RETURNING request_id
        `, [config.scope, channel, digest, candidateId]);

        let acquired = inserted.rowCount === 1;
        let requestId: string = candidateId;
        let status: StoredStatus = "pending";
        if (!acquired) {
          const existing = await client.query<{ request_id: string; status: StoredStatus; can_retry: boolean }>(`
            SELECT request_id, status,
              (status IN ('accepted', 'rejected') AND retry_after <= clock_timestamp()) AS can_retry
            FROM acexperts_forms.submissions
            WHERE scope = $1 AND channel = $2 AND digest = $3
            FOR UPDATE
          `, [config.scope, channel, digest]);
          if (existing.rowCount !== 1) throw unavailable();
          const row = existing.rows[0];
          if (row.can_retry) {
            await client.query(`
              UPDATE acexperts_forms.submissions SET request_id = $4, status = 'pending', retry_after = NULL,
                created_at = clock_timestamp(), updated_at = clock_timestamp()
              WHERE scope = $1 AND channel = $2 AND digest = $3
            `, [config.scope, channel, digest, candidateId]);
            acquired = true;
          } else {
            requestId = row.request_id;
            status = row.status;
          }
        }

        if (acquired && consent) {
          // Persist checked consent before the caller can contact the provider.
          // Provider acceptance is NOT evidence of email confirmation.
          await client.query(`
            INSERT INTO acexperts_forms.consent_events
              (scope, request_id, email_hash, wording, wording_version, notice_url, notice_version,
               origin, list_id, template_id, retain_until)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              clock_timestamp() + ($11::integer * interval '1 day'))
          `, [config.scope, candidateId, consent.emailHash, consent.wording, consent.wordingVersion,
            consent.noticeUrl, consent.noticeVersion, consent.origin, consent.listId, consent.templateId, consent.retentionDays]);
        }
        return { acquired, requestId, status };
      });
    },

    async complete(channel, digest, requestId, status) {
      if (!validChannel(channel) || !DIGEST.test(digest) || !REQUEST_ID.test(requestId)
        || !["accepted", "rejected", "uncertain", "timeout"].includes(status)) throw unavailable();
      await transaction(async (client) => {
        const updated = await client.query(`
          UPDATE acexperts_forms.submissions SET status = $5, updated_at = clock_timestamp(),
            retry_after = CASE WHEN $5 = 'accepted' THEN clock_timestamp() + interval '30 minutes'
              WHEN $5 = 'rejected' THEN clock_timestamp() + interval '1 minute' ELSE NULL END
          WHERE scope = $1 AND channel = $2 AND digest = $3 AND request_id = $4 AND status = 'pending'
          RETURNING request_id
        `, [config.scope, channel, digest, requestId, status]);
        if (updated.rowCount !== 1) throw unavailable();
        if (channel === "newsletter") {
          const recorded = await client.query(`
            UPDATE acexperts_forms.consent_events SET delivery_status = $3, delivery_updated_at = clock_timestamp()
            WHERE scope = $1 AND request_id = $2 AND delivery_status = 'pending'
            RETURNING request_id
          `, [config.scope, requestId, status]);
          if (recorded.rowCount !== 1) throw unavailable();
        }
      });
    },

    async close() {
      try { await pool.end(); } catch { throw unavailable(); }
    },
  };
}

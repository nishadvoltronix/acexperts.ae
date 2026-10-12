// Synthetic local PostgreSQL recovery drill. Never accepts a hosted database.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { createPostgresFormStore } from "../lib/form-store.ts";
import { cleanupRecoveryResources } from "./helpers/recovery-cleanup.mjs";

const exec = promisify(execFile);
const workspace = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cache = path.join(workspace, "node_modules", ".cache", "acexperts-postgres");
const data = path.join(cache, "data");
const bin = path.join(cache, "binaries", "pgsql", "bin");
const hbaPath = path.join(data, "pg_hba.conf");
const tables = ["namespace_settings", "rate_limits", "submissions", "consent_events"];
const cleanupTables = [...tables].reverse();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const suffix = randomUUID().replaceAll("-", "");
const restoreDatabase = `acexperts_restore_${suffix}`;
const runtimeRole = `recovery_role_${suffix}`;
const scope = `recovery_${suffix}`;
const neighbor = `neighbor_${suffix}`;
const runtimePassword = randomBytes(24).toString("hex");
const stateSecret = randomBytes(32).toString("hex");
const fixtureDirectory = path.join(cache, "recovery-fixtures", suffix);
const dumpFile = path.join(fixtureDirectory, "synthetic-forms.dump");
const artifactArgument = process.env.ARTIFACT_DIR;
if (!artifactArgument) throw new Error("Set ARTIFACT_DIR to a fresh repository artifacts directory.");
const artifactDirectory = path.resolve(workspace, artifactArgument);
if (!artifactDirectory.startsWith(path.join(workspace, "artifacts") + path.sep)) throw new Error("Recovery evidence must stay under repository artifacts.");
const reportFile = path.join(artifactDirectory, `postgres-recovery-${suffix}.json`);

function connection() {
  try {
    const parsed = new URL(process.env.FORM_TEST_DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== "127.0.0.1"
      || parsed.port !== "55432" || decodeURIComponent(parsed.username) !== "acexperts_test"
      || decodeURIComponent(parsed.pathname) !== "/acexperts_test" || !parsed.password
      || parsed.search || parsed.hash || /[?#]/.test(process.env.FORM_TEST_DATABASE_URL)) throw new Error();
    return { parsed, options: { host: "127.0.0.1", port: 55432, user: "acexperts_test",
      password: decodeURIComponent(parsed.password), database: "acexperts_test", ssl: false,
      max: 2, connectionTimeoutMillis: 2000, query_timeout: 5000, statement_timeout: 4000 } };
  } catch { throw new Error("Refusing recovery drill: explicit isolated loopback127.0.0.1:55432 acexperts_test role/database required."); }
}
const { parsed, options } = connection();
const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) if (/^PG/i.test(key)) delete childEnv[key];
Object.assign(childEnv, { PGHOST: "127.0.0.1", PGPORT: "55432", PGUSER: "acexperts_test",
  PGPASSWORD: options.password, PGCONNECT_TIMEOUT: "3", PGSSLMODE: "disable" });
async function command(tool, arguments_, allowFailure = false) {
  try {
    const result = await exec(path.join(bin, `${tool}.exe`), arguments_, {
      env: childEnv, windowsHide: true, timeout: 30_000, maxBuffer: 1_000_000,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (allowFailure && Number.isInteger(error.code)) return { code: error.code, stdout: "", stderr: "" };
    throw new Error(`Local PostgreSQL ${tool} command failed; diagnostics withheld to protect connection details.`);
  }
}

const report = { verifiedAtUtc: new Date().toISOString(), timezone: "Asia/Dubai", syntheticLocalDatabaseOnly: true,
  productionBackupConfigured: false, liveProviderCalls: 0, checks: {}, passed: false, cleanup: false };
let admin;
let restored;
let restricted;
let restoreCreated = false;
let roleCreated = false;
let fixtureWritesStarted = false;
let hbaOriginal;
let hbaInstalled;
const stores = [];

function store(databaseName = "acexperts_test", storeScope = scope, useRuntime = false, key = stateSecret) {
  const url = new URL(parsed);
  url.pathname = `/${databaseName}`;
  if (useRuntime) { url.username = runtimeRole; url.password = runtimePassword; }
  const result = createPostgresFormStore({ FORM_DATABASE_URL: url.href, FORM_STORE_NAMESPACE: storeScope, FORM_STATE_SECRET: key });
  assert.ok(result);
  stores.push(result);
  return result;
}
const digest = (digit) => digit.repeat(64);
const consent = { emailHash: digest("e"), wording: "Synthetic recovery consent; no email will be sent.", wordingVersion: "recovery-v1",
  noticeUrl: "https://example.invalid/privacy/", noticeVersion: "recovery-policy-v1", origin: "https://example.invalid",
  listId: 42, templateId: 7, retentionDays: 30 };
async function snapshot(pool) {
  const rows = {};
  for (const table of tables) {
    rows[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM acexperts_forms.${table} AS t WHERE scope = ANY($1::text[]) ORDER BY to_jsonb(t)::text`, [[scope, neighbor]])).rows.map(({ row }) => row);
  }
  return rows;
}
async function expectDenied(query, values = []) {
  let code;
  try { await restricted.query(query, values); } catch (error) { code = error.code; }
  assert.equal(code, "42501");
}

try {
  report.phase = "verify_local_cluster_boundary";
  const actualWorkspace = await realpath(workspace);
  const actualCache = await realpath(cache);
  assert.ok(actualCache.startsWith(path.join(actualWorkspace, "node_modules", ".cache") + path.sep));
  for (const directory of [data, bin]) assert.ok((await realpath(directory)).startsWith(actualCache + path.sep));
  assert.equal((await readFile(path.join(data, "PG_VERSION"), "utf8")).trim(), "16");
  assert.equal((await command("postgres", ["-D", data, "-C", "listen_addresses"])).stdout.trim(), "127.0.0.1");
  assert.equal((await command("postgres", ["-D", data, "-C", "port"])).stdout.trim(), "55432");
  const status = await command("pg_ctl", ["status", "-D", data], true);
  if (status.code === 3) {
    await command("pg_ctl", ["start", "-D", data, "-l", path.join(cache, "server.log"), "-w", "-t", "20"]);
    report.localClusterStarted = true;
  } else assert.equal(status.code, 0);
  admin = new Pool(options);
  admin.on("error", () => {});
  assert.equal((await admin.query("SHOW data_directory")).rows[0].data_directory.replaceAll("\\", "/").toLowerCase(), data.replaceAll("\\", "/").toLowerCase());
  assert.equal((await admin.query("SELECT version FROM acexperts_forms.schema_version WHERE singleton = true")).rows[0]?.version, 1);
  report.postgresVersion = (await admin.query("SHOW server_version")).rows[0].server_version;
  report.checks.ownedLoopbackClusterAndMigration = true;
  await mkdir(fixtureDirectory, { recursive: true });
  await mkdir(artifactDirectory, { recursive: true });

  report.phase = "seed_synthetic_state";
  fixtureWritesStarted = true;
  const source = store();
  for (const [state, value] of [["accepted", "1"], ["rejected", "2"], ["pending", "3"], ["uncertain", "4"], ["timeout", "5"], ["accepted", "6"], ["rejected", "7"]]) {
    const claim = await source.claim("contact", digest(value));
    if (state !== "pending") await source.complete("contact", digest(value), claim.requestId, state);
  }
  await source.claim("newsletter", digest("8"), consent);
  const currentNewsletter = await source.claim("newsletter", digest("9"), consent);
  await source.complete("newsletter", digest("9"), currentNewsletter.requestId, "accepted");
  await admin.query("UPDATE acexperts_forms.submissions SET retry_after = clock_timestamp() - interval '1 hour' WHERE scope = $1 AND digest IN ($2,$3)", [scope, digest("6"), digest("7")]);
  await admin.query("UPDATE acexperts_forms.submissions SET retry_after = clock_timestamp() + interval '1 hour' WHERE scope = $1 AND digest = $2", [scope, digest("2")]);
  await admin.query("UPDATE acexperts_forms.consent_events SET recorded_at = clock_timestamp() - interval '2 days', retain_until = clock_timestamp() - interval '1 day' WHERE scope = $1 AND request_id <> $2", [scope, currentNewsletter.requestId]);
  const other = store("acexperts_test", neighbor);
  const otherClaim = await other.claim("newsletter", digest("a"), consent);
  await other.complete("newsletter", digest("a"), otherClaim.requestId, "accepted");
  await admin.query("UPDATE acexperts_forms.submissions SET retry_after = clock_timestamp() - interval '1 hour' WHERE scope = $1", [neighbor]);
  await admin.query("UPDATE acexperts_forms.consent_events SET recorded_at = clock_timestamp() - interval '2 days', retain_until = clock_timestamp() - interval '1 day' WHERE scope = $1", [neighbor]);
  await source.consumeRate("contact", 30);
  await source.consumeRate("contact", 30);
  await source.consumeRate("newsletter", 10);
  // Fixture-only future bucket avoids a minute rollover while checking recovery.
  await admin.query("UPDATE acexperts_forms.rate_limits SET window_start = date_trunc('minute', clock_timestamp()) + interval '5 minutes' WHERE scope = $1", [scope]);
  const before = await snapshot(admin);
  report.fixtureCounts = Object.fromEntries(Object.entries(before).map(([table, rows]) => [table, rows.length]));
  report.checks.syntheticAllOutcomeStatesAndNeighborSeeded = true;

  report.phase = "prepare_disposable_runtime_role_and_restore_database";
  await admin.query(`CREATE ROLE "${runtimeRole}" LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
  roleCreated = true;
  await admin.query(`GRANT USAGE ON SCHEMA acexperts_forms TO "${runtimeRole}"`);
  await admin.query(`GRANT SELECT ON acexperts_forms.schema_version TO "${runtimeRole}"`);
  await admin.query(`GRANT SELECT, INSERT ON acexperts_forms.namespace_settings TO "${runtimeRole}"`);
  await admin.query(`GRANT SELECT, INSERT, UPDATE ON acexperts_forms.rate_limits, acexperts_forms.submissions, acexperts_forms.consent_events TO "${runtimeRole}"`);
  await admin.query(`CREATE DATABASE "${restoreDatabase}" TEMPLATE template0`);
  restoreCreated = true;
  hbaOriginal = await readFile(hbaPath);
  hbaInstalled = Buffer.concat([Buffer.from(`host ${restoreDatabase} all 127.0.0.1/32 scram-sha-256\n`), hbaOriginal]);
  await writeFile(hbaPath, hbaInstalled);
  await command("pg_ctl", ["reload", "-D", data]);

  report.phase = "dump_and_restore";
  const backupStarted = performance.now();
  await command("pg_dump", ["--dbname", "acexperts_test", "--format=custom", "--schema=acexperts_forms", "--lock-wait-timeout=3s", "--no-password", "--file", dumpFile]);
  report.syntheticBackupMilliseconds = Math.round(performance.now() - backupStarted);
  report.backupBytes = (await stat(dumpFile)).size;
  report.backupSha256 = sha(await readFile(dumpFile));
  report.backupLocation = path.relative(workspace, dumpFile).replaceAll("\\", "/");
  const restoreStarted = performance.now();
  await command("pg_restore", ["--dbname", restoreDatabase, "--exit-on-error", "--single-transaction", "--no-owner", "--no-password", dumpFile]);
  report.syntheticRestoreMilliseconds = Math.round(performance.now() - restoreStarted);
  restored = new Pool({ ...options, database: restoreDatabase });
  restored.on("error", () => {});
  assert.deepEqual(await snapshot(restored), before);
  report.checks.logicalBackupRestoresExactScopedState = true;

  report.phase = "verify_restore_constraints_and_privileges";
  restricted = new Pool({ ...options, database: restoreDatabase, user: runtimeRole, password: runtimePassword });
  restricted.on("error", () => {});
  const recovered = store(restoreDatabase, scope, true);
  for (const row of before.submissions.filter((row) => row.scope === scope && ![digest("6"), digest("7")].includes(row.digest))) {
    const found = await recovered.claim(row.channel, row.digest, row.channel === "newsletter" ? consent : undefined);
    assert.deepEqual(found, { acquired: false, requestId: row.request_id, status: row.status });
  }
  await recovered.consumeRate("contact", 30);
  assert.equal((await restored.query("SELECT hits FROM acexperts_forms.rate_limits WHERE scope = $1 AND channel = 'contact'", [scope])).rows[0].hits, 3);
  assert.equal((await restored.query("SELECT hits FROM acexperts_forms.rate_limits WHERE scope = $1 AND channel = 'newsletter'", [scope])).rows[0].hits, 1);
  report.checks.restoredClaimsOutcomesIdsAndRateBudget = true;
  await expectDenied("DELETE FROM acexperts_forms.submissions WHERE scope = $1", [scope]);
  await expectDenied("UPDATE acexperts_forms.namespace_settings SET key_fingerprint = $2 WHERE scope = $1", [scope, "f".repeat(64)]);
  await expectDenied("UPDATE acexperts_forms.schema_version SET version = 2 WHERE singleton = true");
  report.checks.restoredRuntimeGrantsAndRestrictions = true;
  let invalidConfirmationCode;
  try { await restored.query("UPDATE acexperts_forms.consent_events SET confirmation_state = 'confirmed' WHERE scope = $1", [scope]); }
  catch (error) { invalidConfirmationCode = error.code; }
  assert.equal(invalidConfirmationCode, "23514");
  report.checks.restoredConsentConstraint = true;
  await assert.rejects(store(restoreDatabase, scope, false, "b".repeat(64)).consumeRate("contact", 30), { message: "Shared form store unavailable." });
  report.checks.restoredNamespaceFingerprintRejectsWrongKey = true;

  report.phase = "verify_migration_reapply_safety";
  const beforeReapply = sha(JSON.stringify(await snapshot(restored)));
  const repeatedMigration = await command("psql", ["--dbname", restoreDatabase, "--no-password", "--set=ON_ERROR_STOP=1", "--file", path.join(workspace, "db", "migrations", "001-form-state.sql")], true);
  assert.notEqual(repeatedMigration.code, 0);
  assert.equal(sha(JSON.stringify(await snapshot(restored))), beforeReapply);
  assert.equal((await restored.query("SELECT version FROM acexperts_forms.schema_version WHERE singleton = true")).rows[0].version, 1);
  report.checks.reapplyingOneTimeMigrationFailsWithoutDataLoss = true;

  report.phase = "verify_scoped_retention";
  const neighborBefore = sha(JSON.stringify((await snapshot(restored)).consent_events.filter((row) => row.scope === neighbor)));
  await command("psql", ["--dbname", restoreDatabase, "--no-password", "--set=ON_ERROR_STOP=1", "--set", `form_scope=${scope}`, "--file", path.join(workspace, "db", "maintenance", "form-state-retention.sql")]);
  const after = await snapshot(restored);
  assert.equal(after.submissions.filter((row) => row.scope === scope).length, 7);
  for (const value of ["6", "7"]) assert.ok(!after.submissions.some((row) => row.scope === scope && row.digest === digest(value)));
  for (const value of ["1", "2", "3", "4", "5", "8", "9"]) assert.ok(after.submissions.some((row) => row.scope === scope && row.digest === digest(value)));
  const remainingConsent = after.consent_events.filter((row) => row.scope === scope);
  assert.equal(remainingConsent.length, 1);
  assert.equal(remainingConsent[0].request_id, currentNewsletter.requestId);
  assert.equal(sha(JSON.stringify(after.consent_events.filter((row) => row.scope === neighbor))), neighborBefore);
  assert.equal(after.submissions.filter((row) => row.scope === neighbor).length, 1);
  report.checks.retentionDeletesOnlyExpiredScopedConsentAndTerminalClaims = true;
  report.checks.retentionPreservesCurrentAmbiguousAndNeighborRows = true;
  const retainedHash = sha(JSON.stringify(after));
  await command("psql", ["--dbname", restoreDatabase, "--no-password", "--set=ON_ERROR_STOP=1", "--set", `form_scope=${scope}`, "--file", path.join(workspace, "db", "maintenance", "form-state-retention.sql")]);
  assert.equal(sha(JSON.stringify(await snapshot(restored))), retainedHash);
  report.checks.retentionIsRepeatable = true;
  report.passed = true;
  report.phase = "complete";
} catch (error) {
  report.failure = "Local recovery verification failed; connection and data diagnostics are deliberately omitted.";
  if (/^[A-Z0-9]{5}$/.test(error.code ?? "")) report.errorCode = error.code;
  process.exitCode = 1;
} finally {
  const cleanup = await cleanupRecoveryResources({
    async closeStores() {
      const results = await Promise.allSettled(stores.map((instance) => instance.close()));
      if (results.some((result) => result.status === "rejected")) throw new Error("A recovery test pool could not close.");
    },
    async closeRuntime() { if (restricted) await restricted.end(); },
    async closeRestored() { if (restored) await restored.end(); },
    async dropRestoreDatabase() {
      if (admin && restoreCreated) {
        assert.match(restoreDatabase, /^acexperts_restore_[a-f0-9]{32}$/);
        await admin.query(`DROP DATABASE "${restoreDatabase}"`);
      }
    },
    async removeFixtures() {
      if (admin && fixtureWritesStarted) {
        for (const table of cleanupTables) await admin.query(`DELETE FROM acexperts_forms.${table} WHERE scope = ANY($1::text[])`, [[scope, neighbor]]);
      }
    },
    async removeRuntimeRole() {
      if (admin && roleCreated) {
        await admin.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA acexperts_forms FROM "${runtimeRole}"`);
        await admin.query(`REVOKE ALL PRIVILEGES ON SCHEMA acexperts_forms FROM "${runtimeRole}"`);
        await admin.query(`DROP ROLE "${runtimeRole}"`);
      }
    },
    async restoreHba() {
      if (hbaOriginal) {
        assert.equal(sha(await readFile(hbaPath)), sha(hbaInstalled), "Concurrent HBA edit detected; refusing to overwrite it.");
        await writeFile(hbaPath, hbaOriginal);
        await command("pg_ctl", ["reload", "-D", data]);
        assert.equal(sha(await readFile(hbaPath)), sha(hbaOriginal));
        report.checks.originalHbaRestored = true;
      }
    },
    async closeAdmin() { if (admin) await admin.end(); },
  });
  report.cleanup = cleanup.cleanup;
  if (!cleanup.cleanup) {
    report.passed = false;
    report.cleanupFailedSteps = cleanup.failed;
    report.cleanupFailure = "Owned fixture cleanup needs operator inspection; no broad or forced deletion was attempted.";
    process.exitCode = 1;
  }
  try { report.localClusterLeftRunningForFurtherTests = (await command("pg_ctl", ["status", "-D", data], true)).code === 0; }
  catch { report.localClusterLeftRunningForFurtherTests = false; }
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ passed: report.passed, phase: report.phase, checks: report.checks, cleanup: report.cleanup,
    report: path.relative(workspace, reportFile).replaceAll("\\", "/") }));
}

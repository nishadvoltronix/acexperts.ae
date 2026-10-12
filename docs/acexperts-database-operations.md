# AC Experts database operations and recovery

Updated 12 October 2026, Asia/Dubai. **Local synthetic recovery is COMPLETE. Hosted backup configuration, recovery objectives, retention-policy approval and a restore drill on the selected host remain BLOCKED by external setup.** No production database, hosting account or live Brevo service was touched.

This document complements the [deployment runbook](acexperts-deployment-runbook.md) and [delivery configuration](delivery-configuration.md#shared-postgresql-setup-and-operations). PostgreSQL remains portable; no hosting provider, managed backup service or production RPO/RTO has been selected.

## Tested local evidence

The final [guarded recovery script](../scripts/postgres-recovery-check.mjs), including the hardened independent cleanup, passed on the existing isolated PostgreSQL **16.15** cluster at 13:38 Asia/Dubai on 12 October 2026. [Final redacted results](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/postgres-recovery-386efb7a8c604f35a1b0e0cedf5a1453.json). The [earlier successful drill](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/postgres-recovery-3f53b822f4ce475fbc98e6248863556a.json) is preserved separately.

| Verification | Observed result |
| --- | --- |
| Backup and restore | `pg_dump` custom archive restored with `pg_restore --single-transaction --exit-on-error` into a newly created, uniquely named local test database. |
| Restored contents | Exact scoped equality for 10 submissions, 3 consent events, 2 rate buckets and 2 namespace records. |
| Durable protections | Accepted, rejected, pending, uncertain and timeout outcomes retained their request IDs; protected duplicate claims stayed blocked; previous rate usage remained. |
| Consent and configuration | Consent rows survived; the constraint still rejected manufactured confirmation; a different namespace HMAC key failed closed. |
| Runtime permissions | Restored grants supported real store operations for a disposable restricted login. Submission deletion, namespace-key changes and schema-version changes were denied. |
| Migration repeat | Reapplying the deliberately one-time migration failed; scoped rows and schema version remained unchanged. |
| Retention | The real maintenance SQL removed only expired consent and expired accepted/rejected claims in the requested scope. Current, pending, uncertain, timeout and neighboring-scope records survived. Repeating maintenance changed nothing further. |
| Cleanup | Generated restore database, runtime role and source fixtures were removed; original local HBA bytes were restored. The owned cluster was left running for the root agent's remaining tests, with final lifecycle recorded by the overall report. |

The final synthetic archive was **14,147 bytes**; dump took **278 ms** and restore **235 ms**. These tiny local-fixture measurements are not a production RPO, RTO, performance promise or managed-backup verification. The archive remains under ignored `node_modules/.cache/acexperts-postgres/recovery-fixtures/`; its SHA-256 and exact path are in the redacted results. It contains synthetic data only, and no role password or state secret is saved with it.

PostgreSQL documents that `pg_dump` produces a consistent logical snapshot of one database; global roles require separate handling. Custom archives are restored using `pg_restore`. The local drill retains its disposable role during restore so the saved ACLs can be verified; a new server must provision approved roles separately. [PostgreSQL pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).

## Repeat the local drill safely

Use this only for the already provisioned ignored local test cluster. The script refuses any source other than PostgreSQL on **127.0.0.1:55432**, database **`acexperts_test`**, role **`acexperts_test`**. It checks the cluster directory, binary paths, configured listen address, port and migration version before fixtures. Supply that synthetic test URL through `FORM_TEST_DATABASE_URL` privately; do not paste credentials into this document, a terminal transcript or Git.

From the repository root in PowerShell, with the test URL already supplied to the process:

```powershell
$env:ARTIFACT_DIR = 'artifacts/production-readiness-2026-10-12T09-25-27-738Z'
node scripts/postgres-recovery-check.mjs
```

Each run generates a fresh evidence filename and test namespace, preserving older artifacts. It starts only the owned local cluster if stopped, adds a temporary **exact generated database name** to that cluster's loopback SCRAM HBA rules, reloads only that cluster and restores the original bytes during cleanup. Do not run a concurrent HBA edit or another recovery drill: a changed HBA hash causes a cleanup failure instead of overwriting another edit. Ordinary shared-store tests must wait until the recovery drill reports completion.

The script never calls Brevo. It intentionally leaves the local cluster running for subsequent integration checks. A failure returns a nonzero exit code and a redacted phase/check report; inspect that before retrying. Cleanup steps run independently: a pool, database or role cleanup failure cannot skip the exact-hash-guarded HBA restoration attempt or admin-pool closure. Hermetic regression tests inject these failures without changing a database or HBA file. Failed cleanup requires inspection of the generated test resources. Never broaden cleanup to other databases, roles, namespaces or cache directories.

## Hosted backup policy still required

Before staging or production collection, the database owner must approve and configure:

1. A separate staging database and production database with verified TLS, restricted network access, WAL durability, `fsync`, `full_page_writes` and synchronous commits. Keep migration/backup/maintenance privileges separate from the application login.
2. Required **RPO** (maximum acceptable lost data) and **RTO** (maximum acceptable recovery duration), a backup schedule and restore-drill frequency. No values are assumed here.
3. Provider snapshots/base backups and continuous WAL/PITR where required by those objectives; a logical dump alone does not establish continuous recovery. Choose encryption, key ownership, backup access, independent failure-domain storage and integrity checks.
4. Backup retention and deletion, including archived consent evidence, restore copies and applicable deletion requests. Approve handling of pseudonymous unresolved claims alongside the normal consent retention window.
5. Failure alerts, backup-age monitoring, storage/capacity alerts, restore ownership and a documented escalation path. Store only redacted incident metadata in repository evidence.
6. Protected recovery of the **same HMAC state secret**, namespace and relevant Brevo configuration. Database archives contain the key fingerprint, not the secret. Uncoordinated key/namespace changes bypass previous identity matching or fail closed and are not a recovery method.

These are operator prerequisites, not configured services. PostgreSQL distinguishes logical dumps, filesystem backups and continuous archiving; select the approach with the actual host and objectives. [PostgreSQL backup methods](https://www.postgresql.org/docs/16/backup.html).

## Authorized staging restore procedure

Do not execute this procedure until the target environment and operator actions are authorized. Restore into a **new private recovery database**, never over the live writer. Obtain its exact endpoint and identity, encryption/access controls, sufficient capacity and approved role mapping first. Keep Brevo disabled throughout recovery validation.

For an approved libpq service named `acexperts-staging-backup`, a logical backup command is:

```text
pg_dump --dbname=service=acexperts-staging-backup --format=custom --file=APPROVED_ENCRYPTED_BACKUP_PATH --no-password
```

Use an approved secret manager/passfile and service configuration; do not put passwords in command arguments or the repository. `APPROVED_ENCRYPTED_BACKUP_PATH` is a required operator substitution, not an existing path or encryption performed by `pg_dump`. Check exit status, backup age/size and a cryptographic checksum, and inspect warnings privately.

After an authorized operator creates and validates a fresh empty destination and provisions the required roles, restore through an approved `acexperts-staging-recovery` service:

```text
pg_restore --dbname=service=acexperts-staging-recovery --single-transaction --exit-on-error --no-owner --no-password APPROVED_ENCRYPTED_BACKUP_PATH
```

These service names are proposed local configuration aliases, not evidence that hosted endpoints exist. Do not add `--clean` or point the recovery alias at the current production database. Restore only trusted archives: restoration executes SQL from the source. Document role ownership and ACL mapping explicitly; verify the restricted runtime login after restore.

Validate schema version, constraints, grants, row counts/checksums, namespace fingerprints, consent wording/notice versions, all protected outcome states and remaining rate budgets. Use fake provider transport to prove duplicate suppression through two actual application processes and across restart. Reconcile actual provider confirmation/withdrawal state separately; the application audit deliberately remains `not_verified`.

**A restored snapshot can omit submissions accepted after the backup.** Before enabling sends, identify the recovery point and reconcile the lost interval against provider evidence and application/operator records. Freeze dispatch until missing accepted or uncertain claims have been safely reconciled. Never assume that a successful restore alone prevents resending messages from the lost interval. Approval to restore does not authorize automatic message replay.

Record observed recovery duration, restore point, scoped test outcomes, access/secret checks and cleanup. Only after review and explicit release authorization may operators switch applications to the validated endpoint. Retain the prior database/backup for the approved rollback window; do not destroy it as part of application rollback.

## Migration and application rollback

`db/migrations/001-form-state.sql` is a one-time, transactional creation migration. Apply it only to an approved empty target using a migration-owner connection and stop-on-error. Check for existing `acexperts_forms.schema_version` first. If version 1 is already present, verify it and skip this migration; do not remove the schema or edit version metadata to make a rerun pass. The local replay test proves a second application fails without deleting existing rows.

Future schema changes need a new reviewed migration, compatibility checks across overlapping app versions, a verified backup and an authorized recovery plan. Roll back the application artifact while preserving the database, HMAC secret and namespace whenever schema compatibility allows. Never roll back to an application that sends without shared protection. If compatibility cannot be guaranteed, keep sending disabled while an operator restores or forwards a reviewed compatible version.

## Retention and reconciliation operations

`NEWSLETTER_CONSENT_RETENTION_DAYS` records a deadline; it does not schedule deletion. Only an approved maintenance owner should schedule the existing SQL with the exact authorized namespace:

```text
psql "service=acexperts-staging-owner" -v ON_ERROR_STOP=1 -v form_scope=acexperts_staging -f db/maintenance/form-state-retention.sql
```

The service and namespace above are examples requiring operator approval. The tested script removes expired consent events and expired accepted/rejected claims only within that namespace. It leaves current rows and pending/uncertain/timeout claims untouched. It is repeatable, but production frequency and retention periods still need approval. Monitor overdue rows and job failures; enforce the corresponding protected-backup retention policy too.

An expired consent event can be removed while its unresolved deduplication claim remains. That remaining keyed claim still protects against unsafe resend and requires an approved retention/reconciliation decision. Reconcile against provider records before releasing unresolved claims; record the decision in a protected operator system. Deleting a database row does not unsubscribe a Brevo contact or remove provider-held data. Withdrawal, provider retention and data-rights requests need the separately verified Brevo/operator workflow.

## Remaining database launch blockers

Hosted database, region/topology, verified remote TLS, least-privilege credentials and connection budgets remain unconfigured. Hosted snapshots/PITR, encrypted backup storage, approved RPO/RTO, scheduled retention, backup deletion and alert ownership remain unverified. The actual selected host must pass a protected restore drill and provider-reconciliation exercise before production readiness can be claimed. The completed local test closes the missing local recovery evidence, not these external requirements.

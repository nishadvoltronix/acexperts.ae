-- Apply once with a migration owner, never from a web request. The application
-- role needs schema USAGE, schema_version SELECT, namespace_settings SELECT/INSERT,
-- and rate_limits/submissions/consent_events SELECT/INSERT/UPDATE.
-- Keep DELETE/DDL/retention maintenance in a separate privileged operator role.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL synchronous_commit = on;

CREATE SCHEMA acexperts_forms;
REVOKE ALL ON SCHEMA acexperts_forms FROM PUBLIC;

CREATE TABLE acexperts_forms.schema_version (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version integer NOT NULL CHECK (version > 0)
);
INSERT INTO acexperts_forms.schema_version (singleton, version) VALUES (true, 1);

-- A hash of the decoded HMAC key binds each namespace to one configuration.
-- Different keys on different instances fail closed instead of bypassing dedup.
-- Key rotation requires an operator-coordinated drain/reconciliation/migration.
CREATE TABLE acexperts_forms.namespace_settings (
  scope text PRIMARY KEY CHECK (scope ~ '^[a-z0-9_-]{1,64}$'),
  key_fingerprint text NOT NULL CHECK (key_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- One bucket per deployment namespace and channel. All application instances
-- must use the SAME namespace and database; staging and production must differ.
CREATE TABLE acexperts_forms.rate_limits (
  scope text NOT NULL CHECK (scope ~ '^[a-z0-9_-]{1,64}$'),
  channel text NOT NULL CHECK (channel IN ('contact', 'newsletter')),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits BETWEEN 1 AND 100001),
  PRIMARY KEY (scope, channel)
);

CREATE TABLE acexperts_forms.submissions (
  scope text NOT NULL CHECK (scope ~ '^[a-z0-9_-]{1,64}$'),
  channel text NOT NULL CHECK (channel IN ('contact', 'newsletter')),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'uncertain', 'timeout')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retry_after timestamptz,
  PRIMARY KEY (scope, channel, digest),
  UNIQUE (scope, request_id),
  CHECK ((status IN ('accepted', 'rejected') AND retry_after IS NOT NULL)
    OR (status IN ('pending', 'uncertain', 'timeout') AND retry_after IS NULL))
);
CREATE INDEX submissions_reconcile ON acexperts_forms.submissions (scope, status, updated_at);
CREATE INDEX submissions_expiry ON acexperts_forms.submissions (scope, retry_after)
  WHERE status IN ('accepted', 'rejected');

-- Email is stored as a keyed HMAC, never a raw address. A DOI request records
-- a consent REQUEST; acceptance must never be promoted to confirmation here.
-- Provider confirmation/suppression must be verified separately in Brevo.
CREATE TABLE acexperts_forms.consent_events (
  scope text NOT NULL CHECK (scope ~ '^[a-z0-9_-]{1,64}$'),
  request_id uuid NOT NULL,
  email_hash text NOT NULL CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  wording text NOT NULL CHECK (length(wording) BETWEEN 1 AND 2000),
  wording_version text NOT NULL CHECK (wording_version ~ '^[a-zA-Z0-9._-]{1,100}$'),
  notice_url text NOT NULL CHECK (length(notice_url) BETWEEN 1 AND 2048),
  notice_version text CHECK (notice_version ~ '^[a-zA-Z0-9._-]{1,100}$'),
  origin text NOT NULL CHECK (length(origin) BETWEEN 1 AND 512),
  list_id bigint NOT NULL CHECK (list_id > 0),
  template_id bigint NOT NULL CHECK (template_id > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retain_until timestamptz NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'accepted', 'rejected', 'uncertain', 'timeout')),
  delivery_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  confirmation_state text NOT NULL DEFAULT 'not_verified' CHECK (confirmation_state = 'not_verified'),
  PRIMARY KEY (scope, request_id),
  CHECK (retain_until > recorded_at)
);
CREATE INDEX consent_events_subject ON acexperts_forms.consent_events (scope, email_hash, recorded_at);
CREATE INDEX consent_events_retention ON acexperts_forms.consent_events (scope, retain_until);

-- These are ordinary, WAL-logged tables. Production provisioning must keep
-- fsync/full_page_writes enabled, durable storage and a backup/restore policy.
-- There is intentionally no automatic expiry for pending/uncertain/timeout:
-- an operator must reconcile provider state before releasing a blocked claim.
COMMIT;

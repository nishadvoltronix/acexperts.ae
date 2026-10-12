# AC Experts staging configuration and controlled test checklist

12 October 2026, Asia/Dubai. This is an operator checklist, not completed deployment evidence. Hosting and the staging hostname remain unselected. The proposed hostname is **`https://staging.acexperts.ae`**, subject to approval and provisioning. No DNS, hosting, Brevo account or production changes are authorized by this document.

The application is a Next.js Node server with request-time CSP nonces, server API handlers and shared PostgreSQL state. It needs Node-capable hosting and a persistent shared PostgreSQL database; static-only hosting is insufficient. No deployment manifest identifies a current provider. [Implementation and exact settings](delivery-configuration.md); [verification evidence and blockers](acexperts-staging-readiness-report.md).

## Before provisioning or enabling delivery

- [ ] Select hosting provider/region, Node runtime, persistent/serverless topology, maximum instances and trusted proxy. Assign deployment, database and Brevo owners.
- [ ] Obtain explicit authorization for staging deployment and any DNS/account changes. Propose `staging.acexperts.ae`; do not assume the hostname exists or is available.
- [ ] Preserve all reviewed tracked/untracked implementation files in the proposed release and identify the exact revision or immutable artifact. Do not deploy the old Git HEAD alone. Obtain separate commit/push authorization when needed.
- [ ] Provision HTTPS and edge identity authentication with an authorized tester allowlist; an IP gate is acceptable for approved fixed tester networks. Protect **all** paths, including API, static files, images, robots and sitemap.
- [ ] Lock the direct origin/provider hostname so it cannot bypass access controls. Test both unauthorized and authorized access externally. Authentication is not supplied by `FORM_ALLOWED_ORIGINS`.
- [ ] Add **staging-only** `X-Robots-Tag: noindex, nofollow` at the hosting edge for all staging responses. Verify it on authenticated pages and responses. Keep production canonical URLs; do not rewrite production indexing rules or rely on noindex as access control.
- [ ] Preserve private/no-store nonce-bearing HTML. Configure HTTPS, body/connection limits, trusted per-client rate limits, forwarding-header overwrite and sanitized operational logs at the ingress.
- [ ] Keep live Brevo settings disabled until all prerequisites and explicit test-send authorization are recorded. Never run browser/load/failure suites against live credentials.

## PostgreSQL and secret configuration

- [ ] Provision a separate staging database with private access, verified TLS, persistent WAL/storage, `fsync`, `full_page_writes`, synchronous commits, monitoring and a tested backup/restore policy.
- [ ] Apply `db/migrations/001-form-state.sql` once through the migration owner, with stop-on-error. Verify schema version 1. Do not run DDL from the app or use a production database for testing.
- [ ] Grant a separate runtime login only the schema/table permissions in [the delivery guide](delivery-configuration.md#shared-postgresql-setup-and-operations). Verify it cannot perform DELETE/DDL or modify the namespace fingerprint. Account for up to three pooled connections per form handler, up to six per application worker for both forms, multiplied by worker processes and replicas.
- [ ] Set `FORM_DATABASE_URL` through the secret manager, with URL-encoded credentials and no query/fragment. Remote TLS verification must remain enabled. Confirm the provider connection endpoint supports ordinary transactions.
- [ ] Generate a random 32-byte `FORM_STATE_SECRET` as 64 hexadecimal characters directly into secret storage. All staging instances and release overlaps must use the same value. No secret belongs in shell history, screenshots or repository artifacts.
- [ ] Set a stable staging `FORM_STORE_NAMESPACE`, such as `acexperts_staging`; use separate production database, namespace and secrets. Verify every staging instance resolves the same database/namespace/key fingerprint.
- [ ] Assign reconciliation and retention owners. Pending/uncertain/timeout claims remain blocked until provider reconciliation and a documented operator decision; their pseudonymous data also needs an approved retention and reconciliation policy. Changing namespace/key or deleting claims is not an automatic recovery procedure.
- [ ] Test with fake Brevo transport: concurrent requests through two real application processes, shared 30-contact/10-newsletter database-minute budgets, 429/Retry-After, restart persistence, database outage, commit ambiguity, schema/key mismatch and inability to fall back to process memory.
- [ ] Verify secret redaction in host/proxy/database logs and public assets/responses. A successful local synthetic-marker scan does not establish the deployed log policy.

## Brevo staging-only configuration

Follow [the eight exact account setup steps](delivery-configuration.md#exact-brevo-setup-steps). Record actual values only in approved secret/configuration storage; the following table contains names and approval checks, not credentials.

| Application setting | Staging operator check |
| --- | --- |
| `BREVO_API_KEY` | Dedicated approved standard API key; owner/expiry/rotation recorded; account transactional sending and required egress-IP access enabled. |
| `CONTACT_FROM_EMAIL` | Approved sender verified in Brevo; sending domain authenticated. Any required DNS changes are performed only by an authorized operator. |
| `CONTACT_TO_EMAIL` | Controlled, monitored inbox whose owner explicitly authorizes test messages. Never use an unapproved customer/team address. |
| `BREVO_NEWSLETTER_LIST_ID` | Dedicated staging confirmed-newsletter list, matched by ID and name; no production audience or unconfirmed seed contacts. |
| `BREVO_NEWSLETTER_DOI_TEMPLATE_ID` | Dedicated active staging API DOI template, approved sender/wording and button URL exactly `{{ params.DOIurl }}`. Record its reviewed version. |
| `BREVO_NEWSLETTER_REDIRECT_URL` | Approved HTTPS destination reachable after confirmation. Authorized testers must be able to pass the staging gate; do not disable the gate for convenience. |
| `FORM_ALLOWED_ORIGINS` | Exact approved staging HTTPS origin, proposed `https://staging.acexperts.ae`; no trailing slash/path/wildcard. Verify foreign origins still fail. |

- [ ] Keep staging list/template IDs distinct from production. Confirm account credits and planned send count; disable unrelated automations for the staging audience through an authorized account operator.
- [ ] Verify the DOI sender/template and per-contact tracking feature. The request's `contactPixelTrackingConsent: false` may be ignored if the feature is disabled; inspect received email behavior.
- [ ] Configure the separately approved test campaign's real Brevo unsubscribe link/page. Marketing and transactional blocklists are different; account checks must cover the relevant channel.

## Privacy and durable consent

- [ ] Have the business approve an actual published notice covering enquiry/newsletter purposes, controller/contact identity, Brevo/database processing, relevant transfers, retention, data enquiries and withdrawal. Do not publish a fabricated policy.
- [ ] Set approved HTTPS `PRIVACY_NOTICE_URL` and immutable `PRIVACY_NOTICE_VERSION`. Verify both forms visibly link the notice. Newsletter dispatch fails closed when these settings are missing/invalid; public enquiry collection still requires the operator's privacy approval.
- [ ] Set owner-approved `NEWSLETTER_CONSENT_RETENTION_DAYS` from 1–3,650. Schedule restricted operator cleanup and backup handling using `db/maintenance/form-state-retention.sql` with an explicitly approved `-v form_scope`; the application records deadlines but does not execute deletion jobs. The script deletes only expired consent and expired accepted/rejected claims, never pending/uncertain/timeout claims.
- [ ] Verify unchecked consent, server rejection of missing/false consent, invalid/stale `consentVersion`/`noticeVersion`, and no newsletter enrollment from contact enquiries.
- [ ] Inspect a controlled audit row: keyed email identity, request ID, server time, exact wording/version, notice URL/version, origin, list/template IDs, retention deadline and provider outcome. Confirm no raw address/body/IP is retained in this app store.
- [ ] Verify the audit row exists before dispatch and persists after a process restart. Keep `confirmation_state = not_verified`: provider acceptance and redirect visits are not confirmation evidence.
- [ ] Define and test the protected Brevo/operator record process for actual confirmation and withdrawal, including matching wording/notice/template versions, access controls and retention. No automatic confirmation/unsubscribe webhook exists in this implementation.

## Controlled live-delivery plan

**No authorized test addresses have been supplied and no live test has been performed.** Run this plan only after the owner explicitly authorizes the named test inboxes, sender/account/list/template, send purposes and maximum send count. Store the address allowlist privately outside the repository. The application does not enforce a staging recipient allowlist; operator control and staging access protection are essential. Authorization to test one enquiry/DOI is not authorization to send a campaign.

1. Record the approved build, environment, operator, controlled inbox identities and planned cases. Confirm the account contains only the intended staging audience and no campaign/automation can include production contacts. Keep the regression/mock environment separate from this credentialed environment.
2. Send **one contact enquiry at a time** from an authorized test identity to the controlled `CONTACT_TO_EMAIL`. Wait for the full result. Require HTTP 200, matching Brevo acceptance/log entry and actual inbox arrival, then inspect sender, recipient, content and Reply-To. If the result is pending/uncertain/timeout, stop and reconcile provider state before any resubmission.
3. Send **one DOI request at a time** for an authorized new test address using current explicit consent. Record its initial absence from the confirmed list. Require audit persistence, HTTP 200 and actual confirmation-email arrival. Verify the address is not eligible for marketing before clicking. Do not infer arrival from API acceptance.
4. Have the inbox owner follow the actual generated confirmation link. Verify the approved redirect, list membership and marketing eligibility in Brevo. Retain provider confirmation evidence with notice/wording/template versions. Do not write `confirmed` into the app's deliberately unverified audit field.
5. Only with explicit agreement from each test inbox owner, repeat controlled cases for already confirmed, existing unconfirmed/unrelated-list, marketing-unsubscribed and transactional-blocked contacts. Record before/after memberships, suppression and actual email behavior. Do not manually unblock real contacts. Any supported re-subscription must follow fresh approved consent/confirmation.
6. Obtain **separate campaign-send authorization**. Preview its audience and verify it contains only approved confirmed test contacts. Send the approved test campaign, follow its genuine unsubscribe flow and verify withdrawal/marketing suppression. Confirm exclusion from the next audience preview; a further actual send requires authorization too. Inspect one-click unsubscribe if the mailbox offers it.
7. Record only redacted test IDs, Asia/Dubai timestamps, build reference, HTTP results, provider event/log IDs, audit request IDs and observed outcomes in repository evidence. Keep personal addresses, message content, credentials, DOI/unsubscribe tokens and personalized links in the approved protected evidence system.
8. Stop on unexpected recipients, unconfirmed marketing eligibility, lost consent evidence, failed unsubscribe, ambiguous outcomes or leaked data. Disable staging sends through the approved operator workflow; investigate with sanitized logs. Do not clear durable claims or repeat requests blindly. Return the controlled environment to the agreed disabled/test-only state and retain evidence according to policy.

Load, rate-limit, concurrency, deliberate provider-failure and restart tests must use a fake provider, even when PostgreSQL is real. Live tests are small acceptance checks, not stress tests.

## Before production launch

- [ ] Resolve all blocking rows in the readiness report; choose and verify the actual host/ingress/database topology, access boundaries, live Brevo lifecycle, privacy notice and operational retention.
- [ ] Review production-specific sender, recipient, list/template, redirect, notice, origin, database, namespace and stable key. Keep staging credentials/data isolated.
- [ ] Verify production HTTPS/security headers, intended indexing, canonical URLs, redirects, sitemap and API behavior; staging noindex/access settings must remain scoped to staging.
- [ ] Prepare monitoring, provider/database failure alerts, retention/reconciliation ownership, secret rotation and tested rollback preserving shared state. Review the full uncommitted release contents.
- [ ] Obtain explicit authorization for each needed commit, push, deployment, DNS change or production-service restart. Nothing in this checklist substitutes for that authorization.
- [ ] After an authorized launch, perform a separately authorized controlled smoke test and record actual outcomes. Do not declare production readiness while critical blockers or live lifecycle failures remain.

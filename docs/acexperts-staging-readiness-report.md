# AC Experts staging-readiness report

**Certification update — 12 October 2026:** The owner confirmed NADCA, ISIAQ, ISSA and IAQA, then separately confirmed “ISO is verified; project details pending.” These confirmations supersede the certification omission/blocker wording below. The four homepage credentials and emergency `ISO Certified` label are implemented; [current requirements and verification status](acexperts-requirements-verification.md#latest-full-document-and-iso-recheck) record the additions. Additional projects remain pending. Historical counts/evidence and the separate security, hosting, privacy and live-delivery release blockers are unchanged.

Historical staging implementation report. The later [production-readiness report](acexperts-production-readiness-report.md) records the latest fixes, fresh tests, local restore drill, dependency decision and remaining launch gates. Evidence below remains the dated result of the prior continuation.

Updated 12 October 2026, Asia/Dubai. Working tree based on `main` at `dd775cc55dc6d7611baab542a8142701b4b965f6`.

**Decision: shared-state implementation and local verification are complete. Hosted staging verification and production launch remain blocked by external setup and acceptance evidence.** No hosting provider is selected. The user approved portable PostgreSQL because there is no existing provider/database to use.

No commit, push, deployment, DNS/account change, live Brevo send or production-service restart was performed. Existing application changes and historical artifacts were preserved. Only isolated local Next/PostgreSQL test processes were used; they have been stopped. [Service cleanup](../artifacts/shared-staging/service-cleanup.json).

Use the [staging checklist](staging-configuration-checklist.md) for the operator sequence and [delivery guide](delivery-configuration.md) for exact settings, SQL privileges, eight Brevo setup steps and acceptance criteria. The [previous report](../artifacts/shared-staging/previous-staging-report.md) is retained as historical evidence; its missing shared-state implementation and browser-failure findings are superseded below.

## Repository review and preserved work

The starting tree contained **21 modified tracked files, 24 new non-artifact files and 315 prior artifacts**, with no staged changes. The initial SHA-256 inventory is [git-before.json](../artifacts/shared-staging/git-before.json). Source review covered the existing changes and the delivery, security, consent and browser assertions affected by this task. The original content/preservation baseline was retained. All 315 prior artifacts remain byte-identical; no pre-existing file was removed. [Final inventory and preservation comparison](../artifacts/shared-staging/git-after.json).

Changes in this continuation:

- Added the portable [PostgreSQL store](../lib/form-store.ts), [versioned migration](../db/migrations/001-form-state.sql), restricted [retention maintenance script](../db/maintenance/form-state-retention.sql), `pg` dependency and real PostgreSQL tests.
- Replaced production process-local submission state with durable claims and shared budgets; adapted both form handlers and request guards. Missing or failing shared state cannot dispatch through an in-memory fallback.
- Added versioned newsletter consent records, approved-notice configuration and conditional privacy links in the existing forms. No page redesign, CSS or content-data change was needed.
- Corrected provider HTTP 408/409 handling to retain uncertainty, with a regression covering both forms beyond normal retry windows and after handler reinitialization.
- Updated original historical browser scripts where evidence proved their assertions obsolete, retaining full default coverage and strengthening form checks. Added output-directory support to preserve previous artifacts.
- Updated `.env.example`, README and staging documentation. Fresh evidence is under `artifacts/shared-staging/`.

Required source files remain uncommitted. Deploying the existing Git HEAD alone would omit them. Review and identify the exact candidate revision/artifact before any authorized release. Preserve LF bytes in release/CI checkout: existing raw-byte preservation tests and `core.autocrlf=true` must not be reconciled by silently changing the baseline. The build-generated `next-env.d.ts` change was restored to its initially clean content.

## Hosting architecture and proposed staging boundary

Repository evidence identifies a **Next.js 16.3.8 Node App Router server**, dynamic nonce-bearing HTML and Node API handlers. It does not identify a deployed provider, ingress, container/service manifest, database service or CI deployment. Static-only hosting cannot run these handlers. The new database adapter uses portable `node-postgres`, ordinary transactions and verified TLS for remote connections.

Propose **`https://staging.acexperts.ae`**, subject to approval and provisioning. Use edge identity authentication with an authorized tester allowlist; approved fixed-network IP access is an alternative. Protect every path, including API/assets, and prevent direct-origin/provider-hostname bypass. Apply staging-only `X-Robots-Tag: noindex, nofollow`, preserve production canonicals and do not cache nonce-bearing HTML. An origin allowlist is neither authentication nor indexing protection. No DNS or hosting setting was changed.

Hosting choice must settle region, Node version, worker/replica limits, trusted forwarding headers, client-specific ingress limits, TLS, database connection budget, secret storage, sanitized logs and backup/recovery. Pools are reused per handler, with up to three connections each: up to six for both forms per application worker, multiplied by workers/replicas. None of those deployed controls has been verified.

## Durable limits, duplicate protection and failure behavior

| Behavior | Implemented and observed locally | Practical boundary |
| --- | --- | --- |
| Shared rate budget | Atomic PostgreSQL fixed-minute budgets: contact 30, newsletter 10 across pools and separate Node processes; DB clock; 429 with Retry-After | Global environment budgets. Trusted client-specific ingress protection remains required; fixed windows can allow boundary bursts. |
| Concurrent duplicates | HMAC of namespace, channel and normalized payload; one atomic claim owner; stable persisted request UUID; claim commits before provider call | All instances must share database, namespace and state key. Separate environment namespaces intentionally isolate state. |
| Completed duplicates | Accepted result reused for 30 minutes; definite rejection held for 60 seconds; only an explicit later submission can acquire a new UUID | Finite cooldown, not permanent uniqueness. |
| Ambiguous outcomes | Pending, timeout and uncertain claims never expire automatically; provider 408/409, 5xx, network/receipt ambiguity stay uncertain | Operator reconciliation is required before releasing a blocked claim; never clear state or rotate namespace as recovery. |
| Database faults | Missing/invalid config, unavailable DB, schema/key mismatch and claim failure prevent dispatch; outcome-write failure stays uncertain/protected | No automatic provider retry or process-memory fallback. Hosted durability/failover still needs verification. |
| Credentials and privileges | Parameterized queries, bounded connections/queries, sanitized public errors, remote TLS verification, restricted runtime grants | Hosting/proxy/provider log redaction and secure provisioning remain operator tasks. |

The [14 real PostgreSQL integration cases](../scripts/shared-store.test.mjs) passed against isolated PostgreSQL 16.15, including independent pools, three child-process claim races, process-shared budgets, DB-time expiry, key mismatch, atomic consent rollback, actual handlers with mocked Brevo transport, and a real completion-write lock timeout with no resend. These are separate processes using the shared store, not a deployed multi-replica HTTP cluster.

An additional [actual database restart check](../artifacts/shared-staging/restart-verification.json) verified persistence of pending/accepted claims, rate budget and consent records. With the database stopped, the handler returned 503 with zero provider calls. Missing schema, wrong schema version and incorrect SCRAM credentials failed safely. `fsync`, `full_page_writes` and synchronous commits were on. The rate fixture deliberately extended its test window across restart; normal window/expiry behavior is covered separately. This is restart evidence, not power-loss, managed failover or backup-restore certification.

A disposable non-superuser runtime role passed [10 least-privilege checks](../artifacts/shared-staging/least-privilege-runtime-role.json): documented grants support real operations; DELETE, schema/table creation and protected metadata updates were denied. Fixtures and role were cleaned up. The local cluster lives under ignored `node_modules/.cache/acexperts-postgres/`; its synthetic identities/settings are not deployment credentials.

## Environment contract and secret handling

All **13 exact application names** are empty in `.env.example` and match the implementation; this contract is tested. No application values were found in the ordinary tool process or local environment files. [Presence-only evidence](../artifacts/shared-staging/config-presence.json).

| Group | Exact names |
| --- | --- |
| Brevo and enquiry routing | `BREVO_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` |
| Newsletter DOI | `BREVO_NEWSLETTER_LIST_ID`, `BREVO_NEWSLETTER_DOI_TEMPLATE_ID`, `BREVO_NEWSLETTER_REDIRECT_URL` |
| Request origin | `FORM_ALLOWED_ORIGINS` |
| Shared state | `FORM_DATABASE_URL`, `FORM_STATE_SECRET`, `FORM_STORE_NAMESPACE` |
| Privacy and consent retention | `PRIVACY_NOTICE_URL`, `PRIVACY_NOTICE_VERSION`, `NEWSLETTER_CONSENT_RETENTION_DAYS` |

The guide documents each parser constraint and requirement. Twelve settings enable both forms with an approved newsletter notice; a staging hostname additionally needs its exact origin. Only the public notice URL/version are intentionally rendered. Credentials and HMAC key never belong in client props or `NEXT_PUBLIC_` variables.

Missing/empty/malformed provider, state and newsletter-policy configuration is covered by hermetic tests with zero fake-provider calls and no secret echo. Tests also cover synthetic provider debug text, database errors, incomplete receipts and timeouts. The final build used synthetic API-key/database-password/HMAC markers: **zero matches in all 16 client asset files**. Actual disabled local routes returned 503; false/string consent, filled honeypot and stale wording returned 400; foreign origin returned 403. All seven API checks returned `no-store` and `nosniff`. [Public-safety evidence](../artifacts/shared-staging/public-safety.json).

These tests do not establish external log redaction or live credential validity. Provider acceptance does not establish inbox delivery. Browser/load/fault suites must remain on a disabled or fake provider: `LOCAL_FORM_TEST_MODE=disabled-provider` is an acknowledgment, not a switch that disables server delivery.

## Newsletter consent, confirmation, unsubscribe and privacy

| Area | Verified implementation | Required external acceptance |
| --- | --- | --- |
| Explicit signup consent | Required unchecked checkbox; only boolean `true`; exact current `consentVersion` and published `noticeVersion`; stale/malformed versions rejected | Review actual published notice and wording with the business. |
| Durable request evidence | Claim/audit commit before dispatch. Email HMAC, request UUID, DB timestamp, wording/version, notice URL/version, origin, list/template IDs, retention deadline and provider outcome | Approve access/retention/reconciliation and protected correlation with Brevo records. HMAC records are pseudonymous, not anonymous. |
| Confirmation initiation | Only Brevo DOI endpoint; no direct enrollment, blocklist clearing or inferred confirmation. Schema requires `confirmation_state = not_verified` | Real DOI arrival, generated link, redirect, confirmed-list membership and pre-confirmation ineligibility. |
| Withdrawal/suppression | App does not send campaigns or override unsubscribe state | Real campaign unsubscribe, suppression and already-unsubscribed/blocked-contact cases. No automatic confirmation/unsubscribe webhook exists. |
| Tracking | DOI request sets `contactPixelTrackingConsent: false` | Account feature/template behavior and received email must be checked; feature dependence is documented in the guide. |
| Notice and retention | Newsletter dispatch requires approved HTTPS notice/version and explicit retention days; both forms receive the configured notice link; operator retention SQL prepared | Publish/approve policy, visually verify both configured links, schedule cleanup/backups and timely resolution of unresolved claims. |

Contact enquiries never subscribe visitors to marketing. Contact can technically operate without the notice settings, so public collection remains behind an operational privacy gate. No fabricated privacy policy or certification was added. Unsupported certification badges remain omitted per the user's earlier answer.

The configured-link visual check is still pending. Automatic approval review rejected starting an additional local preview server with the reason **“blocked by policy”** and no further explanation. Completed browser runs covered the default unconfigured notice state; server configuration and consent-version paths are covered by source tests. Verify both real notice links on authorized staging.

## Fresh verification and historical failure resolution

All test files ran with `BASE_URL` enabled for rendered SEO and `FORM_TEST_DATABASE_URL` pointing only to the isolated migrated local database. **102 passed, 0 failed, 0 skipped**, including 14 real PostgreSQL cases and 26 staging-delivery cases. Form/security/SEO aliases select tests already included in `npm test`.

| Check | Result | Evidence |
| --- | --- | --- |
| Final production build | PASS, Next.js 16.3.8 | [Build](../artifacts/shared-staging/build-output.txt) |
| ESLint and standalone type checking | PASS | [Lint](../artifacts/shared-staging/lint-output.txt), [types](../artifacts/shared-staging/typecheck-output.txt) |
| All automated test files | 102/102; no skips | [Tests](../artifacts/shared-staging/tests-output.txt) |
| Route/content/preservation | 48 pages, 24 articles, 67 FAQ occurrences, 30 redirects, 121 media redirects, 869 targets; zero failures | [Routes](../artifacts/shared-staging/route-validation.json) |
| Responsive layout | 384/384 cases, 48 routes | [Responsive](../artifacts/shared-staging/responsive-layout-check.json) |
| Completion browser | 22 checks, 16 accessibility scans | [Completion](../artifacts/shared-staging/completion-browser-check.json) |
| Motion and AC viewer | Eight widths plus four motion preference/fallback checks; 12 AC-viewer groups | [Motion](../artifacts/shared-staging/motion-browser-check.json), [AC viewer](../artifacts/shared-staging/ac-viewer-check.json) |
| Security browser | Headers, CSP/nonces, navigation, disabled enquiry POST and blocked injected scripts pass | [Security](../artifacts/shared-staging/security-output.txt) |
| Original migration validator | 76 source mappings, 48 pages, 30 redirects, 869 targets; zero failures | [Validator](../artifacts/shared-staging/legacy/validation-results.json) |
| Repaired migration browser | 90/90 viewport cases, 12 accessibility scans, 9 interactions; zero failures | [Migration browser](../artifacts/shared-staging/legacy/browser-validation-results.json) |
| Repaired redesign browser | 432/432 viewport and consistency cases, 59 accessibility scans, 25 interactions; zero failures | [Redesign browser](../artifacts/shared-staging/legacy/redesign-browser-validation.json) |
| DB restart/outage and restricted role | PASS; zero provider calls | [Restart](../artifacts/shared-staging/restart-verification.json), [privileges](../artifacts/shared-staging/least-privilege-runtime-role.json) |
| Production dependency audit | Zero known findings, exit 0 | [Production audit](../artifacts/shared-staging/production-dependency-audit.json) |
| Full dependency audit | Exit 1: five high findings in the development ESLint chain | [Full audit](../artifacts/shared-staging/full-dependency-audit.json) |

Historical assertions were corrected against existing intentional behavior: `Service pages and more` and `About Us` labels, required newsletter consent/versioned payload, implemented delivery API with a truthful disabled 503, and five project categories with MEP intentionally removed. New checks require unchecked consent, no request without consent, preserved input on failure, response security headers, exact categories and empty states. No feature/security check was disabled to obtain a pass; both suites reached previously blocked interactions.

The genuine backend issue found was 408/409 uncertainty; its regression proves no resend after 60 seconds, 30 minutes or handler reinitialization. The final build and all 102 source tests include the fix. Browser suites exercised the same UI build before that final provider-classification refinement; their deliberately disabled-provider flows do not exercise it. Hosted verification must use the final approved artifact.

Accessibility scans are bounded automated checks, not a certification. Node emits a non-failing module-type warning. The full audit's five findings affect `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`; npm proposes an incompatible major downgrade. No forced dependency rewrite was made. Review tooling exposure and compatible remediation before approving the release pipeline. Crawl/migrate/content-generation utilities and the performance sampler are not test suites and were not rerun. [Verification summary](../artifacts/shared-staging/verification-summary.json).

## Remaining blockers and exact actions

| Blocker | Evidence | Required action before approval |
| --- | --- | --- |
| Hosting and protected staging absent | No provider/deployment manifest; hosting unselected | Choose Node-capable host/region/topology, approve staging hostname, provision HTTPS and all-path access gate with direct-origin protection and staging noindex. DNS/deployment changes require explicit authorization. |
| Hosted shared database absent | Only isolated local PostgreSQL provisioned/tested | Provision staging PostgreSQL, apply migration once, grant restricted runtime role, set shared key/namespace, verify TLS/WAL/storage, connection capacity, restore/failover and monitoring. |
| Real account configuration absent | All 13 settings absent in presence evidence | Follow eight Brevo steps: authenticate domain, verify sender, securely store API key, authorized recipient, separate confirmed list, active DOI template with `{{ params.DOIurl }}`, approved redirect/origin. Add privacy/shared-state settings. |
| Published privacy and retention process absent | No approved notice supplied; confirmation unverified; retention job absent | Approve/publish notice, set immutable version and retention days, verify both links, schedule restricted cleanup and protected confirmation/withdrawal evidence. Resolve unknown claims by evidence, never automatic deletion. |
| Intended topology not verified | Local pool/process/restart evidence only | Run fake-provider tests through intended instances/release overlap; verify shared limits/dedup, outage behavior, ingress client limits, access bypass resistance and log redaction. |
| Live delivery/lifecycle unverified | No authorized addresses supplied; zero live sends | Obtain approval for named inboxes/send count; run controlled enquiry/DOI acceptance. Separately authorize campaigns needed for genuine unsubscribe/suppression testing. |
| Release/operational approval pending | Uncommitted tree; development-tool audit has five high findings | Review candidate/tooling findings, monitoring/rollback/retention ownership, preserve LF and shared state across releases. Obtain explicit authorization for commit/push/deploy/DNS/production restart. |

## Ordered staging verification and production launch steps

1. **Select and authorize staging infrastructure.** Approve host, region, topology and `staging.acexperts.ae` (or another exact hostname). Configure tester authentication, origin protection, HTTPS, staging-only noindex, trusted ingress limits and safe logs. No DNS/deployment changes without explicit authorization.
2. **Provision staging PostgreSQL and operational ownership.** Use separate staging database/secrets. Apply migration with stop-on-error using an owner account, grant only documented runtime privileges, then configure stable database/key/namespace on every worker. Test persistence, TLS, backup/restore and capacity. Schedule approved retention/reconciliation.
3. **Complete privacy and Brevo configuration.** Use the [checklist tables](staging-configuration-checklist.md) for all 13 settings. Publish the approved notice; configure verified sender, standard API key, controlled recipient, dedicated list and active DOI template, redirect and exact origin. Keep delivery disabled until controlled-test authorization.
4. **Verify the exact staging candidate with fake/disabled delivery.** Include all new files in the approved immutable release. Run build, lint, typecheck and all suites, including shared-store tests in their guarded isolated database. Test actual host access/indexing, both privacy links, multi-instance races, release overlap and DB failure with fake transport. Never run broad browser/load/failure suites against live credentials.
5. **Run authorized live acceptance.** Follow the [controlled plan](staging-configuration-checklist.md#controlled-live-delivery-plan): one enquiry/DOI at a time, explicit inbox-owner permission, no production audience, stop/reconcile uncertain results, verify actual arrival and confirmation eligibility. Separately authorize a campaign for unsubscribe/withdrawal and next-audience suppression. Record redacted event/request IDs; protect addresses/personalized links outside repository evidence.
6. **Close blockers and approve production settings.** Verify production database/namespace/key, sender/list/template/recipient, notice/retention, origins/redirects, HTTPS, indexing/canonicals/security headers, ingress limits and log redaction. Review tooling findings and release contents. Confirm monitoring, backup/restore, reconciliation and rollback preserve shared state.
7. **Obtain explicit release authorization, then launch and verify.** Commit, push, deploy, DNS changes and production restarts each remain unauthorized. Production readiness requires resolved critical blockers and successful real delivery/confirmation/unsubscribe evidence. After an authorized launch, perform a separately authorized controlled smoke test and record observed outcomes.

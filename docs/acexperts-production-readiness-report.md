# AC Experts production-readiness report

The subsequent [final document and website verification](acexperts-final-verification-report.md) records the later ISO confirmation, two additional metadata corrections, 110 passing tests and new all-page/browser evidence. It also identifies the repository's active Vercel integration. The detailed results below remain the earlier dated audit; the separate production launch gates are not cleared by GitHub publication.

**Certification update — 12 October 2026:** The owner confirmed NADCA, ISIAQ, ISSA and IAQA, then separately confirmed “ISO is verified; project details pending.” These confirmations supersede the certification omission/blocker wording below. The four homepage credentials and emergency `ISO Certified` label are implemented; [current requirements and verification status](acexperts-requirements-verification.md#latest-full-document-and-iso-recheck) record the additions. Additional projects remain pending. Historical counts/evidence and the separate security, hosting, privacy and live-delivery release blockers are unchanged.

12 October 2026, Asia/Dubai. Current candidate: the reviewed, uncommitted working tree on `main`, based on `dd775cc55dc6d7611baab542a8142701b4b965f6`. **Final decision: NOT READY.**

The full dependency audit still reports five high development findings from one unpatched `braces` advisory, without an approved release-policy disposition. This meets the user's stated unresolved-security-risk condition. It does not mean five public application exploits: production dependencies have zero reported findings, and source/reachability review found no public-request path to the affected tool. Hosting, approved privacy operations and real Brevo acceptance also remain outstanding. Green local checks alone cannot establish production readiness.

No commit, push, deployment, DNS/firewall/account change, live Brevo message, campaign or production-service restart was performed. Only owned loopback synthetic test services were used and have been stopped; ports 3112 and 55432 are closed. Other user services were untouched. [Cleanup evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/service-cleanup.json). This report supersedes the previous staging report's current-status conclusions; its evidence remains preserved.

Status vocabulary: **COMPLETE** means the stated local implementation/check is evidenced; **PARTIAL** means only the stated portion is verified; **BLOCKED** identifies missing inputs; **FAILED** identifies a demonstrated unmet check; **NOT VERIFIED** means the named behavior has not been observed. These statuses never turn a mock response into real delivery.

## Repository preservation and changes

The starting inventory contains 1,190 existing nonignored repository files, including 550 previous artifacts and the earlier protected 315. All 550 previous artifacts remain byte-identical, no existing file was removed, HEAD is unchanged and nothing is staged. The generated `next-env.d.ts` was restored to its exact starting bytes after type generation. [Starting inventory](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/git-before.json); [final inventory and preservation comparison](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/git-after.json).

All prior implementation remains in the candidate. This continuation adds only these application corrections:

- `components/PageContent.tsx`: restores missing spaces in two About card phrases at render time, retaining the archived source bytes and completed layout.
- `app/completion-home.css`: applies the existing shorter mobile entrance timing to the new homepage H1; reduced-motion behavior remains enforced.
- `components/ACExplodedView.tsx`: derives the loop toggle's accessible name from its visible wording in both states.
- `app/home.css`: preserves the visible 6px testimonial dots within actual 44px click targets.
- `app/shell-layout.css`: gives the desktop Services disclosure a minimum 24px target; mobile retains its 44px target.

Affected application routes are `/about/`, the homepage, and the shared header on all pages. No new public API, admin endpoint, certification badge or deployment configuration was invented.

Verification additions include real HTTP requests through two independent Node processes sharing PostgreSQL; a guarded local backup/restore/migration/retention drill; cleanup-failure regression tests; WCAG 2.2 target and accessible-name assertions; stricter boolean consent assertion; and a repeatable performance sampler. New procedures cover database operations, deployment/rollback, original requirements, dependency review and measured performance. The final inventory lists every changed and added file; the pre-existing dirty tree is not represented as a new change from this continuation.

## Original requirements

The original Word document was read directly: `C:\Users\Nishad\Downloads\web modification- acexperts.docx`, SHA-256 `79fc75b01983e5f24a3b2f2f5554ffdd23cf6ded0eb2179a1ed5041e12c2e365`. Its 86 paragraphs, table and 15 embedded images are preserved in [fresh source evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/requirements-source/word-extraction.json). Embedded review URLs are requirements context, not hosting or deployment authority. The later user instructions to use Brevo and omit unverified certifications take precedence.

| Original requirement | Final status | Evidence / remaining boundary |
| --- | --- | --- |
| Original top header strip | COMPLETE | Visible company/contact/group links; current completion and responsive checks. |
| Exact homepage heading | COMPLETE | `Welcome to Voltronix, AC Service Company in Dubai`; one H1, exact Word/data/rendered SEO comparison. |
| Homepage blog | COMPLETE | Three actual migrated article cards and working destinations. |
| Homepage FAQs | COMPLETE | Eight original answers preserved, disclosures and structured data checked. |
| Homepage portfolio | COMPLETE | Actual existing Luxury Villa AC Installation project; no fabricated projects. |
| Red benefits band | COMPLETE | Exact `Residential & Commercial` wording. |
| Complete group-company footer | COMPLETE | Four visible group-company destinations and group copy. |
| Installation service CTA | COMPLETE | Preserved on `/ac-installation-service/`. |
| Preventive maintenance CTA | COMPLETE | Preserved on `/preventive-ac-maintenance-service/`. |
| Repair service CTA | COMPLETE | Preserved on `/ac-repair-services/`. |
| Emergency service CTA | COMPLETE | Preserved on `/emergency-ac-maintenance-service/`. |
| Emergency trust strip | PARTIAL | Supported experience/response/coverage content retained; unsupported certification wording omitted. |
| AC/HVAC project categories and filters | COMPLETE | Correct five categories, accurate installation membership and honest empty states; redesign and completion browser suites exercise the filters. |
| About blank space and joined Insights content | COMPLETE | Existing responsive layout preserved. |
| About cards/buttons | COMPLETE | Existing layout preserved; two missing word separators corrected and rendered. |
| About trust CTA alignment | COMPLETE | Existing desktop/mobile alignment preserved. |
| Duct-cleaning service page | COMPLETE | `/ac-duct-cleaning-services-in-dubai/`, navigation, listing, metadata and CTA. |
| HVAC service page | COMPLETE | `/hvac-services/`, navigation, listing, metadata and CTA. |
| Revised services heading | COMPLETE | Exact `Complete AC & HVAC Services in Dubai`. |
| Homepage certification section | BLOCKED | User confirmed no verified certifications. No unsupported NADCA/ISIAQ/ISSA/IAQA/ISO badge was added. |
| Eleven specified SEO pairs | COMPLETE | All exact titles/descriptions/canonicals match the original Word table and independent fixture. |

The eleven SEO routes are `/`, `/products/`, `/contact-us/`, `/about/`, `/emergency-ac-maintenance-service/`, `/ac-installation-service/`, `/services/`, `/ac-repair-services/`, `/faq/`, `/projects/`, and `/preventive-ac-maintenance-service/`. Their configured production canonicals, one-H1 hierarchy and index/follow rules are tested. Intentional source noindex archives stay excluded from the sitemap; staging noindex belongs only at the staging boundary. Search-engine processing and deployed indexing are **NOT VERIFIED**.

[Requirement-by-requirement provenance, screenshots and exact SEO comparison](acexperts-requirements-verification.md). Preserved legacy prose/mandated SEO contains business claims that this engineering review does not independently verify; the business should approve their accuracy. No new guarantee, review, credential or customer project was invented.

## Fresh build and tests

Evidence root: [`artifacts/production-readiness-2026-10-12T09-25-27-738Z/`](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/). [Machine-readable result summary](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/verification-summary.json).

| Check | Status | Actual final result / evidence filename |
| --- | --- | --- |
| Production build | COMPLETE | Exit 0, `build-release-output.txt`. |
| Lint | COMPLETE | Exit 0 after final test-coordinate correction, `lint-final-test-output.txt`. |
| Type checking | COMPLETE | Exit 0, `typecheck-release-output.txt`. |
| All automated test files | COMPLETE | **108 passed, 0 failed, 0 skipped**; real PostgreSQL and rendered SEO enabled, `tests-release-output.txt`. |
| Real multi-process HTTP integration | COMPLETE | Two separate Node HTTP workers, durable shared budgets/claims, replacement worker and fake dispatch; included in 108, focused evidence `shared-http-tests.txt`. |
| Routes/links/images/metadata | COMPLETE | 48 pages, 30 page redirects, 121 media redirects, 869 linked targets; zero failures, `route-validation.json`. |
| Responsive geometry/assets | COMPLETE | **384/384 cases**: 48 routes × 320/360/390/414/768/1024/1280/1440px, `responsive-layout-check.json`. |
| Completion/forms/keyboard/AXE | COMPLETE | 25 checks, including 16 route/viewport accessibility scans; zero failures, `completion-browser-check.json`. Includes intercepted failure/success UI; real disabled-provider coverage is in historical/security suites. |
| Motion/fallbacks | COMPLETE | Eight required widths plus reduced motion, no JavaScript, no IntersectionObserver and live preference change; `motion-browser-check.json`, `check-motion-release-output.txt`. |
| AC viewer | COMPLETE | 14 groups, including both toggle states, touch/scroll/keyboard, reduced motion, cleanup and no JavaScript; `ac-viewer-check.json`. |
| Security browser | COMPLETE | Four routes: headers, fresh trusted nonce, hydration, injected script/event blocking; real synthetic contact request returns unsent 503, `security-browser-output.txt`. |
| Historical migration validator | COMPLETE | 48 rendered pages, 30 redirects, 869 targets, 24 articles; zero failures, `historical/validation-results.json`. |
| Historical migration browser suite | COMPLETE | 90 viewport cases, 12 AXE scans, 9 interactions; zero failures, `historical/browser-validation-results.json`. |
| Historical redesign browser suite | COMPLETE | **432 viewport cases**, 59 AXE scans, 25 interactions, 432 consistency checks; zero failures, `historical/redesign-browser-validation.json`. |
| Configured privacy-link browser probe | BLOCKED | Starting the additional synthetic-privacy server was rejected by automatic approval review: “blocked by policy.” The probe was not executed; `configured-privacy-blocker.json`. |
| Local PostgreSQL recovery | COMPLETE | 12/12 restore/migration/privilege/retention checks, four safe-input guards; cleanup regression tests included in 108. |
| Production dependency audit | COMPLETE | Zero known findings, `dependency-audit-production.json`. |
| Full dependency audit | FAILED | Five high development findings from one unpatched advisory, `dependency-audit-full.json`; disposition below. |
| Hosted deployment/real Brevo lifecycle | NOT VERIFIED | No selected verified host, account configuration, approved privacy policy or authorized test inboxes. |

The two historical suites' earlier failures were obsolete expectations: exact header labels (`Service pages` became `Service pages and more`, and `About` became `About Us`), the old MEP project filter and newsletter consent/API expectations. Repairs from the completed staging work were reviewed and preserved. Current tests require the actual disclosure destination/keyboard behavior, exact AC categories and results, and unchecked required consent plus truthful provider-failure UI. No test was deleted or weakened to hide a regression.

Fresh Lighthouse exposed genuine accessibility defects: viewer label/visible-name mismatch, tiny testimonial targets and the desktop Services target. Those were fixed and the checks strengthened. Earlier failing scans remain in the evidence directory; the final release scans show accessibility 100 in both profiles. Historical suites cover their existing WCAG 2/2.1 tag scope; completion/viewer checks add WCAG 2.2 AA and the motion suite verifies real target geometry/activation. Automated scans are bounded checks, not certification of full accessibility or physical-device coverage.

The first strengthened motion run used `(4,4)`, a point outside the new circular 44px target, and failed. Browser `elementFromPoint` evidence demonstrated that `(4,22)` is inside the target but outside its visible 6px dot and activates the correct testimonial. Only the test coordinate was corrected, retaining size/non-overlap assertions and real pointer activation without force-click. [Hit-test evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/testimonial-target-hit-probe.json). The original failed log is preserved separately from the passing rerun.

## Brevo, privacy and shared state

**PARTIAL:** contact and newsletter implementations are locally verified with synthetic settings and fake provider transport. **NOT VERIFIED:** real sender/account permissions, inbox arrival, DOI confirmation, actual redirect, existing/unsubscribed-contact behavior and unsubscribe/suppression. No live-success claim is made.

The actual implementation and placeholder-only `.env.example` agree on all 13 names:

```text
BREVO_API_KEY
CONTACT_FROM_EMAIL
CONTACT_TO_EMAIL
BREVO_NEWSLETTER_LIST_ID
BREVO_NEWSLETTER_DOI_TEMPLATE_ID
BREVO_NEWSLETTER_REDIRECT_URL
FORM_ALLOWED_ORIGINS
FORM_DATABASE_URL
FORM_STATE_SECRET
FORM_STORE_NAMESPACE
PRIVACY_NOTICE_URL
PRIVACY_NOTICE_VERSION
NEWSLETTER_CONSENT_RETENTION_DAYS
```

Missing/invalid credentials or store configuration stop dispatch with safe public errors. Contact success requires Brevo HTTP 201 and a nonempty `messageId`; newsletter HTTP 201 means only DOI initiation acceptance. Provider failures/timeouts never imply delivered mail. Provider 408/409, ambiguous responses and timeouts retain unresolved claims instead of automatically resending. Responses do not expose provider/driver bodies, keys or enquiry content. All 13 sample environment values are empty, and the synthetic server API marker is absent from all 16 emitted static files. [Supplemental rendering/configuration/cache evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/supplemental-check.json). This is a bounded local check, not verification of hosted secret management or logs.

The additional browser probe for both configured privacy links and transmitted notice version remains **BLOCKED**. Automatic approval review rejected starting the owned loopback server with synthetic privacy settings and disabled provider configuration: “blocked by policy,” with no more specific reason. The server was not created and the action was not retried through another route. [Exact blocked action and unexecuted check](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/configured-privacy-blocker.json). Source/unit coverage for approved URL parsing and stale version rejection passes; this does not substitute for the missing browser check or actual published-policy verification.

Newsletter requires exact boolean consent and current wording/notice versions. A committed audit row precedes dispatch and records server time, request ID, keyed email identity, wording/version, public notice URL/version, origin, list/template, retention deadline and provider outcome. It stores no raw email/message/IP. `confirmation_state` remains `not_verified`; redirect visits and API receipts are not confirmation evidence. The DOI request does not directly enroll or clear suppression flags. There is no automatic confirmation/unsubscribe webhook: a protected Brevo/operator record process must be approved and tested. Deleting an app audit row does not unsubscribe a provider contact.

The shared PostgreSQL implementation uses atomic global budgets (30 contact / 10 newsletter per database minute), HMAC duplicate keys and durable claims across workers. Accepted/rejected cooldowns expire; pending/uncertain/timeout claims require reconciliation and never automatically expire into a resend. A namespace/key fingerprint catches mismatched workers. The application cannot fall back to in-memory production protection. Up to three connections per handler means up to six per worker; the host must budget replicas and release overlap. Real local tests cover concurrency, restart, separate HTTP processes, consent-before-send, failure handling and restricted privileges.

**COMPLETE locally:** PostgreSQL 16.15 synthetic backup/restore drill passed 12 checks, including exact restored states/UUIDs, schema constraints, least privilege, unresolved claims, safe migration reapplication and scoped repeatable retention. Four input guards and four cleanup-failure regression tests cover safe operation. [Final recovery evidence](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/postgres-recovery-386efb7a8c604f35a1b0e0cedf5a1453.json). The 14,147-byte synthetic dump took 278ms and restore 235ms; these are not production recovery targets. Temporary resources were removed and HBA bytes restored. Hosted scheduled backups, PITR, approved RPO/RTO and a hosted restore drill remain **BLOCKED/NOT VERIFIED**. [Exact database commands and recovery limitations](acexperts-database-operations.md).

**BLOCKED:** approved published privacy notice, immutable notice version, retention period, cleanup/backup-retention schedule, reconciliation owner and protected confirmation/withdrawal evidence process. The app records retention deadlines but does not schedule deletion. Maintenance intentionally preserves unresolved claims, whose retention also requires an approved decision. Unsupported certificates remain omitted pending evidence; this is intentional content restraint, not a code fault.

## Security and dependencies

**COMPLETE for bounded local review:** server input/body/time limits, content sanitization/output escaping, fixed provider destinations, no provider redirect following, exact origins, no permissive CORS, fresh nonce CSP, no-store HTML/APIs, generic errors, parameterized SQL, remote TLS verification, restricted database roles and fail-closed shared state. There are no application sessions, uploads, public admin/debug routes or invented health endpoints. Hosted ingress/authentication/logging remains **NOT VERIFIED**.

**FAILED full dependency audit / PARTIAL remediation:** `braces` 3.0.3 → `micromatch` 4.0.8 → `fast-glob` 3.3.1 → `@next/eslint-plugin-next`/`eslint-config-next` 16.3.8 produces five high development findings from GHSA-vfj7-8cjw-p6xm. No supported compatible patch was available; a newer plugin still retains the affected chain. A bounded local nested-pattern probe reproduced stack exhaustion, but the effective ESLint configuration invokes zero root-directory glob calls and the runtime tree excludes this chain. No public HTTP exploit path was found. The production-only audit reports zero known findings. The suggested forced downgrade to Next 14 tooling would be inappropriate and was not applied.

Required disposition: isolated build/lint runners without production credentials; review untrusted configuration and keep external patterns out of glob settings; monitor upstream; rerun audit at release approval; obtain explicit owner acceptance if the release policy permits the unresolved tooling risk, or apply a supported compatible fix and rerun checks. No suppression or false patched claim. [Official advisory links, package metadata, reachability and full surface review](acexperts-security-review.md).

## Performance, SEO and accessibility

| Local homepage Lighthouse 13.5.0 | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline mobile | 90 | 97 | 100 | 100 | 3,473 ms | 0 |
| Release mobile | 92 | 100 | 100 | 100 | 3,272 ms | 0 |
| Release desktop | 97 | 100 | 100 | 100 | 813 ms | 0 |

These are local lab scores, not field data or causal proof of speed improvement. The separate 18-sample viewport script observed homepage median LCP of 552ms desktop and 2,660ms at 390px with throttling, versus 520ms/3,032ms baseline. Maximum observed CLS was 0.0001 and maximum sampled menu interaction was 152ms; that interaction sample is **not field INP**. The 390px script uses desktop Chromium with viewport/DPR/throttling, not full handset emulation. No external resource requests were observed on the three sampled routes.

Mobile homepage LCP remains above 2.5 seconds in both final local methods; no full Core Web Vitals pass is claimed. Source review and actual sampling cover local font loading, image priority, JS transfer, caching and motion. Sixteen emitted static files total 772,646 raw bytes; sampled script transfer was 160,378 bytes per page. HTML retains private/no-store nonce security, while sampled hashed JavaScript is public/immutable. Do not remove CSP/no-store to improve Lighthouse's bfcache finding.

[Full baseline/release tables, sample ranges, asset inventory, limitations, profiling opportunities and exact reproduction commands](acexperts-performance-review.md). Final artifacts are `performance-release.json` and `lighthouse-release-{mobile,desktop}.json`; earlier `performance-final.json`/`lighthouse-final-*` filenames describe intermediate candidates and remain preserved. Hosted performance, actual handset/screen-reader coverage and field Core Web Vitals are **NOT VERIFIED**.

## Hosting, exact commands and rollback

**BLOCKED:** no selected or verified hosting configuration is available: provider, operating system, process manager, ingress, hosted database and staging hostname are undecided. Architecture is Node-hosted Next.js with request-time CSP, server APIs, image optimization and shared PostgreSQL; static-only hosting cannot run it. Historical Vercel screenshot URLs do not prove current hosting.

Propose `https://staging.acexperts.ae`, subject to explicit approval. Protect all paths at the ingress using tester identity authentication (or approved fixed-IP access), block direct-origin bypass, use HTTPS and staging-only `X-Robots-Tag: noindex, nofollow`. Use separate databases/secrets/lists/templates for staging and production. Keep nonce-bearing HTML private/no-store, configure trusted per-client ingress limits and disable automatic proxy retries for form requests.

The [deployment runbook](acexperts-deployment-runbook.md) contains exact repository build/test/start commands and a clearly conditional Linux/nginx example. `npm run start -- --hostname 127.0.0.1 --port 3112` is the verified Node runtime command for an approved local/ingress topology. Concrete service install/restart/traffic-switch/DNS commands cannot honestly be supplied until the platform, service identities and targets are selected. No example has been applied to infrastructure. Do not deploy Git HEAD alone: it omits the uncommitted implementation.

Use the runbook's clean disposable candidate/CI sequence (`npm ci`, lint, typecheck, build, full tests and browser suites) with deliberately invalid provider settings. Do not run `npm ci` over this workspace's active portable PostgreSQL cache. Use the database operations guide's approved service aliases for one-time migration, least-privilege grants, backup, isolated restore and scoped retention; placeholders require real operator selections. Never run broad regression/load/fault suites with live credentials.

HTTP `GET /` is liveness only. Readiness separately requires verified TLS/database/schema/grants/key agreement, approved configuration and privacy content, protected ingress and configured monitoring. Do not probe readiness by sending email. Verify all these on the actual host, including safe graceful shutdown and unresolved-send handling during release overlap.

Rollback restores routing to the previous verified compatible application artifact, preserving PostgreSQL schema, namespace and stable HMAC key. Do not clear claims, run reverse DDL, revert to in-memory delivery, or restore an older database merely to roll back app code. Disaster recovery restores privately into a new database and reconciles provider actions after the backup point before enabling sends. The runbook includes the complete smoke, monitoring and recovery sequence.

## Exact remaining gates

Before staging verification:

1. Resolve or explicitly disposition the unpatched development dependency advisory under the owner's release policy; do not label it fixed.
2. Choose host/region/Node topology, ingress, replica limit and PostgreSQL provider. Approve the staging hostname, protected tester identities, candidate artifact and the specific deployment/DNS actions. No external change has been authorized yet.
3. Provision isolated PostgreSQL with verified TLS, documented runtime grants, shared stable namespace/key, capacity, backup/restore, retention and reconciliation ownership. Apply migration 001 once to an empty approved schema and verify readiness. Exercise two workers and release overlap behind the actual ingress with fake delivery.
4. Complete the blocked synthetic configured-privacy browser probe when execution is permitted; its exact invocation is in the blocker artifact. Approve and publish privacy content and its version; approve consent/claim/provider/backup retention and withdrawal records. Configure the three privacy settings and verify both actual links. A synthetic passing result would still not verify the published policy.
5. Configure Brevo through the [eight exact account steps](delivery-configuration.md#exact-brevo-setup-steps): authenticated/verified sender, dedicated key, authorized test recipient, separate confirmed-newsletter list ID, active DOI template with `{{ params.DOIurl }}`, approved HTTPS redirect, and exact allowed staging origin. Confirm tracking, suppression and automation settings.
6. Obtain explicit named test-inbox, purpose and maximum-send-count authorization. Then execute the [controlled live plan](staging-configuration-checklist.md#controlled-live-delivery-plan): one contact/DOI at a time; actual inbox receipt; real confirmation/list eligibility/redirect; existing and unsubscribed contacts; separately authorized test-campaign unsubscribe and suppression. Stop and reconcile every ambiguous result. No customer audience or campaign is authorized now.

Before production launch:

1. Complete the staging gates with redacted evidence, including live consent/confirmation/withdrawal and hosted access/secret checks. Resolve any actual failures.
2. Review production-specific sender, recipient, list/template, redirect, origins, privacy version, database and stable shared secrets. Approve legacy business claims; supply verified credentials before adding certification badges if that feature remains requested.
3. Verify the production target's HTTPS, headers/cache, intended indexing/canonicals/redirects/sitemap, ingress limits, database readiness, monitoring/alerts, scheduled retention/backups, tested restore and compatible rollback. Keep staging noindex/authentication isolated from production.
4. Review the complete immutable candidate and authorize any required commit, push, deployment, DNS or production-service restart explicitly. Retain the previous compatible artifact and shared state. Perform only separately authorized post-launch smoke sends and record actual outcomes.

The current report does not authorize those operations. Final evidence supports continued preparation, not a production-release claim.

# AC Experts staging-readiness report

12 October 2026, Asia/Dubai. Reviewed working tree based on `main` at `dd775cc55dc6d7611baab542a8142701b4b965f6`.

**Decision: ready for controlled staging setup and acceptance testing; not ready for production launch.** Hosting, staging hostname and deployment topology are undecided, as confirmed by the user. No hosted staging environment has been created. The completed application was retained; this review adds delivery safety tests, configuration instructions and fresh evidence.

No commit, push, deployment, DNS/account change, live Brevo send or production-service restart was performed. Verification used an isolated local production server at `http://127.0.0.1:3112`, with deliberately invalid sender/list settings and a synthetic API-key marker. Existing services on ports 3001 and 3002 were left alone.

The isolated test server was stopped after verification. [Final Git evidence](../artifacts/staging/git-after.json) records the unchanged HEAD, zero staged changes and absence of unexpected tracked modifications.

## Git and change review

At the start, the working tree contained **21 modified tracked files, 22 new implementation/configuration/documentation/test files and 188 prior artifacts**, with no staged changes. All 43 changed/new non-artifact files were reviewed, including the complete content-data diff. The prior artifacts were inventoried and hashed; this review does not claim a fresh visual inspection of every historical screenshot. `git diff --check` passed.

The initial file-by-file SHA-256 inventory is [git-before.json](../artifacts/staging/git-before.json). A [follow-up hash comparison and source review](../artifacts/staging/source-review.json) confirms that the only changed pre-existing file is the delivery guide; all 188 prior artifacts remain byte-identical. Fresh evidence is confined to `artifacts/staging/`. The original preservation baseline remains intact. No new application regression was identified in the source review or current supported checks.

Changes made during this staging review:

- Added [staging-delivery.test.mjs](../scripts/staging-delivery.test.mjs): 12 hermetic tests, including explicit evidence of current distributed-state limitations.
- Expanded [delivery-configuration.md](delivery-configuration.md) with numbered Brevo setup instructions and live acceptance criteria, checked against official provider documentation.
- Added this report and fresh verification artifacts. No application component, route, content or delivery-library implementation was changed.

The completed implementation is still uncommitted. Deploying the current Git HEAD alone would omit it. Release preparation must include the reviewed untracked source files and use a fixed, approved revision or artifact after authorization. Preserve LF bytes in staging/CI checkouts: the preservation contract hashes raw file bytes, this Windows repository has `core.autocrlf=true`, and no `.gitattributes` currently pins line endings. Do not update the baseline merely to hide checkout conversion differences.

## Configuration and secret handling

All seven names match the actual server implementation and `.env.example`; six are required to enable both forms. The initial [configuration-presence check](../artifacts/staging/config-presence.json) found none configured in the process or local environment files. It records names and presence only, never secret values.

| Name | Used for | Staging requirement |
| --- | --- | --- |
| `BREVO_API_KEY` | Both forms | Standard API key in the server secret manager |
| `CONTACT_FROM_EMAIL` | Enquiries | Approved, verified Brevo sender; authenticated domain |
| `CONTACT_TO_EMAIL` | Enquiries | Controlled, monitored recipient inbox for staging |
| `BREVO_NEWSLETTER_LIST_ID` | Newsletter | Dedicated confirmed-newsletter list ID, positive integer |
| `BREVO_NEWSLETTER_DOI_TEMPLATE_ID` | Newsletter | Active API double opt-in template ID, positive integer |
| `BREVO_NEWSLETTER_REDIRECT_URL` | Newsletter | Approved, working absolute HTTPS confirmation destination |
| `FORM_ALLOWED_ORIGINS` | Request guard | Exact HTTPS staging origin, no slash/path/wildcard; comma-separated if needed |

`FORM_ALLOWED_ORIGINS` is optional in code; an additional staging hostname requires it. It does not control indexing or restrict page access. All values are server-side; none use a `NEXT_PUBLIC_` prefix.

Observed safety evidence:

- **14 missing/empty-setting scenarios:** HTTP 503, no mocked provider calls, no secret echo. Syntactically valid but incorrect credentials cannot be recognized locally and instead take the generic provider-error path.
- **17 synthetic provider outcomes:** no API-key canary or upstream private text in response bodies or headers, including errors, timeouts and accepted receipts.
- A production build made with the synthetic secret marker exposed it in **zero of 16 client asset files**, zero of three inspected rendered pages, and zero of six actual local API responses. [Public-safety evidence](../artifacts/staging/public-safety.json).
- Actual local contact/newsletter submissions returned truthful unconfigured 503 responses; false/string consent and the newsletter honeypot returned 400; a foreign origin returned 403. Responses were `no-store` and `nosniff`.
- Review of 69 changed/new text files found no recognizable Brevo/private-key/AWS/GitHub token patterns. This pattern scan and synthetic tests do not establish the behavior of future hosting, proxy or provider logs. Configure log redaction before live use.

The server uses fixed public failure messages, an eight-second provider deadline and no automatic send retries. Provider acceptance is distinct from inbox delivery. Browser checks that submit actual forms must run against the deliberately disabled local configuration; a loopback browser restriction alone cannot prevent a configured server from contacting Brevo.

## Newsletter, consent and distributed behavior

| Area | Verified locally | Remaining evidence or implementation |
| --- | --- | --- |
| Signup consent | Checkbox starts unchecked; server requires boolean `true`; malformed/missing consent never reaches provider | Approved privacy notice and real form links; agreed durable consent/withdrawal evidence and retention |
| Confirmation initiation | Only the Brevo DOI endpoint is used; HTTP 201 required; UI asks recipient to confirm | Actual DOI email arrival, link, redirect and confirmed-list eligibility |
| Unsubscribe preservation | Payload does not directly update contacts or clear unsubscribe/blocklist flags | Existing/unconfirmed/unsubscribed contact behavior and marketing suppression in the actual account |
| Tracking consent | Payload contains `contactPixelTrackingConsent: false` | Brevo documents account-feature dependence; verify account/template settings and actual received emails |
| Duplicates in one handler | Concurrent and repeated normalized payloads share one call/result for 30 minutes; uncertain results remain suppressed | Durable state across instances, cold starts, restarts and overlapping releases is absent |
| Rate limiting in one handler | Contact: 30 attempts/minute; newsletter: 10; 429 with Retry-After; spoofed forwarding headers do not bypass it | Shared ingress/client limits and a shared provider budget are absent |

Independent-handler tests measured **one mocked provider call for repeated identical input in one handler, two across two handlers, and three after another initialization**. At the same mocked time, contact budgets were **30/60/90** and newsletter budgets **10/20/30** across one/two/three initializations. Contact provider UUIDs differed for every dispatched call. These tests model separate instance/restart state; no deployed cluster was tested. Passing these tests proves the limitation, not distributed protection. [Tests and diagnostics](../artifacts/staging/tests-output.txt).

The app has no campaign sender, unsubscribe endpoint or durable consent database. Brevo handles confirmation and campaign unsubscribe. Marketing and transactional blocklists must be checked separately. The provider documentation also differs on transactional idempotency header spelling; live behavior remains unverified and fresh UUIDs cannot solve cross-instance duplication regardless. Official references and precise caveats are in [the configuration guide](delivery-configuration.md#consent-and-visitor-behavior).

The contact form does not subscribe visitors to marketing. It currently has no privacy notice; this report does not invent a legal requirement for an additional checkbox. The business must approve data-handling wording and evidence retention for both forms before public collection.

## Fresh verification

Browser, route and rendered SEO checks used the new local production build; hermetic tests exercised the current source with mocked providers. `npm test` includes every `scripts/*.test.mjs` file, including the tests selected by the `test:seo`, `test:forms` and `test:security` aliases; those aliases do not add distinct tests. `BASE_URL` enabled all 11 rendered SEO cases.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Production build, Next.js 16.3.8 | PASS, exit 0 | [Build log](../artifacts/staging/build-output.txt) |
| ESLint | PASS, exit 0 | [Lint log](../artifacts/staging/lint-output.txt) |
| Standalone type checking | PASS, exit 0 | [Typecheck log](../artifacts/staging/typecheck-output.txt) |
| All automated test files | **73 passed, 0 failed, 0 skipped**, including 12 new staging tests | [Test log](../artifacts/staging/tests-output.txt) |
| Route/content/preservation checks | **48 pages, 24 articles, 67 FAQ occurrences, 30 page redirects, 121 media redirects, 869 linked targets; zero failures** | [Route evidence](../artifacts/staging/route-validation.json) |
| Responsive layout | **384/384 cases**, 48 routes at eight widths from 320 to 1440px | [Responsive evidence](../artifacts/staging/responsive-layout-check.json) |
| Completion browser suite | **22 checks**, including 16 automated accessibility scans | [Completion evidence](../artifacts/staging/completion-browser-check.json) |
| Motion browser suite | **Eight widths plus four fallback/preference checks passed** | [Motion evidence](../artifacts/staging/motion-browser-check.json) |
| Interactive AC viewer | **12 groups passed**, including touch, scrolling, cleanup, autoplay/pause and fallback modes | [AC-viewer evidence](../artifacts/staging/ac-viewer-check.json) |
| Production security browser | PASS, including actual disabled contact POST, CSP/nonce checks and navigation | [Security log](../artifacts/staging/security-output.txt) |
| Public secret/configuration safety | 16 client files, three pages and six actual API cases passed | [Public-safety evidence](../artifacts/staging/public-safety.json) |

Automated accessibility scans are limited checks, not an accessibility certification. Node's test runner emits a non-failing module-type reparsing warning; no runtime dependency change was needed. The full command/result summary is [verification-summary.json](../artifacts/staging/verification-summary.json).

The older scripts were also run as diagnostics because the request covered all available tests. Copies redirected only report/screenshot paths into `artifacts/staging/legacy/`; original assertions and default coverage were retained. Reversing those path substitutions reproduces the exact original script hashes. [Adaptations](../artifacts/staging/legacy/adaptations.json), [copy verification](../artifacts/staging/legacy/copy-verification.json).

| Historical diagnostic | Actual result | Evidence |
| --- | --- | --- |
| `npm run validate` equivalent | PASS: 76 source mappings, 48 pages, 30 redirects, 869 targets, 24 article checks; zero failures | [Validation result](../artifacts/staging/legacy/validation-results.json) |
| Original migration browser | Exit 1: 90/90 viewport cases passed and 12 accessibility scans ran; first interaction failed on obsolete `header summary[aria-label="Service pages"]` selector (current label is `Service pages and more`). No interaction checks completed after that failure. | [Browser result](../artifacts/staging/legacy/browser-validation-results.json), [execution](../artifacts/staging/legacy/browser-check-execution.json) |
| Original redesign browser | Exit 1: 432/432 viewport and consistency cases passed; 59 accessibility scans reported zero violations; 13/14 recorded interactions passed. Failures: newsletter assertion omits required consent and expects unavailable delivery; removed `MEP` category button times out. Subsequent project-selection assertion, contact and interaction-console checks were not reached. | [Redesign result](../artifacts/staging/legacy/redesign-browser-validation.json), [diagnostic summary](../artifacts/staging/legacy/diagnostic-summary.json) |

Both historical browser suites failed and are not included in the current-suite pass claim. Their raw failures and unreached checks remain recorded. These older selectors are already identified as historical in README; current completion/security suites exercise the current UI. If historical suites are retained in a future CI job, update or retire their obsolete assertions before making them release gates. No application change was made to satisfy an obsolete expectation. All 64 prior historical reports/screenshots and all three original scripts remain byte-identical. The performance sampler and crawl/migrate/asset/report-generation utilities are not test suites and were not rerun.

## Launch blockers and exact required actions

| Blocker | Exact evidence | Required action |
| --- | --- | --- |
| Hosting/topology undecided | User confirmed "Not decided yet"; no staging hostname or ingress configured | Choose Node-capable hosting, region, staging hostname and replica/serverless model; identify the trusted proxy and runtime secret mechanism |
| Staging access/indexing controls absent | `app/robots.ts` permits crawling; `lib/metadata.ts` preserves production index/follow | Require staging authentication or IP restriction plus a staging-only `X-Robots-Tag: noindex, nofollow`; verify externally and keep production canonicals intact |
| Brevo not configured | Six required settings absent in initial presence evidence | Follow setup steps 1-7 in the configuration guide: authenticate domain, verify sender, generate/store API key, choose recipient, create staging list and active DOI template, set redirect/origin |
| Live delivery and subscription lifecycle unverified | Only mocked provider calls and disabled local routes tested | Complete every relevant live acceptance row with controlled inboxes and a dedicated staging list; record redacted provider log IDs, inbox results, confirmation and withdrawal evidence |
| Privacy/consent records incomplete | Newsletter contact link is not a privacy notice; no durable wording/version/confirmation/withdrawal record in app | Approve and publish the notice, link both forms, choose and test a durable consent-evidence/retention process, verify Brevo tracking behavior |
| Distributed abuse/duplicate controls absent | Independent-handler tests demonstrate 2-3 sends and multiplied budgets | Implement atomic shared submission state with stable HMAC/request keys and uncertain-result handling; configure trusted ingress/client limits and a shared provider budget; test through intended instances and restart/release transitions |
| Release and operational verification pending | Implementation remains uncommitted and no hosting configured | Review exact release contents, preserve LF checkout, assign key rotation/monitoring ownership, verify log redaction, prepare rollback and obtain explicit release authorization |

Verified certifications are unavailable by the user's confirmation. Unsupported badges remain omitted; this is an intentional content decision and does not require invented credentials to launch.

## Ordered next steps

1. **Choose hosting and the staging URL.** Set access controls and the staging-only noindex response header. Confirm HTTPS, Node runtime, trusted client-IP handling, secret storage and LF-preserving release checkout.
2. **Configure Brevo for controlled staging.** Use the [eight-step setup runbook](delivery-configuration.md#exact-brevo-setup-steps). The API DOI template button must use `{{ params.DOIurl }}`. Use a separate staging list and controlled recipient inbox; store all seven exact settings above as applicable.
3. **Finish privacy and shared-state prerequisites.** Publish the approved notice, wire its form links and define consent evidence. Implement shared duplicate/abuse controls for the selected topology; one replica alone does not preserve state across restart or release.
4. **Create the staging release after deployment authorization.** Include all reviewed new source files. Run build/current suites in the deployment environment. Use a disabled or mock-provider environment for load, failure and duplicate tests, keeping them separate from the credentialed live acceptance environment.
5. **Run controlled live acceptance with authorization to send.** Verify enquiry arrival/Reply-To; newsletter pre-confirmation ineligibility, DOI arrival/link/redirect and membership; existing/unsubscribed contacts; actual campaign unsubscribe and future audience suppression; tracking and consent evidence. Follow [the acceptance matrix](delivery-configuration.md#verification-and-live-acceptance-record). Record observations without secrets, email addresses, message content or personalized tokens.
6. **Review evidence and prepare production settings.** Select the approved production list/template/inbox/origin/redirect, confirm sender authentication, shared controls, log redaction, key expiry/rotation ownership, monitoring and rollback. Recheck production headers, redirects, sitemap/canonicals and form endpoints for the intended domain.
7. **Obtain explicit authorization for commit/push and production deployment or service restart.** Launch only after the blocking rows above are resolved. After an authorized launch, perform a controlled live smoke test and monitor provider failures, confirmation and unsubscribe outcomes; do not describe local/mock success as live delivery.


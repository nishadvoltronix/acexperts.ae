# AC Experts — Next.js migration

Local rebuild of the publicly accessible https://acexperts.ae/ website, using Next.js App Router, React, TypeScript, local media and fonts. The October 2026 completion preserves the 46 migrated routes and adds duct-cleaning and HVAC service pages, for 48 public routes using the existing white/red design system. No WordPress installation, PHP, theme or plugin runtime is required. Browsing and builds need no database; enabling form delivery requires the shared PostgreSQL store through the `pg` runtime dependency.

The reference analysis and centralized token/component decisions are documented in [the design system](docs/design-system.md). The latest document comparison, full metadata audit and test results are in the [final verification report](docs/acexperts-final-verification-report.md). Production launch gates remain in the [production-readiness report](docs/acexperts-production-readiness-report.md), with the [deployment/rollback runbook](docs/acexperts-deployment-runbook.md), [database operations](docs/acexperts-database-operations.md), [security review](docs/acexperts-security-review.md) and [staging configuration checklist](docs/staging-configuration-checklist.md). The [earlier staging report](docs/acexperts-staging-readiness-report.md), [completion report](docs/acexperts-completion-report.md), [completion plan](docs/acexperts-completion-plan.md), [redesign report](docs/redesign-report.md) and [migration report](docs/migration-report.md) retain dated evidence.

## Run locally

Use Node.js 24 for the application and the TypeScript-backed Node test suite.

```powershell
npm ci
npm run dev
```

The default development URL is **http://localhost:3001**. Check which application owns an occupied port before using it; the completion checks use an isolated local production server on port 3112.

```powershell
npm run lint
npm run build
npm run start -- --port 3001
```

Stop the development server before starting production on the same port. The application serves all migrated page content and assets without making requests to WordPress. External group-company, social, telephone, email, WhatsApp and map links remain intentional external destinations.

## Content and routing

- `data/pages.json`: complete migrated page content, article metadata, FAQs and source provenance.
- `data/assets.json`: original-to-local media mapping with image dimensions and hashes.
- `data/crawl.json`: public crawl evidence, redirects, metadata, links and discovery sources.
- `app/[...slug]/page.tsx`: original public paths, including root-level article slugs and category/pagination paths. Pages render on the server for each request to supply fresh CSP nonces.
- `app/globals.css`: shared color, typography, spacing, radius, shadow, transition and responsive tokens/styles.
- `components/`: shared header/footer, UI primitives, homepage sections, internal `PageHero`, cards, `SharedCTA`, testimonials, accessible disclosures and contact/newsletter forms.
- `lib/`: content lookup, local link resolution and metadata generation.
- `docs/url-map.json`: every discovered HTML URL and its migration or redirect action.
- `docs/site-inventory.md`, `docs/assets-inventory.md`, `docs/source-audit.md`: source inventories and discrepancies.
- `docs/redesign-baseline.json`: preserved source-data, SEO implementation and original-media hashes captured before the redesign.
- `docs/acexperts-completion-report.md`: completed website implementation and its dated verification results.
- `docs/acexperts-staging-readiness-report.md`, `docs/staging-configuration-checklist.md`: current evidence, external configuration, controlled acceptance and launch blockers.
- `db/migrations/001-form-state.sql`: owner-applied schema for shared rate limits, durable submission claims and newsletter consent requests.
- `db/maintenance/form-state-retention.sql`: operator-only scoped cleanup of expired consent and eligible completed claims.
- `data/seo-requirements.json`: independent transcription of the original DOCX metadata requirements.
- `docs/completion-preservation-changes.json`: reviewed exact revisions permitted alongside the immutable original baseline.
- `docs/redesign-report.md`: historical redesign validation evidence.
- `docs/migration-report.md`: historical migration validation evidence.

Metadata retains the production canonical origin `https://acexperts.ae`. Category archives retain source `noindex` and are excluded from the generated sitemap. Existing redirect aliases use permanent Next.js redirects. No separate `/blog/[slug]` copies are introduced.

The homepage restores the original top information strip, uses the requested visible welcome H1, and adds three real articles, eight original FAQs and the existing villa installation project. The exact AC/HVAC services heading and Residential & Commercial benefits wording follow the Word document. Group-company links are visible in the footer. The full original homepage content remains in About's expandable section and the existing FAQ page. Existing animations, CTAs and About layouts remain in place. Following the owner's later confirmation, NADCA, ISIAQ, ISSA and IAQA appear in the homepage Certifications section, and ISO Certified appears in the emergency-service strip. Technician wording remains Experienced. Additional project records remain pending.

## Contact and newsletter

Both forms use server-side Brevo integration. Contact accepts the original fields, conditional Other detail, and new duct-cleaning/HVAC service choices. The server only returns success after Brevo returns HTTP 201 with a nonempty message ID. The newsletter requires an unchecked-by-default consent checkbox and starts Brevo double opt-in; acceptance asks the visitor to confirm their email and does not claim completed subscription.

Missing required configuration or unavailable shared storage returns generic HTTP 503 feedback without provider dispatch. Forms prevent repeated clicks and preserve input after failure. PostgreSQL atomically claims stable HMAC fingerprints before delivery, so instances sharing the database, namespace and key cannot dispatch the same active claim twice. Pending duplicates return 409; accepted outcomes suppress duplicates for 30 minutes and definite rejections for 60 seconds. Pending, uncertain and timeout claims never automatically expire or retry: an operator must reconcile provider state before releasing them. Database failures never fall back to in-memory delivery protection.

The newsletter records checked consent, exact wording/version, notice URL/version, request time, keyed email identity, list/template IDs and retention deadline before dispatch. Stale consent/notice versions are rejected. It requires approved `PRIVACY_NOTICE_URL`, `PRIVACY_NOTICE_VERSION` and `NEWSLETTER_CONSENT_RETENTION_DAYS`; both forms link the notice when configured. Stored confirmation remains `not_verified`: actual confirmation and withdrawal require protected Brevo/operator evidence. Contact enquiries never enroll visitors in marketing.

See [.env.example](.env.example), [delivery configuration](docs/delivery-configuration.md) and [the staging checklist](docs/staging-configuration-checklist.md) for all 13 application environment names, migration/least-privilege setup, retention operations and controlled live acceptance. No live delivery, confirmation, unsubscribe flow or deployment has been verified. Business privacy/retention approval and external provisioning remain required. No credentials are needed to build, browse locally or run mocked tests.

## Security

The contact and newsletter endpoints are public application routes. There are no application accounts, sessions, cookies, server actions or upload endpoints. Form handlers use parameterized PostgreSQL transactions through a separate runtime role; migration and retention privileges belong to an operator role. Remote database connections enforce certificate-verified TLS. Staging access protection belongs at the authorized hosting edge, covering every path and blocking direct-origin bypass. Any future private feature must enforce server access checks; session cookies must use HttpOnly, Secure and an appropriate SameSite policy. Keep secrets server-side and never log enquiry bodies or credentials.

Contact requests require JSON and an allowed Origin. The server rejects unknown fields, incorrect types, excessive lengths, invalid email/telephone formats and unsupported service values. The Other option requires a description. Request bodies are bounded while streaming, including when Content-Length is absent or misleading. Cross-site requests and uploads are rejected. All endpoint responses are non-cacheable and avoid reflecting submitted data or internal error details.

PostgreSQL enforces shared budgets of 30 contact attempts and 10 newsletter attempts per database calendar minute across all instances of one namespace. Secondary process-local caps remain, and browser-supplied forwarding/IP headers never establish trust. Shared protection persists across application restarts when the database preserves committed state and every worker uses the same database, namespace and stable HMAC key. Add per-client limits and trusted client identity at the hosting ingress/WAF; fixed-minute global budgets do not replace network flood protection. Configure request-size, connection and timeout limits there too.

`proxy.ts` creates a random nonce on every page request and overwrites client-supplied nonce/CSP headers. Production CSP disallows inline scripts without the nonce, inline event handlers, eval, frames and plugins. Reviewed rich content uses allowlisted HTML tags, attributes and URL protocols. JSON-LD retains its escaping and receives the nonce. Style attributes remain allowed for React/Next image sizing and artwork; script execution is separately restricted. Development alone permits eval for Next.js debugging.

Nonce-bearing pages use private, no-store caching and request-time rendering. This preserves server-rendered content, canonical URLs, structured data and indexing rules, but removes static HTML/CDN caching and increases rendering work. Do not override these pages to shared-cache HTML. Static image, font and script assets retain normal caching. Global headers include nosniff, frame denial, restricted browser permissions and a referrer policy; production sends one-year HSTS without extending it to unrelated subdomains. Deploy over HTTPS.

Run focused security tests with Node.js 24, then the browser check against an unconfigured local production server (it refuses remote hosts). Set invalid provider values on the isolated server before startup to prevent a real send:

```powershell
npm run test:security
npm run lint
npm run build
$env:CONTACT_FROM_EMAIL = 'disabled-local-validation'
$env:BREVO_NEWSLETTER_LIST_ID = 'disabled-local-validation'
npm run start -- --hostname 127.0.0.1 --port 3100
# In another terminal:
$env:BASE_URL = 'http://127.0.0.1:3100'
npm run check:security
```

Validation on 7 October 2026: all 17 focused tests, lint and the production build passed. The production browser check verified fresh nonces, spoof resistance, headers, hydration, mobile navigation, the Other field, the unsent contact response and blocking of parser-inserted scripts/onclick handlers. A separate HTTP pass verified all 46 routes retain titles, descriptions, canonicals, H1s, indexing and valid structured data, plus all 30 permanent aliases, robots and sitemap responses.

The code review uses the [OWASP Top 10:2025](https://top10.owasp.org/2025/) categories:

| Category | Review and boundaries |
| --- | --- |
| A01 Broken access control | Public contact and newsletter APIs exist; Origin/Fetch Metadata checks and JSON-only input restrict browser cross-site submissions. No private resources or role changes. |
| A02 Security misconfiguration | Enforced CSP, security headers, no-store contact responses, and restricted content rendering. Hosting must preserve these headers. |
| A03 Software supply chain | `pg` is the added PostgreSQL runtime dependency; matching TypeScript types are development-only. Retain the reviewed lockfile and rerun dependency audits for release; the dated earlier audit below does not cover later changes. |
| A04 Cryptographic failures | Random page nonces, production HSTS, stable keyed submission/email hashes and verified remote database TLS. Raw enquiry bodies/addresses are not stored in app tables; secrets and pseudonymous audit records require controlled access. HTTPS termination belongs to hosting. |
| A05 Injection | Exact input schemas, parameterized SQL values, HTML/URL allowlists, escaped structured data and script CSP. Schema migration is an explicit operator step, never request-driven DDL. |
| A06 Insecure design | Bounded request reads, shared database budgets and atomic durable claims; dispatch requires configured shared state and provider settings. Trusted per-client ingress protection and persistence/retention operations remain deployment requirements. |
| A07 Authentication failures | No authentication exists or is added. Future private endpoints need server-side authentication and authorization. |
| A08 Software/data integrity | Checked-in content is rendered through an allowlist; the lockfile is retained. No remote code or user uploads are accepted. |
| A09 Logging/alerting failures | Application code does not log payloads, cookies, tokens or personal information. Configure redacted status/rate-limit monitoring at ingress; no monitoring service is connected here. |
| A10 Exceptional conditions | Malformed/oversized requests, stream failures/timeouts and throttling return controlled errors without stack traces or payload echoes. |

The dated 7 October 2026 dependency audit reported five high-severity findings in the development-only ESLint dependency chain, all stemming from [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The advisory lists no patched version as of 7 October 2026. Do not feed untrusted glob patterns to build/lint tooling. An incompatible framework-tooling downgrade was not applied; recheck the advisory when updating dependencies. This review and automated checks cover the repository, not deployed infrastructure or a penetration test.

## Reproduce the migration

These commands read only publicly accessible source pages and assets. They never submit live forms.

```powershell
npm run crawl
node scripts/download-assets.mjs
npm run migrate
```

The crawler exhausts navigation, internal links, canonicals, robots and sitemap discovery; source HTML snapshots are stripped of scripts/styles and stored in ignored `docs/source/*.html` files. Run the crawl before rerunning content migration on a fresh checkout. The complete generated content and assets are already included, so normal development and production builds do not require a crawl or network access.

## Validate the current implementation

Use a free local port and a production build. Prevent real provider calls for local checks by overriding required configuration with invalid placeholders:

```powershell
npm run lint
npm run typecheck
npm run build
$env:CONTACT_FROM_EMAIL = 'disabled-local-validation'
$env:BREVO_NEWSLETTER_LIST_ID = 'disabled-local-validation'
npm run start -- --hostname 127.0.0.1 --port 3112
```

In a second terminal:

```powershell
$env:BASE_URL = 'http://127.0.0.1:3112'
$env:ARTIFACT_DIR = 'artifacts/local-verification'
New-Item -ItemType Directory -Force $env:ARTIFACT_DIR | Out-Null
$env:VALIDATION_OUTPUT = Join-Path $env:ARTIFACT_DIR 'route-validation.json'
npm test
npm run check:routes
npm run check:responsive
npm run check:completion
npm run check:motion
npm run check:ac-viewer
npm run check:security
```

`npm test` includes request security, content sanitization, mocked contact/newsletter integration, staging safety, PostgreSQL integration, two independent HTTP workers sharing real PostgreSQL, recovery cleanup regressions, original-content preservation, all 11 exact document SEO entries and complete, unique metadata across all 41 indexable pages. `BASE_URL` enables the rendered SEO tests. Provider mocks are hermetic even if a developer has live credentials. The real PostgreSQL cases explicitly skip without `FORM_TEST_DATABASE_URL`; a skipped database suite is not shared-store verification. Choose a fresh artifact directory for each run so previous evidence remains intact. The separately guarded backup/restore drill is documented in [database operations](docs/acexperts-database-operations.md); it must never target production data.

For actual PostgreSQL integration, explicitly provision an isolated loopback database named `acexperts_test` with role `acexperts_test`, and apply `db/migrations/001-form-state.sql` once to that disposable database. The integration role needs access to the test schema and DELETE for fixture cleanup; production runtime roles must not receive that cleanup privilege. The suite rejects remote hosts, other role/database names and URL query/fragment options. Use synthetic test credentials only:

```powershell
# Example for an already provisioned isolated local cluster; not production credentials.
$env:FORM_TEST_DATABASE_URL = 'postgresql://acexperts_test:local-synthetic-password@127.0.0.1:55432/acexperts_test'
npm run test:shared
# npm test also includes these cases while FORM_TEST_DATABASE_URL is set.
```

These tests use real PostgreSQL transactions, independent pools/processes and fake provider transport. They exercise shared budgets/claims, consent persistence, failed writes and outage safety without live mail. See [database setup and operations](docs/delivery-configuration.md#shared-postgresql-setup-and-operations); never apply the test schema or fixtures to staging/production data.

The route validator checks 48 pages, metadata, H1s, content, schema, 30 page redirects, 121 media redirects, links, original and upgraded images, robots, sitemap and 404 behavior. It preserves the original baseline and permits only the exact documented completion revisions. The responsive audit covers every route at 320, 360, 390, 414, 768, 1024, 1280 and 1440px (384 cases). The completion browser suite checks restored content, working project filters, service CTAs, keyboard use, intercepted form states and automated accessibility. Motion and AC-viewer checks retain reduced-motion, no-JavaScript, scrolling and animation controls. Chrome is required for these Playwright scripts.

`npm run validate`, `scripts/browser-check.mjs` and `scripts/redesign-browser-check.mjs` are maintained historical suites. Their obsolete navigation/project/newsletter expectations have been aligned with documented current behavior while retaining meaningful coverage. Run them against the same deliberately disabled local server, using a separate artifact directory:

```powershell
$env:ARTIFACT_DIR = 'artifacts/local-verification/historical'
New-Item -ItemType Directory -Force $env:ARTIFACT_DIR | Out-Null
$env:VALIDATION_OUTPUT = Join-Path $env:ARTIFACT_DIR 'validation-results.json'
$env:LOCAL_FORM_TEST_MODE = 'disabled-provider'
npm run validate
node scripts/browser-check.mjs
node scripts/redesign-browser-check.mjs
```

`LOCAL_FORM_TEST_MODE=disabled-provider` acknowledges that the operator disabled delivery on the server; **the flag itself does not disable provider calls**. Historical suites and the security browser suite can POST to real local API routes. Loopback restrictions alone cannot prevent a configured server from contacting Brevo. Historical reports remain dated evidence; inspect the current report for actual results. The [performance review](docs/acexperts-performance-review.md) records actual local measurements and exact fresh-output sampler/Lighthouse commands; field Core Web Vitals and deployed SEO require authorized post-deployment verification.

# AC Experts — Next.js migration

Local rebuild of the publicly accessible https://acexperts.ae/ website, using Next.js App Router, React, TypeScript, local media and fonts. The October 2026 redesign applies the supplied homepage's white/red design system to all 46 existing public routes. No WordPress installation, database, PHP, theme or plugin runtime is required.

The reference analysis and centralized token/component decisions are documented in [the design system](docs/design-system.md). Current production checks and practical limitations are in [the redesign report](docs/redesign-report.md); [the migration report](docs/migration-report.md) retains the earlier migration evidence.

## Run locally

Requires Node.js 20.9 or newer; developed with Node.js 24.

```powershell
npm ci
npm run dev
```

Open **http://localhost:3001**. Port 3001 was explicitly selected to keep the separate Switchgear site on port 3000 running.

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
- `docs/redesign-report.md`: current redesign validation evidence, reference limitations and integration limits.
- `docs/migration-report.md`: historical migration validation evidence.

Metadata retains the production canonical origin `https://acexperts.ae`. Category archives retain source `noindex` and are excluded from the generated sitemap. Existing redirect aliases use permanent Next.js redirects. No separate `/blog/[slug]` copies are introduced.

The homepage preserves the supplied section sequence and artwork. Its original H1 remains accessible, while the supplied visual headline is rendered separately. Original homepage copy, links and imagery remain in the expandable "More about our AC services" section on About; its eight FAQs and FAQ illustration are retained on the FAQ page. All original content data remains unchanged. Existing business contact details, statistics and testimonials take precedence where reference-image copy conflicts with the migrated information.

## Contact form

The original visible form fields are recreated, including the conditional Other service field. `app/api/contact/route.ts` delegates request validation and the delivery boundary to `lib/contact-request.ts`: valid submissions receive HTTP 503 with an explicit unsent message and telephone/email alternatives. No enquiries are persisted, logged or forwarded. Connect a server-side email or CRM adapter before enabling submission delivery. No credentials are included or required to run the local website.

The footer newsletter field validates email format locally, then explicitly reports that signup is unavailable and the email was neither sent nor saved. It does not call a mailing-list service; connect one before enabling subscriptions.

## Security

The contact endpoint is intentionally public. There are no accounts, sessions, cookies, server actions, database queries or upload endpoints. Authentication and authorization behavior is unchanged. New private features must enforce access checks on the server; any future session cookies must use HttpOnly, Secure and an appropriate SameSite policy. Delivery integrations must keep credentials server-side and must never log enquiry bodies or credentials.

Contact requests require JSON and an allowed Origin. The server rejects unknown fields, incorrect types, excessive lengths, invalid email/telephone formats and unsupported service values. The Other option requires a description. Request bodies are bounded while streaming, including when Content-Length is absent or misleading. Cross-site requests and uploads are rejected. All endpoint responses are non-cacheable and avoid reflecting submitted data or internal error details.

The endpoint has a shared, process-local rate limit of 30 requests per minute. It deliberately ignores client-supplied IP forwarding headers. All callers share this limit; restarting a process resets it and additional workers have separate counters. A deployment-wide limit at the trusted ingress or shared store is required for multiple instances and before enabling message delivery. Configure request-size, connection and timeout limits at the hosting layer as well; application limits do not replace network flood protection.

`proxy.ts` creates a random nonce on every page request and overwrites client-supplied nonce/CSP headers. Production CSP disallows inline scripts without the nonce, inline event handlers, eval, frames and plugins. Reviewed rich content uses allowlisted HTML tags, attributes and URL protocols. JSON-LD retains its escaping and receives the nonce. Style attributes remain allowed for React/Next image sizing and artwork; script execution is separately restricted. Development alone permits eval for Next.js debugging.

Nonce-bearing pages use private, no-store caching and request-time rendering. This preserves server-rendered content, canonical URLs, structured data and indexing rules, but removes static HTML/CDN caching and increases rendering work. Do not override these pages to shared-cache HTML. Static image, font and script assets retain normal caching. Global headers include nosniff, frame denial, restricted browser permissions and a referrer policy; production sends one-year HSTS without extending it to unrelated subdomains. Deploy over HTTPS.

Run focused security tests with Node.js 24, then the browser check against a local production server (it refuses remote hosts):

```powershell
npm run test:security
npm run lint
npm run build
npm run start -- --port 3100
# In another terminal:
npm run check:security
```

Validation on 7 October 2026: all 17 focused tests, lint and the production build passed. The production browser check verified fresh nonces, spoof resistance, headers, hydration, mobile navigation, the Other field, the unsent contact response and blocking of parser-inserted scripts/onclick handlers. A separate HTTP pass verified all 46 routes retain titles, descriptions, canonicals, H1s, indexing and valid structured data, plus all 30 permanent aliases, robots and sitemap responses.

The code review uses the [OWASP Top 10:2025](https://top10.owasp.org/2025/) categories:

| Category | Review and boundaries |
| --- | --- |
| A01 Broken access control | Only a public contact API exists; Origin/Fetch Metadata checks and JSON-only input restrict browser cross-site submissions. No private resources or role changes. |
| A02 Security misconfiguration | Enforced CSP, security headers, no-store contact responses, and restricted content rendering. Hosting must preserve these headers. |
| A03 Software supply chain | No new dependencies. Production dependency audit reports no known advisories as of 7 October 2026. Development tooling has the residual advisory below. |
| A04 Cryptographic failures | Random per-request nonces and production HSTS; no enquiry persistence, credentials or session cookies. HTTPS termination belongs to hosting. |
| A05 Injection | Exact input schema, no query construction, HTML/URL allowlists, escaped structured data and script CSP. No SQL/NoSQL execution exists. |
| A06 Insecure design | Bounded request reads and process-local throttling; delivery remains disabled. Distributed abuse protection is a deployment requirement. |
| A07 Authentication failures | No authentication exists or is added. Future private endpoints need server-side authentication and authorization. |
| A08 Software/data integrity | Checked-in content is rendered through an allowlist; the lockfile is retained. No remote code or user uploads are accepted. |
| A09 Logging/alerting failures | Application code does not log payloads, cookies, tokens or personal information. Configure redacted status/rate-limit monitoring at ingress; no monitoring service is connected here. |
| A10 Exceptional conditions | Malformed/oversized requests, stream failures/timeouts and throttling return controlled errors without stack traces or payload echoes. |

The full dependency audit reports five high-severity findings in the development-only ESLint dependency chain, all stemming from [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The advisory lists no patched version as of 7 October 2026. Do not feed untrusted glob patterns to build/lint tooling. An incompatible framework-tooling downgrade was not applied; recheck the advisory when updating dependencies. This review and automated checks cover the repository, not deployed infrastructure or a penetration test.

## Reproduce the migration

These commands read only publicly accessible source pages and assets. They never submit live forms.

```powershell
npm run crawl
node scripts/download-assets.mjs
npm run migrate
```

The crawler exhausts navigation, internal links, canonicals, robots and sitemap discovery; source HTML snapshots are stripped of scripts/styles and stored in ignored `docs/source/*.html` files. Run the crawl before rerunning content migration on a fresh checkout. The complete generated content and assets are already included, so normal development and production builds do not require a crawl or network access.

## Validate the current redesign

Run against a production build for final verification. Development can remain on port 3001 while production runs on 3100:

```powershell
npm run lint
npm run build
npm run start -- --port 3100
```

In a second terminal:

```powershell
$env:BASE_URL = 'http://localhost:3100'
node scripts/validate-redesign.mjs
node scripts/redesign-browser-check.mjs
node scripts/redesign-performance.mjs
```

The HTTP validator compares original data/assets against the recorded baseline and checks all 46 public paths, preserved metadata/H1s, articles, 59 FAQs, relocated homepage sections, redirects, rendered links/images, sitemap, robots and 404 behavior. The full browser audit checks every route at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 pixels (414 cases), shared design consistency, accessibility, navigation, FAQs, filters, local form behavior and console/hydration errors. Screenshots and JSON evidence are stored under `docs/`. Chrome/Edge is detected at its standard Windows location; set `CHROME_PATH` for another Chromium executable.

For the smaller four-route development check, set `$env:REDESIGN_SMOKE = '1'` before running the browser script; remove that variable before the full audit. The performance script records six local cold-context samples with explicit mobile throttling. These are lab measurements, not field Core Web Vitals. The original `npm run validate` and `scripts/browser-check.mjs` belong to the historical migration workflow; use the redesign scripts for the current UI.

Source-derived corrections (template contact placeholders, broken brochure button, service links, counter animation starting values and absent headings) are recorded with the migrated content and in the migration report. Field Core Web Vitals and search ranking continuity require post-deployment monitoring; a local build cannot establish them.

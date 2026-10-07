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
- `app/[...slug]/page.tsx`: statically generated original public paths, including root-level article slugs and category/pagination paths.
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

The original visible form fields are recreated, including the conditional Other service field. Delivery is intentionally isolated in `app/api/contact/route.ts`: valid submissions receive HTTP 503 with an explicit unsent message and telephone/email alternatives. No enquiries are persisted, logged or forwarded. Connect a server-side email or CRM adapter before enabling submission delivery. No credentials are included or required to run the local website.

The footer newsletter field validates email format locally, then explicitly reports that signup is unavailable and the email was neither sent nor saved. It does not call a mailing-list service; connect one before enabling subscriptions.

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

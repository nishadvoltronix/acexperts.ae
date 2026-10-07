# AC Experts migration report

Generated: 2026-10-05T10:20:18.858Z

Every recorded local HTTP, redirect, metadata, content, and asset check passed. Recorded browser, responsive, interaction, and automated accessibility checks passed.

## Coverage

| Item | Count |
| --- | ---: |
| Original public URLs discovered | 76 |
| Canonical content pages in data | 46 |
| Unique migrated routes in URL map | 46 |
| Source URLs mapped to permanent redirects | 30 |
| Source URLs without migration or redirect | 0 |
| Local URLs verified | 76 |
| Downloaded image files | 116 |
| Downloaded documents | 0 |
| Unique downloaded asset files | 123 |
| Asset download failures | 0 |
| Rendered internal link/asset targets tested | 1063 |
| Broken local targets | 0 |
| Metadata/content/route validation failures | 0 |
| Browser viewport cases | 90 |
| Browser/interaction/accessibility failures | 0 |
| Original media URL redirects verified | 121 |
| Original media redirect failures | 0 |

The inventory is based on public navigation, internal links, canonical URLs, robots, and sitemaps. Source crawl time: 2026-10-05T09:58:34.053Z. Canonical content pages and redirect aliases are counted separately. See [site inventory](site-inventory.md), [URL map](url-map.json), [asset inventory](assets-inventory.md), and [source audit](source-audit.md).

## Verification evidence

- [HTTP validation results](validation-results.json): exact URL responses, permanent redirects, titles, descriptions, canonicals, H1s, article paragraph checks, actual rendered links and image targets, sitemap, and robots.
- [Browser validation results](browser-validation-results.json): viewport cases, overflow, image decoding, JavaScript errors, keyboard/mobile navigation, FAQ interaction, local contact form behavior, and axe checks.
- [Local screenshots](screenshots/local/).
- [Original media redirect validation](media-redirect-validation.json): 121 original media URL redirects checked; 0 failures.

Browser geometry evidence was recorded at 2026-10-05T10:15:21.622Z; affected accessibility checks and additional component interactions were rechecked at 2026-10-05T10:18:40.476Z. The 90 previously passing geometry cases were retained because the final fix only underlined existing text links.

- Build/lint verification: [record](build-verification.json).

```json
{
  "verifiedAt": "2026-10-05T10:17:07.647Z",
  "commands": [
    {
      "command": "npm run lint",
      "exitCode": 0
    },
    {
      "command": "npm run build",
      "exitCode": 0
    },
    {
      "command": "npm audit --omit=dev",
      "exitCode": 0
    }
  ],
  "node": "v24.19.0",
  "next": "^16.3.8",
  "staticallyGeneratedContentPages": 46,
  "developmentUrl": "http://localhost:3001",
  "productionValidationUrl": "http://127.0.0.1:3100"
}
```

## Current failures

- No failures in the checks that have run.

## Source URLs not migrated

- No URL-map entries are left without a page or permanent redirect.

## Source quirks and migration decisions

- The original public contact form is embedded through Zoho Forms. The new frontend is local; sending remains intentionally disabled until a backend is configured. Valid local submissions return HTTP 503 with an explicit unsent-message notice. No test submitted the live form.
- The FAQ brochure Download points to a placeholder, so it is not a downloadable public PDF. No document is fabricated.
- The source FAQ sidebar contains template contact details for a different country and example email. Those are recorded in the source audit and not treated as verified business details.
- The contact page's public map names Nathan Star Technical Services LLC; its identity is a source discrepancy.
- Source article author display and biography spellings differ (Maries/Maris). Source text is preserved.
- The original installation sidebar email differs from the site-wide contact email; see the source audit.
- Source date/archive aliases that resolve to other canonical pages are represented by explicit permanent redirects; they are not duplicate indexed content pages.
- Corrected the Emergency AC Maintenance service card link, which pointed to the general repair page in the source.
- Rendered the source counter final value without requiring animation: Repair Completed — 650
- Rendered the source counter final value without requiring animation: Proactive Team — 200
- Rendered the source counter final value without requiring animation: Clients — 156
- Corrected the stale service-sidebar email info@switchgear.com to the company email info@voltronix.ae published on the contact page.
- Replaced the source Zoho script-driven form with the local contact form component.
- Removed unrelated theme demonstration sidebar with fake US address, placeholder phone/email and unavailable brochure.

## Remaining work

- Configure and verify a real contact-form backend before deployment; local validation does not claim delivery.
- Confirm the source map identity and inconsistent sidebar contact details with the business before publication.
- Deployment, search-engine recrawling, field Core Web Vitals, and search ranking outcomes are outside local verification. Existing URLs and metadata are retained, but ranking outcomes cannot be guaranteed.

Local development command: `npm run dev` at `http://localhost:3001`. No live website files, forms, or administrative settings were modified.

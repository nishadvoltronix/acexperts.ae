# AC Experts redesign report

Completed **5 October 2026, Dubai time**. The supplied homepage composition now defines the shared design system for all **46 existing public routes**. Final production checks passed, including the preserved content/SEO audit and consolidated browser coverage at all nine requested widths.

## Implementation and reference fidelity

The homepage retains the reference's section sequence: compact white header, two-column technician hero, four service cards, company statistics, red benefits strip, brands, testimonials, contact CTA and five-column footer. Its logo, technician/AC, technician/van and skyline artwork are local views into the supplied raster. Internal pages use the same typography, color tokens, buttons, cards, spacing, icon treatment, header, footer and CTA, with a reusable internal hero and breadcrumb.

The [design-system analysis](design-system.md) records the palette, typography, measurements, component treatments and responsive decisions. Shared implementation lives in `app/globals.css` and reusable `Header`, `Footer`, `PageHero`, `SharedCTA`, UI, card and content components. The redesign covers About, Services, all four service details, both project listings, the project detail, Products, Blog, all 24 articles, eight archives, FAQ, Contact and the 404 experience. Existing URLs remain unchanged.

The reference is a flattened **705 × 1600 JPEG**, not original layered artwork or CSS. Desktop composition and artwork were matched against it; this report does **not** claim pixel-perfect equivalence. Enlarged raster artwork retains the source's resolution limit. Font identification, mobile/tablet layouts, open-menu states, focus/hover behavior and transitions are inferred because the supplied image contains no specification for them. Responsive adjustments and reduced-motion support preserve the same visual language.

Business information remains governed by the existing migrated content. The existing phone, email, address, social destinations, statistics and testimonials are retained where the image's copy differs. The diagnostic badge reads “Expert AC Diagnostics” without introducing an unverified AI feature. The screenshot's legal links have no corresponding migrated legal pages; the footer instead links accurately to existing FAQ and Contact pages. These are documented content decisions rather than a claim that every word in the raster was copied.

## Content and SEO preservation

The [before-redesign baseline](redesign-baseline.json) and [final HTTP/content audit](redesign-validation.json) verify:

| Check | Result |
| --- | ---: |
| Public content routes returning HTTP 200 | 46 / 46 |
| Protected data, SEO/backend files and original media with unchanged SHA-256 hashes | 134 / 134 |
| Original local assets preserved within those hashes | 123 / 123 |
| Articles with preserved paragraph/list/table/heading text | 24 / 24 |
| Article text-block checks | 1,458 |
| Existing FAQs rendered and preserved | 59 / 59 |
| Relocated original homepage sections checked | 12 / 12 |
| Original URL redirects returning permanent HTTP 308 | 30 / 30 |
| Original media redirects checked | 121 / 121 |
| Rendered local link, image, stylesheet and script targets checked | 1,103 |
| Local fragment links checked | 138 |
| Indexable canonical URLs in the sitemap | 39 |
| Outstanding HTTP, content, redirect or SEO failures | 0 |

All page titles, descriptions, canonicals, indexability and single H1 values match the migrated data. The homepage keeps its original H1 available to assistive technology; the supplied visible hero headline is a separate heading. The sitemap excludes the seven existing non-indexable archives. Robots, valid structured-data JSON and the branded HTTP 404 response were checked. A separate [heading audit](redesign-heading-validation.json) verifies all 46 routes after correcting legacy heading-level skips without rewriting their text.

To retain the supplied homepage layout, its original copy, links and images remain publicly available in **About → “More about our AC services”**. Its eight original FAQs and FAQ illustration remain on **FAQ**, alongside that page's twelve questions; the FAQ structured data matches those twenty displayed answers. The relocation audit checks 79 original text blocks, 23 links and 22 image/alt pairs across the twelve source sections. No original content data was deleted or rewritten.

## Browser, accessibility and functional verification

The [consolidated browser evidence](redesign-browser-final.json) contains **414 route/viewport cases**: every one of the 46 routes at **320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 pixels**. It records:

- No document-level horizontal overflow, broken/undecoded images, failed page requests, JavaScript console errors or hydration errors in the passing cases.
- 414 checks of shared header/footer links and logos, heading/body font families, primary token and page colors.
- 57 automated WCAG A/AA accessibility scans with no reported violations, including the expanded original-homepage disclosure.
- 18 passing interactions covering desktop/mobile keyboard navigation, Escape/focus behavior, FAQ accordions, project filtering, testimonial arrows/dots, original-content disclosure, contact validation/conditional fields and truthful newsletter feedback.
- No external browser requests during the audit. Intentional external social/company/contact links remain available for visitors to activate.

The evidence retains the [initial 414-case run](redesign-browser-validation.json) and the [final-build 63-case recheck](redesign-browser-recheck.json). The final record uses **351 unaffected cases from the initial run plus 63 rechecked cases across seven routes**. It does not imply that all 414 cases were rerun after the final scoped fixes.

The initial run exposed one unnamed image-only project link and five load timeouts caused by a stalled AVIF optimizer request for one article image. The link received an accessible name. After the final build and production-process restart, the optimized AVIF returned HTTP 200; that article passed all nine widths with the original asset and optimization retained. [Image recovery evidence](redesign-image-recovery.json) records the result. The scoped recheck also covers the corrected article/FAQ heading hierarchy and expanded About gallery; [the separate disclosure audit](redesign-disclosure-validation.json) checks the expanded content at 320px and 1440px. All six initial browser findings are explicitly superseded by passing evidence, rather than removed from the original report.

Screenshots for every public route at desktop width and selected mobile views are available in [the redesign screenshot directory](screenshots/redesign/). Automated accessibility checks and keyboard interactions describe the checks performed; they are not a formal accessibility certification.

## Build and performance

`npm run lint` and `npm run build` both completed successfully with exit code 0. The [build verification record](redesign-build-verification.json) contains their final commands, output and timestamps, including Next.js TypeScript validation and static generation.

The [performance record](redesign-performance.json) contains six cold-browser-context samples from the local production build: homepage, installation service and an article, each at desktop and mobile widths.

| Local sample group | LCP range | CLS range |
| --- | ---: | ---: |
| Desktop, 1440px, unthrottled | 320–668 ms | 0 |
| Mobile, 390px, 4× CPU slowdown, 100ms latency, 1.6Mbps download | 1,440–2,900 ms | 0–0.0001 |

Initial measured transfer was approximately **456–540 KB**, including about **148 KB of scripts**, with no external requests. These are single local lab samples, not field Core Web Vitals, deployment performance guarantees or search-ranking measurements.

## Existing integration limits and diagnostic note

Contact delivery remains intentionally disabled: valid local submissions return HTTP 503 and explicitly state that the message was not sent. Required fields, conditional Other-service details and local validation remain functional. No enquiry is saved or forwarded. The new newsletter similarly validates email format but clearly reports that the email was not sent or saved; it makes no API request. Real delivery requires the corresponding backend integrations.

The installed Next.js version logs `Internal: NoFallbackError` when an unknown static dynamic-route path is requested. [The diagnostic check](redesign-not-found-diagnostic.json) confirms that the visitor still receives the correct branded HTTP 404 page and known routes remain HTTP 200. This is distinct from the passing public-route/browser checks above.

The working preview remains **http://localhost:3001**; production verification used **http://localhost:3100**. The separate Switchgear application on port 3000 and the public live website were not changed. [README](../README.md) documents running the site and reproducing the current validation workflows.

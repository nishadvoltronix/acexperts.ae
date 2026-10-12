# AC Experts completion report

**Certification update — 12 October 2026:** The owner confirmed NADCA, ISIAQ, ISSA and IAQA, then separately confirmed “ISO is verified; project details pending.” These confirmations supersede the certification omission/blocker wording below. The four homepage credentials and emergency `ISO Certified` label are implemented; [current requirements and verification status](acexperts-requirements-verification.md#latest-full-document-and-iso-recheck) record the additions. Additional projects remain pending. Historical counts/evidence and the separate security, hosting, privacy and live-delivery release blockers are unchanged.

12 October 2026, Asia/Dubai. Starting commit: `dd775cc`. Work remains uncommitted.

**Launch-readiness decision: READY FOR STAGING.**

The safely actionable website changes are implemented and locally verified. Production delivery and newsletter enrollment are not verified because the approved Brevo account configuration is unavailable. No site was deployed, no DNS or production services were changed, and no email or newsletter request was sent to Brevo.

## Requirements and implementation

The source requirements are the user's final implementation prompt and `web modification- acexperts.docx` (SHA-256 `79fc75b01983e5f24a3b2f2f5554ffdd23cf6ded0eb2179a1ed5041e12c2e365`). The user explicitly selected Brevo for both forms and confirmed that no verified certifications are available.

| Original requirement | Implementation | Status |
| --- | --- | --- |
| Restore original top header strip | Restored the original screenshot's Since 2009, location, telephone, email, group-company links and social links. The strip scrolls away while navigation remains sticky. | COMPLETE |
| Exact homepage title | One visible H1: “Welcome to Voltronix, AC Service Company in Dubai”. The previous tagline remains subordinate text. | COMPLETE |
| Homepage blog, FAQ and portfolio | Three latest migrated articles, all eight original homepage FAQs and the existing villa installation project; working links and matching FAQ structured data. No new projects or reviews invented. | COMPLETE |
| Residential & Commercial benefits wording | Added to the red benefits band. | COMPLETE |
| Footer group-company content | Visible group description and Contracting, DEWA Approvals, AC Experts and Switchgear links. | COMPLETE |
| Revised services heading | “Complete AC & HVAC Services in Dubai” on the homepage and services page. | COMPLETE |
| Service-detail CTAs | Existing shared CTA remains on all four original service pages and both new services. | COMPLETE |
| Emergency trust/certification strip | Added source-supported Experienced Technicians, Rapid Response and Dubai Coverage. Certified Professionals and ISO Certified are omitted because credentials cannot be verified. | PARTIAL |
| Homepage certifications | No certification badges added. The existing hero label “Certified” was changed to “Experienced” following the user's confirmation. Existing migrated prose and mandated SEO wording otherwise remain intact. | BLOCKED — no verified certificates supplied |
| AC/HVAC project categories and working filters | AC Repair, AC Maintenance, AC Installation, Commercial AC (HVAC), and All. Only the existing villa is classified as installation; other categories display an honest empty state. Both project listings and the detail link work. | COMPLETE |
| Duct-cleaning and HVAC pages | Added `/ac-duct-cleaning-services-in-dubai/` and `/hvac-services/`; linked from service content/navigation. Copy is grounded in existing business content, with provenance in each page's migration notes. | COMPLETE |
| About spacing/button fixes, existing motion and responsiveness | Existing layout and AC-viewer code retained; retested with geometry, browser interactions and screenshot inspection. | COMPLETE |
| Exact SEO for 11 pages and regression tests | Independent Word-table fixture; actual metadata function and rendered title, description, canonical, indexability and H1 hierarchy tested. | COMPLETE |
| Contact delivery | Brevo transactional adapter and complete frontend-to-route flow implemented; acceptance requires documented HTTP 201 plus a nonempty message ID. Configured success/failure behavior verified using mocks. | PARTIAL — live account configuration and acceptance not verified |
| Newsletter signup | Server-side Brevo double opt-in adapter; required unchecked consent; validation, spam trap, duplicate handling, bounded requests and provider errors. UI asks for email confirmation after acceptance. | PARTIAL — live double opt-in and unsubscribe not verified |
| Preservation baseline | Original baseline retained; exact reviewed file revisions documented, additional routes explicitly allowed, mapped quality images validated with original alt text. | COMPLETE |

## SEO results

All 11 title/description pairs match the exact Word table. Tests also check the actual metadata function, Open Graph/Twitter metadata, production canonical URLs, index/follow directives, one H1 per page and no skipped main-content heading levels. Home and Services use the requested headings; other existing page headings are preserved.

| Page | Title | Description | Canonical / H1 / robots |
| --- | --- | --- | --- |
| `/` | COMPLETE | COMPLETE | COMPLETE |
| `/products/` | COMPLETE | COMPLETE | COMPLETE |
| `/contact-us/` | COMPLETE | COMPLETE | COMPLETE |
| `/about/` | COMPLETE | COMPLETE | COMPLETE |
| `/emergency-ac-maintenance-service/` | COMPLETE | COMPLETE | COMPLETE |
| `/ac-installation-service/` | COMPLETE | COMPLETE | COMPLETE |
| `/services/` | COMPLETE | COMPLETE | COMPLETE |
| `/ac-repair-services/` | COMPLETE | COMPLETE | COMPLETE |
| `/faq/` | COMPLETE | COMPLETE | COMPLETE |
| `/projects/` | COMPLETE | COMPLETE | COMPLETE |
| `/preventive-ac-maintenance-service/` | COMPLETE | COMPLETE | COMPLETE |

Exact strings and source table rows: [SEO requirements](../data/seo-requirements.json). Regression tests: [seo-metadata.test.mjs](../scripts/seo-metadata.test.mjs).

## Actual validation results

Checks ran against an isolated local production build at `http://127.0.0.1:3112`. Required provider settings were deliberately invalid on that server so direct form checks could not send mail. The existing applications on ports 3001/3002 were left alone.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Production build | Exit 0; Next.js 16.3.8 compilation and TypeScript checks passed | [Verification summary](../artifacts/completion/verification-summary.json) |
| ESLint and standalone type checking | Both exit 0 | [Verification summary](../artifacts/completion/verification-summary.json) |
| Unit, integration, security, preservation and SEO | **61 passed, 0 failed, 0 skipped**, including all 11 rendered SEO cases | [TAP output](../artifacts/completion/unit-integration-seo.tap) |
| Routes, content and assets | **48 pages**, 24 articles, 67 rendered FAQ occurrences, 30 page redirects, 121 media redirects, 869 linked targets; zero failures | [Route validation](../artifacts/completion/route-validation.json) |
| Original media and content preservation | Original media hashes preserved; all original FAQ answers, canonicals, indexability and untouched content sections retained | [Tests](../scripts/preservation-contract.test.mjs), [reviewed exceptions](completion-preservation-changes.json) |
| Responsive geometry/images | **384/384 cases**: all 48 routes at 320, 360, 390, 414, 768, 1024, 1280 and 1440px | [Responsive evidence](../artifacts/completion/responsive-layout-check.json) |
| Final homepage wording recheck | **8/8 widths** after changing Certified to Experienced; zero failures | [Final homepage evidence](../artifacts/completion/home-final/responsive-layout-check.json) |
| Completion browser suite | **22 checks passed**, including 16 automated WCAG A/AA scans at 390/1440px | [Browser evidence](../artifacts/completion/completion-browser-check.json) |
| Motion | Eight widths plus reduced motion, no JavaScript, missing IntersectionObserver and live preference changes passed | [Motion evidence](../artifacts/completion/motion-browser-check.json) |
| Interactive AC viewer | **12 groups passed**: five widths, autoplay/pause, hover/scroll, touch, cleanup and fallback modes | [AC-viewer evidence](../artifacts/completion/ac-viewer-check.json) |
| Production security browser | Headers, fresh nonces, spoof resistance, hydration, keyboard/mobile navigation, actual unconfigured contact POST and CSP injection probes passed | [Verification summary](../artifacts/completion/verification-summary.json) |
| Actual newsletter route | Five consent/origin/unconfigured checks passed, with no-store responses and no false success | [API route evidence](../artifacts/completion/api-route-check.json) |
| Screenshot inspection | Homepage at 320/390/768/1440, About at 390/1440, service cards, projects and footer inspected; no overlap, clipping or horizontal overflow observed | [Geometry record](../artifacts/completion/visual-layout.json), `artifacts/completion/visual-*.png` |

The 67 FAQ checks count the restored homepage's eight questions as well as the existing copies on the FAQ page; they do not represent new invented answers. Automated accessibility scans report zero violations; incomplete/manual-review items remain recorded and are not treated as accessibility certification. Visual inspection and functional checks are local browser evidence, not a claim of testing physical devices.

The final homepage wording change was rechecked at all eight widths. The final server-origin correction was covered by new unit regressions, a fresh build, all 61 tests and the actual browser-to-API security check. Unaffected animation and internal-page evidence was retained.

## Five old validator failures and corrections

1. `data/pages.json` differed from the original snapshot because of committed contact-company and FAQ-logo corrections. This task additionally applies the requested metadata, service headings/categories and two service pages. Its reviewed final hash is pinned in `completion-preservation-changes.json`; arbitrary future changes still fail.
2. `app/api/contact/route.ts` differed because the earlier security work delegated validation to the server handler. This implementation explicitly selects Node runtime for its crypto-backed integration. The exact revised file is pinned and security/delivery tests protect its behavior.
3. Three relocation failures represented 13 image references whose pixels had intentionally been upgraded. The validator now follows `data/image-quality.json` for rendered sources and still requires matching alt text, valid image responses and unchanged original-asset hashes.

The immutable migration baseline was not overwritten. Route additions are enumerated explicitly. Independent tests protect all original FAQ answers, route/canonical/indexing state and article content, and restrict the allowed protected-file exceptions to the two reviewed files.

A real issue surfaced during the direct API test: Next normalized the local request hostname to `localhost` while the browser used `127.0.0.1`, causing HTTP 403. The guard now recognizes only explicit loopback aliases at the same protocol and port, rejects noncanonical/malformed origins, and retains cross-site and production-origin restrictions. Added tests cover accepted aliases and rejected foreign hosts, ports and protocols. The direct browser submission now returns the expected unconfigured 503.

## Changed implementation files

| Area | Files |
| --- | --- |
| Homepage, header and footer | `components/HomePage.tsx`, `Header.tsx`, `Footer.tsx`; new `TopStrip.tsx`, `CompanyLinks.tsx`, `HomepageSections.tsx`; `app/completion-home.css` |
| Service/portfolio/SEO content | `data/pages.json`, `data/seo-requirements.json`, `lib/site.ts`, `lib/project-categories.ts`, `components/PageContent.tsx`, `ProjectFilters.tsx`, `app/completion-services.css` |
| Forms and provider integration | `components/ContactForm.tsx`, `NewsletterForm.tsx`; `app/api/contact/route.ts`, `app/api/newsletter/route.ts`; `lib/contact-request.ts`, `newsletter-request.ts`, `form-delivery.ts`, `form-security.ts`, `form-submissions.ts`; `app/forms.css`, `.env.example` |
| Styling/tooling | `app/globals.css`, `package.json`, `tsconfig.json` |
| Tests and validation | `scripts/contact-security.test.mjs`, `form-delivery.test.mjs`, `seo-metadata.test.mjs`, `preservation-contract.test.mjs`, `completion-browser-check.mjs`, `validate-redesign.mjs`, `responsive-layout-check.mjs`, `motion-browser-check.mjs`, `ac-viewer-browser-check.mjs`, `security-browser-check.mjs` |
| Documentation/evidence | `README.md`, both requested completion documents, `docs/delivery-configuration.md`, `docs/completion-preservation-changes.json`, `artifacts/completion/` |

No runtime dependencies were added. Existing About-layout styles and AC-animation implementation files were not rewritten. Existing untracked audit artifacts were preserved.

## Remaining blockers and deployment status

| Item | Exact dependency | Status |
| --- | --- | --- |
| Contact production configuration | Approved Brevo API key, verified sender/domain and monitored recipient inbox (`BREVO_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`) | BLOCKED |
| Newsletter production configuration | Approved list ID, active double opt-in template with confirmation link, HTTPS confirmation redirect (`BREVO_NEWSLETTER_LIST_ID`, `BREVO_NEWSLETTER_DOI_TEMPLATE_ID`, `BREVO_NEWSLETTER_REDIRECT_URL`) | BLOCKED |
| Live provider behavior | Controlled enquiry acceptance/arrival, DOI confirmation/list membership, existing/unsubscribed-contact behavior and unsubscribe verification | NOT VERIFIED |
| Business privacy wording | Approved notice describing newsletter/enquiry data handling; the form currently gives explicit consent wording and a real contact link | BLOCKED — approved content not supplied |
| Production abuse and duplicate protection | Configure trusted ingress limits. Multiple replicas/serverless instances additionally need atomic shared submission state; current rate/deduplication state is per-process and resets on restart | BLOCKED for an unconfigured multi-instance deployment |
| Certification display | User confirmed no verified certificates. No ISO or association badge should be published without supporting evidence | BLOCKED; safely omitted |
| Deployment and live-site verification | No deployment authorized or performed; live hosting, field metrics and deployed integration behavior not tested | NOT STARTED / NOT VERIFIED |

Detailed configuration and provider references: [delivery-configuration.md](delivery-configuration.md). Reproduction commands: [README](../README.md#validate-the-current-implementation).

**READY FOR STAGING** means the code and local checks support controlled staging configuration and acceptance testing. It is not a declaration that enquiry delivery, newsletter signup or the public production site is ready for launch.

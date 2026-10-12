# AC Experts final document and website verification

12 October 2026, Asia/Dubai. This report covers the current local production build and the original supplied Word document. After reviewing the deployment boundary, the user explicitly authorized **“Push main and allow automatic Vercel deployment.”** That authorization covers this reviewed GitHub push and its automatic Vercel deployment. Live email tests, DNS changes and other infrastructure operations remain outside this authorization.

## Latest testimonial alignment and full-site responsive verification

The subsequent screenshot request removes the visible slideshow Pause/Play button entirely. The testimonial heading now sits above evenly aligned cards, with three cards on desktop, two on tablet and one on mobile. Negative track margins and the middle-card offset were removed. Card text, client details and 44px navigation controls fit without clipping or overlap. Automatic rotation retains the seven-second interval and full-opacity 850ms slide. Manual arrows, dots, keyboard navigation or swipe stop rotation; Space on the focused carousel can resume it. Hover/focus/offscreen/background and reduced-motion protections remain.

The production build, lint and TypeScript checks passed. The Node suite, including rendered SEO, passed **94 tests**, with zero failures and **16 PostgreSQL integration tests skipped** because an isolated database was not running for this UI change.

- **384 responsive cases passed**: all 48 routes at 320, 360, 390, 414, 768, 1024, 1280 and 1440px. Checks cover text/control overflow, overlapping or clipped controls, missing images, table access and card alignment: [full-site results](../artifacts/responsive-alignment-2026-10-12/full-site/responsive-layout-check.json).
- **17 focused checks passed**, including all four testimonial positions at five widths, two accessibility scans, actual repeated autoplay timing, manual stopping and keyboard resuming, touch swipe, reduced-motion behavior and removal of the playback button: [focused results](../artifacts/responsive-alignment-2026-10-12/focused/final/homepage-updates-browser-check.json).
- **The motion suite passed** all eight widths and its reduced-motion, no-JavaScript, no-observer and live-preference cases: [motion results](../artifacts/responsive-alignment-2026-10-12/motion/motion-browser-check.json).

Desktop, tablet and mobile screenshots were visually reviewed. Unrelated CSS rules were preserved. These are local production-build results; they do not establish successful hosted deployment or resolve the launch configuration requirements below.

## Earlier homepage changes on 12 October 2026 (commit b8164cd)

The user's later screenshot instructions supersede the original homepage top-strip and banner requirements. The thin contact/group strip is now omitted on the homepage, while internal pages retain it. The red banner heading is now **Residential & Commercial**, with the duplicate subtitle removed. Testimonials advance every seven seconds with an 850ms slide, Pause/Play controls, hover/focus/offscreen/background pausing and reduced-motion support. Existing arrows, dots, keyboard navigation and touch swipe remain available.

The slower transition exposed a real temporary text-contrast failure from the inherited opacity fade. Removing that fade keeps text fully opaque throughout the slide; the existing motion-suite contrast assertion was retained unchanged.

Follow-up verification:

- Production build, lint and TypeScript checks passed.
- The Node suite passed 82 tests with 28 environment-dependent skips. A subsequent rendered SEO run passed all 27 SEO tests, including the 12 initially skipped browser-dependent checks. The remaining 16 PostgreSQL integration checks were not rerun for this UI-only change; their earlier results below remain historical evidence.
- All 16 focused homepage checks passed, including actual repeated seven-second rotation and two accessibility scans: [focused results](../artifacts/homepage-updates-2026-10-12/focused/final/homepage-updates-browser-check.json). Run with `npm run check:homepage` against a local production server using `BASE_URL`.
- The final motion suite passed all eight widths and reduced-motion, no-JavaScript, no-observer and live-preference checks: [motion results](../artifacts/homepage-updates-2026-10-12/motion-final/motion-browser-check.json).
- The completion suite passed 25 checks including 16 accessibility scans: [completion results](../artifacts/homepage-updates-2026-10-12/completion/completion-browser-check.json). Homepage/About responsive verification passed all 16 cases: [responsive results](../artifacts/homepage-updates-2026-10-12/responsive/responsive-layout-check.json). Desktop and mobile captures were visually inspected.

No live email was sent. The production-configuration blockers documented below remain open. This follow-up is authorized for GitHub publication, with the previously approved automatic Vercel deployment.

## Changes and document comparison

The original `web modification- acexperts.docx` was read directly again, along with both supplied implementation prompts. Its SHA-256 remains `79fc75b01983e5f24a3b2f2f5554ffdd23cf6ded0eb2179a1ed5041e12c2e365`. All 11 specified page titles, meta descriptions and canonical URLs match the original table exactly. [Direct document comparison](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/document-audit/word-source-comparison.json), [requirement-by-requirement review](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/document-audit/review.md).

The approved navigation, homepage blog/FAQs/portfolio, four confirmed certifications, service pages/CTAs, About corrections, project categories and group-company footer are present. Following the user's new confirmation, the emergency strip now includes **ISO Certified**. It retains **Experienced Technicians**; no technician credential, ISO standard number or certificate identifier was inferred. [Eight-width ISO check](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/iso-strip-browser-check.json), [desktop](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/iso-strip-1440.png), [mobile](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/iso-strip-390.png).

The wider metadata audit found and fixed two inherited gaps outside the document's 11 specified pages:

- `/project-portfolio/` had no description despite being indexable. It now describes the existing published villa project.
- `/blog/page/2/` repeated the first blog page's title and description. Both now identify page 2 and its existing article topics.

Only these three metadata values changed. All other 46 page records, the 11 document SEO pairs, seven noindex category archives, canonicals, robots rules, original content and media remain unchanged. The independent original preservation baseline was retained; its reviewed-change manifest records the new data revision and reason. [Exact before/after review](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/document-audit/metadata-diff-review.json).

Both descriptions also appear as their page introductions. Their 16 responsive cases pass; desktop/mobile introductions were inspected. [Responsive evidence](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/seo-fix/responsive-layout-check.json), [visual captures](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/seo-fix/visual-check.json).

**Additional portfolio records and images remain pending**, as the user confirmed. The existing real project is retained; no projects were invented. This is the remaining original-document content input.

## Verification results

| Check | Result | Evidence |
| --- | --- | --- |
| Production build | PASS | [Build output](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/build-seo-final-output.txt) |
| Lint and TypeScript | PASS | [Lint](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/lint-seo-final-output.txt), [typecheck](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/typecheck-seo-final-output.txt) |
| Full automated tests | PASS: 110/110; zero failed or skipped; real PostgreSQL and rendered SEO enabled | [Final test summary](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/database/npm-test-final-metadata-summary.json), [full output](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/database/npm-test-final-metadata-output.txt) |
| Titles, descriptions, H1, canonical and social metadata | PASS: 48 rendered pages; all 41 indexable pages have nonempty, unique titles and descriptions | [All-page JSON](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/seo-all-pages.json), [reviewable CSV](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/seo-all-pages.csv) |
| Routes, links, media, redirects and sitemap | PASS: 48 pages, 915 linked targets, 30 page redirects and 121 media redirects | [Route verification](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/route-validation-seo-final.json) |
| Responsive layout | PASS: 384 cases across 48 routes and eight widths; after the metadata fixes, all 16 affected cases rerun and pass | [Full run](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/responsive-layout-check.json), [affected routes](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/seo-fix/responsive-layout-check.json) |
| Completion, keyboard, form UI and accessibility | PASS: 25 checks, including 16 automated accessibility scans | [Browser results](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/completion-browser-check.json) |
| Motion and AC viewer | PASS: eight widths and reduced-motion/no-JavaScript/fallback checks; all 14 viewer groups | [Motion](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/motion-browser-check.json), [viewer](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/ac-viewer-check.json) |
| Browser security | PASS: headers, fresh nonce CSP, injection blocking, hydration and explicitly unsent synthetic form request | [Security output](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/security-output.txt) |
| Historical browser suites | PASS: migration 90 viewport cases, 12 accessibility scans and 9 interactions; redesign 432 viewport cases, 59 accessibility scans and 25 interactions | [Migration browser](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/historical/browser-validation-results.json), [redesign browser](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/historical/redesign-browser-validation.json) |
| Local Lighthouse | Desktop: performance 100, accessibility 100, best practices 100, SEO 100. Mobile: performance 94, all other categories 100 | [Desktop](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/lighthouse-desktop.json), [mobile](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/lighthouse-mobile.json) |
| Repeatable performance sampling | Completed 18 samples across three routes and two viewport/throttle profiles | [Measurements](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/final/performance.json) |
| PostgreSQL backup, restore, privileges and retention | PASS: 12 recovery checks; full tests include real shared-store/multi-process protection | [Recovery evidence](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/database/postgres-recovery-4f30dea019454784a0c723d0c99874ff.json), [cleanup](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/database/lifecycle-final-metadata-end.json) |
| Production dependency audit | PASS: zero reported vulnerabilities | [Production audit](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/security-review/npm-audit-production.json) |
| Full dependency audit | UNRESOLVED: five high development findings from one `braces` advisory in lint tooling | [Full audit](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/security-review/npm-audit-full.json) |

Two new general SEO tests catch incomplete or duplicate indexable metadata and verify rendered metadata across all 41 indexable routes. Existing Word-specific assertions and original-content checks remain intact. The seven intentionally noindex category archives retain their source descriptions and exclusion from the sitemap.

All provider behavior in the local tests uses mocks or deliberately disabled sender/list settings. No real email delivery, newsletter confirmation or unsubscribe success is claimed. Hosted behavior, indexing by search engines and full accessibility compliance are not established by local tests.

Lighthouse is a local lab measurement. Its mobile LCP is 3.07 seconds, above the 2.5-second good threshold; desktop LCP is 0.70 seconds and both measured CLS values are zero. No field Core Web Vitals pass, production speed guarantee or causal improvement is claimed. Performance measurements ran after the other browser suites had stopped.

The historical browser suite initially stopped at its explicit disabled-provider safety guard because the required acknowledgement flag was omitted. The isolated server already had deliberately invalid sender/list settings; rerunning with the documented `LOCAL_FORM_TEST_MODE=disabled-provider` passed without changing or weakening any test. The initial refused run remains in local evidence. The all-page SEO probe also preserved its original missing-description finding before the repairs above.

## Publication and remaining launch requirements

The destination repository is `nishadvoltronix/acexperts.ae`, branch `main`. GitHub records show a working Vercel integration, including deployments named Production for the current remote commit. The user explicitly approved pushing this candidate and allowing its automatic Vercel deployment after this behavior and the remaining launch blockers were explained. No deployment-disabling configuration was added. [Repository deployment evidence](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/security-review/github-deployment-linkage.json). Authorization is not evidence of deployment success or production readiness; verify the resulting commit and hosting status separately.

Publication scope is reviewed application source, tests, configuration, documentation, logos and selected supporting evidence. Credentials, local database files, dependency caches and bulk generated screenshots are excluded; existing local files are preserved. The environment example contains only blank values. [Security and publication review](../artifacts/final-document-verification-2026-10-12T12-17-33-253Z/security-review/security-publication-review.json).

**Production readiness remains NOT READY.** Before launching:

1. Resolve or explicitly disposition the outstanding development-tool advisory under the release policy. No unsupported downgrade or audit suppression was applied.
2. Verify the intended hosting environment, protected staging hostname, ingress limits, origin/access restrictions and production deployment settings. GitHub's Vercel records do not prove that those controls or the business domain are configured correctly.
3. Provision and verify hosted PostgreSQL, runtime permissions, durable storage, shared namespace/key, connection capacity, backups/restoration, retention and reconciliation operations.
4. Approve and publish the privacy notice/version and retention policy. The previously blocked configured-privacy browser probe remains unexecuted; local source/unit coverage does not substitute for that or the real policy.
5. Configure Brevo's verified sender, dedicated key, authorized recipient, newsletter list, DOI template, redirect URL and allowed origin. Complete controlled delivery, real confirmation/list membership, unsubscribe and suppression tests using explicitly authorized test addresses. Follow the [delivery guide](delivery-configuration.md) and [staging checklist](staging-configuration-checklist.md).
6. Supply approved additional project details when available. Authorize the specific staging/production release, DNS changes and production-service operations separately.

No live emails, DNS changes or production-service restarts were performed during this verification.

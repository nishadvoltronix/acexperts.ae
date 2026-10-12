# AC Experts completion plan

**Certification update — 12 October 2026:** The owner confirmed NADCA, ISIAQ, ISSA and IAQA, then separately confirmed “ISO is verified; project details pending.” These confirmations supersede the certification omission/blocker wording below. The four homepage credentials and emergency `ISO Certified` label are implemented; [current requirements and verification status](acexperts-requirements-verification.md#latest-full-document-and-iso-recheck) record the additions. Additional projects remain pending. Historical counts/evidence and the separate security, hosting, privacy and live-delivery release blockers are unchanged.

Date: 12 October 2026 (Asia/Dubai). Starting commit: `dd775cc`.

The implementation follows the user's final implementation prompt and the original `web modification- acexperts.docx`. Existing untracked screenshots and audit evidence are retained. Changes remain uncommitted; publication, DNS changes and production-service restarts are outside this work.

| Workstream | Implementation and acceptance criteria | Final status |
| --- | --- | --- |
| Homepage and shared shell | Restore source-backed top strip; exact welcome H1; real blog, FAQ and portfolio sections; Residential & Commercial benefits wording; visible group-company links. Preserve AC animation, testimonials and design tokens. | COMPLETE |
| Services and portfolio | Accurate AC/HVAC filters using the existing villa installation project; duct-cleaning and HVAC service pages; revised services heading; emergency strip limited to supported claims. | COMPLETE; certification exception below |
| SEO | Extract all 11 title/description pairs from the DOCX into an independent fixture. Verify data and rendered metadata, canonicals, H1s, indexability and links. | COMPLETE |
| Contact and newsletter | Implement supported server-side provider adapters, validation, abuse controls, duplicate handling, explicit newsletter consent and truthful acceptance/failure states. Use mocked providers for local success/failure verification. | PARTIAL |
| Certifications | Publish only verified business certifications. No new badges or ISO assertion without evidence. | BLOCKED |
| Preservation validator | Keep the original baseline. Record reviewed intentional changes explicitly; recognize quality-image replacements while preserving original-asset hashes, alt text, links and content checks. | COMPLETE |
| Verification | Lint, production build/type check, unit/security/integration/SEO tests; all routes/redirects/assets; responsive checks at 320, 360, 390, 414, 768, 1024, 1280 and 1440px; keyboard/reduced-motion and form states. | COMPLETE locally; live provider checks remain NOT VERIFIED |
| Production integrations and deployment | Requires configured provider credentials, approved sender/list/template and live verification. No live sends or deployment in this task. | NOT VERIFIED |

## Evidence and known boundaries

- The starting audit verified 46 public routes, 30 page redirects and 121 original-media redirects.
- The old preservation failures comprise two committed file changes (`data/pages.json`, `app/api/contact/route.ts`) and three groups of image references replaced by the quality-image map. All 13 flagged image references rendered their mapped replacements with matching alt text.
- Homepage content will reuse the migrated articles, eight original FAQs and the one existing project; no extra projects, reviews, qualifications or guarantees will be invented.
- The user confirmed Brevo for both integrations and confirmed that no verified certifications are available. Brevo adapters and mock tests are complete; live credentials and provider verification remain outstanding.
- Final evidence: 61 automated tests, 48 routes, 384 responsive cases plus eight final homepage checks, 22 completion-browser checks, eight motion widths/four fallback modes and 12 AC-viewer groups passed. Build, lint, typecheck and production security-browser checks passed.
- The actual API check exposed a loopback-alias mismatch, which was corrected and regression-tested without broadening production origins.
- Final results, exact configuration blockers, changed files and the **READY FOR STAGING** decision are recorded in [the completion report](acexperts-completion-report.md).

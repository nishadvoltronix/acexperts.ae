# Independent original-document source review

12 October 2026, Asia/Dubai. This audit reads the actual original Word ZIP/XML, both user-supplied implementation prompts and the current application source. The initial document review was read-only; the subsequent authorized metadata fixes are recorded below. This agent did not start services, submit forms, commit or push. Fresh runtime verification is conducted separately by the root agent.

The Word SHA-256 remains `79fc75b01983e5f24a3b2f2f5554ffdd23cf6ded0eb2179a1ed5041e12c2e365`: 86 paragraphs, 15 embedded images, one 12-row table consisting of the header and 11 SEO rows. All 15 image hashes match the preserved reference images inspected directly. The explicit user-approved navbar and later confirmation of NADCA, ISIAQ, ISSA and IAQA supersede older instructions; embedded historical website URLs are context, not execution authority.

During this audit, the user additionally confirmed **“ISO is verified; project details pending.”** The root agent then added `ISO Certified` to the existing emergency strip. The [updated source review](source-review-after-iso.json) verifies that implementation. The earlier `source-review.json` remains preserved as the snapshot before this new confirmation; its ISO dependency is superseded by this update.

## Exact titles, descriptions and canonical URLs

[Direct original-Word comparison](word-source-comparison.json) records the expected and actual strings for all 11 pages. The comparison concatenates XML text runs and trims only outer cell whitespace; it does not normalize punctuation or case and does not use the repository SEO fixture as its expectation. **All 11 titles, 11 descriptions and 11 canonical URLs match exactly.** All 11 source pages permit index/follow. `lib/metadata.ts` uses an absolute title, the same description and canonical for rendered metadata; installed Next.js documentation confirms that the absolute title avoids a parent title-template suffix.

The routes are `/`, `/products/`, `/contact-us/`, `/about/`, `/emergency-ac-maintenance-service/`, `/ac-installation-service/`, `/services/`, `/ac-repair-services/`, `/faq/`, `/projects/`, and `/preventive-ac-maintenance-service/`. Rendered metadata, H1 hierarchy, routes, redirects and sitemap still require the separate fresh runtime checks; source equality alone is not that evidence.

## Every website requirement

| Requirement and Word paragraph/image | Current source finding | Boundary |
| --- | --- | --- |
| Preserve top strip; paragraph 2/image9 | `TopStrip` includes Since 2009, location, phone/email, group-company and social links. `Header` renders it above navigation. | Implemented; existing responsive presentation retained. |
| Exact homepage heading; paragraph 3/image15 | `Welcome to Voltronix, AC Service Company in Dubai` matches direct Word text; `HomePage` renders page H1. | Implemented; one-H1 runtime check remains in test suite. |
| Homepage blog; paragraph 4/image6 | `HomepageBlog` renders three latest actual migrated articles and links to the blog. | Implemented; screenshot does not prescribe a different fixed article count. |
| Original homepage FAQs; paragraph 5/image2 | `HomepageFAQs` receives the eight original items; exact FAQ hash matches the source-preservation baseline. | Implemented; no invented answers. |
| Portfolio/projects; paragraph 6 | Homepage renders and links the existing Luxury Villa AC Installation record. | Section implemented; additional project examples need approved records/images. |
| Red benefits band; paragraph 7/image1 | Exact `Residential & Commercial` present in the existing red band. | Implemented. |
| Group-company footer; paragraph 8/image13 | `Footer` renders group copy and all four destinations: Contracting, DEWA Approvals, AC Experts, Switchgear. | Implemented. |
| Installation CTA; paragraphs 10–13/image10 | Service route receives `SharedCTA` with the published phone link. | Implemented; preserve completed CTA. |
| Preventive maintenance CTA; paragraphs 14–16/image4 | Service route receives the same shared CTA. | Implemented. |
| Repair CTA; paragraphs 18–20/image5 | Service route receives the same shared CTA. | Implemented. |
| Emergency CTA; paragraphs 22–24/image14 | Service route receives the same shared CTA. | Implemented. |
| Emergency trust strip; paragraphs 25–26 | After the user's new ISO confirmation, the strip contains Experienced Technicians, Rapid Response, ISO Certified, Dubai Coverage in that order. | Implemented in source; fresh runtime verification remains separate. No ISO number or technician credential was inferred. |
| AC/HVAC categories; paragraphs 27–30/image11 | All, AC Repair, AC Maintenance, AC Installation, Commercial AC (HVAC); the one villa belongs to installation. `ProjectFilters` has pressed state, filtered results and truthful empty categories. | Implemented; Civil/MEP removed from current filters. |
| About blank space; paragraph 34/image7 | Dedicated CSS joins Insights heading and values using a 28px gap and removes the former standalone heading spacing. | Implemented; original content hashes retained. |
| About cards/buttons; paragraph 37/image8 | Flex-column card links separate prose from buttons; renderer restores Initially/Profitably word separators. | Implemented. |
| About trust CTA; paragraph 38/image3 | Bounded grid aligns desktop heading and button; mobile stacks them. | Implemented. |
| Duct-cleaning page; paragraph 41 | `/ac-duct-cleaning-services-in-dubai/` exists, indexable with own canonical, service navigation/listing and enquiry CTA. | Implemented. |
| HVAC page; paragraph 41 | `/hvac-services/` has equivalent data, links, canonical and CTA. | Implemented. |
| Revised services heading; paragraph 43 | Exact `Complete AC & HVAC Services in Dubai` in page data and homepage section. | Implemented. |
| Homepage certifications; paragraphs 44–45/image12 | `HomepageCertifications` renders NADCA, ISIAQ, ISSA and IAQA, local official-source logos and the reference descriptions. Responsive CSS is imported. | Implemented following explicit owner confirmation; not independently credential-verified by this audit. ISO is separately confirmed and displayed in the emergency strip. |
| Eleven SEO pairs; Word table | Every title/description/canonical matches the actual table, case-sensitively. | 11/11 direct source comparisons pass. |
| Later approved navigation | Home → About → Services → Projects → Products → Blog → Contact; six service routes only in dropdown. | Implemented; later instruction takes precedence over older images. |

The two pasted prompts additionally require delivery integration, shared PostgreSQL protection, safe consent, testing and honest launch reporting. Those requirements remain implemented in the existing handlers/store and covered by the separately executed suite; this source-document audit does not repeat or claim live delivery, hosted database recovery, approved privacy operations or deployment verification. The later explicit push request changes repository publication authorization, not deployment/DNS/live-send authorization; the root agent handles publication.

## Findings

The document-specific source review found no remaining missing supported website requirement after the root agent's ISO addition. [Machine-readable source checks](source-review-after-iso.json) independently verify the required headings, original FAQ/About preservation, approved navigation, four credential names and local logo hashes, both linked service pages, and the four emergency-strip labels including the newly authorized ISO claim. A subsequent broader metadata audit found two inherited issues outside the 11 Word-specified pages and fixed them as recorded below.

The outstanding original-content input is additional real project records/images, which the user explicitly says remain pending. These must not be replaced with invented projects. The homepage's four named credentials and emergency ISO claim are no longer blocked because the owner explicitly confirmed them. `Experienced Technicians` remains instead of the document's broader `Certified Professionals` assertion; the ISO confirmation does not establish technician credentials.

This conclusion does not clear the existing development-dependency findings, hosting/staging choices, privacy/retention operations, Brevo settings, or authorized real delivery/confirmation/unsubscribe verification. No production-readiness or live-success claim is made.

## Additional all-route metadata audit and fixes

The independent rendered check exposed a missing description on `/project-portfolio/`. The [full 48-route comparison](all-metadata-before.json) confirms 41 indexable routes and seven intentional noindex archives. `/project-portfolio/` was the only indexable page with a blank description. `/blog/page/2/` duplicated both the title and description of `/blog/`; both routes are indexable and have distinct self-canonicals. There were no other missing titles, nonempty duplicate titles/descriptions or duplicate canonicals. The blank description and pagination duplicates were already in the original migration baseline. The earlier preservation validator accepted them because they matched that source; it did not establish completeness or uniqueness.

The two narrow fixes use only existing content:

- `/project-portfolio/` now describes its single published Luxury Villa AC Installation project and enquiry option. It does not invent additional projects or performance claims.
- `/blog/page/2/` retains the original title wording with `Page 2` added, and describes the existing older-page articles about AC maintenance, repairs, home safety and indoor air quality. `/blog/` metadata is unchanged.

[Independent diff review](metadata-diff-review.json) confirms exactly three changed JSON values: the two page-2 metadata fields and the portfolio description. All other 46 pages, the eleven exact Word pairs, all seven noindex archives, canonicals, robots, stored content HTML, FAQs and sections remain unchanged. The original preservation baseline was not modified. Only after that comparison passed was the reviewed `data/pages.json` hash/reason updated in `docs/completion-preservation-changes.json`.

`PageHero` also renders `page.description` as the introduction on these two non-article routes, so both descriptions update visible introductory copy as well as metadata. Their H1 values, route structure and layout code are unchanged. The root agent will check both routes at eight widths (16 responsive cases) and inspect the resulting screenshots; these runtime checks are not claimed complete here.

Two generic regression tests were added to `scripts/seo-metadata.test.mjs`: every indexable page must have a nonempty unique title and description, and one `BASE_URL`-guarded test checks rendered title/description/canonical/robots consistency for all 41 indexable pages. The existing independent eleven-Word-page and heading tests remain intact. Fresh build and runtime results for these edits are recorded separately by the root agent; this audit does not claim a passing rebuild before it executes.

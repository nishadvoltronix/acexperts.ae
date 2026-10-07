# AC Experts reference design system

## Source and certainty

The master is the user-supplied `WhatsApp Image 2026-09-30 at 10.12.37 AM (2).jpeg`, inspected at its intrinsic **705 × 1600 pixels**. The file is a compressed, flattened desktop composition. Measurements below are approximate image coordinates, not recovered original CSS. The image is the visual authority for composition, section order, color relationships, illustration, and component treatment.

The reference does **not** supply a font file/name, Figma file, original photograph layers, mobile/tablet frames, an open mobile menu, breadcrumb, form, hover/focus states, or animation. Font identification, interaction states, and responsive layouts are consequently implementation inferences. No claim of verified source animation, exact underlying CSS, or mobile pixel matching can be made from this file.

Content remains independently governed by the migrated site. The reference's phone number, statistics, review text, review identities, and other business claims must not silently replace the existing site's information. The supplied image contains `052 211 6060`; the request explicitly requires preservation of existing contact information. Decorative graphics may be retained without introducing new business facts.

## Measured desktop composition

Coordinates are measured from the top-left of the 705 × 1600 reference. Section edges have approximately 2–8 pixels of uncertainty because soft backgrounds merge.

| Region | Approximate reference bounds | Layout |
| --- | --- | --- |
| Global header | x0–705, y0–55 | White, short logo at left, six compact central links, rounded phone capsule at right |
| Home hero | x0–705, y55–407 | Almost equal text/artwork columns, large black/red two-line heading, feature row, paired pill buttons |
| Service heading and cards | x44–660, y399–671 | Centered eyebrow/title/rule, four equal tall cards |
| Company difference and statistics | x45–663, y685–879 | Text left; four metric cards right; faint skyline along bottom |
| Promise strip | x0–705, y878–974 | Saturated red strip with broadly rounded top corners; heading and six separated items |
| Brand row | x48–660, y991–1072 | Centered heading; seven logos in a horizontal row; small pagination marks |
| Testimonials | x34–665, y1096–1255 | Three equal review cards; centered heading; outside circular arrow controls and dots |
| Contact CTA | x34–673, y1274–1443 | Wide white rounded panel; copy and phone button left, three features center, technician/van artwork right |
| Footer | x43–663, y1467–1598 | Brand/social column, quick links, services, contacts, newsletter; fine divider and legal row |

The main hero/header gutter is approximately **32 pixels / 4.54% of the reference width**. Most internal section gutters are **44–46 pixels / 6.24–6.52%**. Service cards occupy roughly 136 pixels each with 20–23-pixel gaps. CTA panel width is approximately 638 pixels. The four metric cards are about 82 pixels wide and 98 pixels high. Review cards are about 191 pixels wide and 125 pixels high.

A useful desktop normalization is a **1440-pixel viewport**, scaling the raster's measurements by `1440 / 705 = 2.04255`. At that width the outer gutter is about 65 pixels, the working content width about 1260–1310 pixels, the header about 112 pixels high, and hero heading about 64 pixels. This normalization is inferred; the original design artboard width is unavailable. Scale relationships matter more than pretending the raster reveals exact CSS units.

## Color tokens

JPEG noise, antialiasing, red gradients, and photography prevent a unique exact hex value from being extracted for each role. Pixel sampling found saturated red interior values including RGB `237,14,19`, `222,15,25`, and `227,17,20` in buttons. The promise strip averages approximately RGB `219,7,18` over its saturated-red pixels. White and very light gray dominate the page.

| Token role | Recommended shared value | Evidence / use |
| --- | --- | --- |
| Primary | `#e5091b` | Bright red buttons, active navigation, emphasis, icons; within the reference's observed red range |
| Primary strong | `#cf0715` | Deeper red from the promise strip and an accessible interactive-text variant |
| Secondary / heading | `#171717` | Almost-black display and section headings |
| Accent tint | `#fff2f3` | Soft pink circular icon backgrounds and tiny eyebrow badges |
| Background | `#ffffff` | Main canvas |
| Surface subtle | `#fbfbfb` | Barely tinted section/card surroundings |
| Surface | `#ffffff` | Header, cards, CTA, form controls |
| Body text | `#333333` | Readable neutral black-gray |
| Muted text | `#5b5b5b` | Supporting copy and metadata |
| Border | `#eeeeee` | Subtle card, field, and divider edges |
| On-primary | `#ffffff` | Text/icons on red controls and promise strip |
| Rating accent | `#e6ab2c` | Small gold review stars only |

Use one shared set of semantic variables for every route. Avoid introducing a separate navy/blue internal-page palette. Small red text and white-on-red buttons require actual contrast checks at their rendered values; deepen only the relevant accessible color token if necessary.

## Typography

The raster shows a modern sans-serif with double-storey forms, compact navigation, bold near-black headings, and a plain readable body. **The actual font family cannot be verified from the raster.** The existing locally optimized Roboto family is a reasonable measured fallback and avoids unnecessary font dependencies.

| Role | Approximate raster size | Suggested normalized desktop size | Weight / leading |
| --- | --- | --- | --- |
| Home hero heading | 31–33 px | 62–66 px | 700–800; 1.12–1.16 |
| Section heading | 16–18 px | 32–36 px | 700; 1.2 |
| Service title | 9–10 px | 18–20 px | 700; 1.3 |
| Body | 8–9 px | 16–18 px | 400; 1.65–1.8 |
| Navigation | 7–8 px | 14–16 px | 600; 1.3 |
| Eyebrow | 5–6 px | 10–12 px | 500–600; 1.3; uppercase |
| Metric number | 14–15 px | 28–30 px | 700; 1.2 |
| Footer/supporting copy | 7–8 px | 14–16 px | 400; 1.6 |

The home headline breaks after “Cool,” with red on its second line. Section headings mix black and red within the same line or across two compact lines. Centered headings use a tiny red dot flanked by very short light-red rules. Eyebrows sit in pale pink or near-white capsules. Do not substitute heavy letter spacing, uppercase display headlines, or unusually wide geometric fonts.

Preserve the existing semantic page H1 and heading hierarchy. If the supplied visible homepage headline and the migrated SEO H1 conflict, resolve the distinction explicitly and keep the original heading available semantically; do not create multiple H1s or silently replace metadata.

## Shared spacing, radius, shadow, and interaction tokens

Recommended normalized desktop spacing scale: **4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 pixels**. Maintain compact intra-component gaps and generous white space between sections.

| Role | Recommended token | Reference appearance |
| --- | --- | --- |
| Maximum main content width | `1310px` | Broad white-page composition at a 1440px normalization |
| Desktop outer gutter | `clamp(24px, 4.54vw, 80px)` | Approximately 32/705 width in reference |
| Mobile outer gutter | `20px`; `16px` at 320px | Inferred accessible adaptation |
| Card radius | `24px` | Approximately 11–13 raster pixels |
| Small card radius | `20px` | Compact metric cards |
| CTA radius | `30px` | Soft wide panel |
| Button radius | `999px` | Fully pill-shaped |
| Thin border | `1px solid var(--color-border)` | Nearly invisible boundary |
| Card shadow | `0 6px 24px rgb(0 0 0 / 0.035)` | Extremely soft gray lift |
| Button shadow | `0 4px 12px rgb(229 9 27 / 0.14)` | Subtle red glow beneath primary pills |
| Transition | `160ms ease` | Inferred restrained pointer/focus state |

Primary buttons are small red pills with white text and a right chevron, about **91 × 24 raster pixels**, corresponding to roughly **186 × 49 pixels** at 1440. The secondary hero pill is white with black text and a faint shadow/border. Header phone capsule is roughly **119 × 35 raster pixels**. Keep pointer targets at least 44 CSS pixels high when rendering a small-width layout.

Hover states and motion were not supplied. Use modest color/shadow changes and visible keyboard outlines without shifting layout. No entrance animation, automatic scrolling, autoplay carousel, or animated statistic count is justified by the still image alone. Respect `prefers-reduced-motion` by disabling optional transitions and smooth scrolling.

## Reusable component contract

All existing public routes use the same header, footer, container, typography tokens, buttons, cards, and contact CTA. Internal layouts may differ according to their actual migrated content.

| Component | Shared appearance and responsibility |
| --- | --- |
| Header | Reference logo treatment; six-link desktop layout; Services disclosure; right phone capsule; same current contact information everywhere |
| Footer | Five desktop columns with reference spacing; company summary, quick links, service links, contacts, newsletter; small social icons; final legal row |
| Button | Red and white pill variants; explicit focus state; optional small icon/chevron |
| Section heading | Optional pale-red eyebrow, bold near-black title with restrained red emphasis, tiny centered decorative rule |
| Card | White surface, faint border/shadow, generous radius, matching padding; used for service/project/article variants |
| Icon badge | Thin red line icon on very pale pink circular background; icons do not communicate meaning alone |
| Internal hero | Shared white/near-white surface, page title, short contextual copy when available, breadcrumb, relevant local image with restrained red/pale-gray curved framing |
| Breadcrumb | Small muted text, red current/interactive accent where accessible, visible focus, semantic `nav`; inferred because reference has none |
| Statistic | Pale-red icon medallion, bold number, small label, compact rounded card; use only existing verified content |
| FAQ | Semantic accordion using existing questions/answers; same border/radius and red accent; visible keyboard focus |
| Contact form | White inputs, quiet border, rounded corners, permanent labels, red submit pill and visible errors; preserve existing requirements |
| Contact CTA | Wide rounded white panel, black/red title, support copy and red phone pill; reference technician/van composition at right |

Service cards in the reference have a prominent pale-red icon disc, red centered title, short body, and bottom red “Learn More” link. Project and blog cards inherit the same surfaces/radius/type scale but use appropriate migrated photography. Blog metadata stays small and muted. Body content remains readable at approximately 65–80 characters per line. Never use the home hero photograph as filler for unrelated internal pages.

## Artwork and image treatment

Preserve supplied artwork instead of generating a different person, uniform, air conditioner, van, or logo. The source raster has limited resolution: enlarging a narrow region cannot recover unseen photographic detail. Use a CSS clipping window around the original local raster when exact artwork reuse is needed; retain the unmodified original and use `next/image` for rendering. Do not present rasterized paragraphs/navigation as functional HTML.

Approximate source windows below are useful for an unmodified-raster `ReferenceArtwork` component. Values are **x, y, width, height in intrinsic pixels** and require a final visual inspection for one-pixel seams.

| Artwork | Suggested source window | Notes |
| --- | --- | --- |
| Header logo | `32, 11, 106, 33` | Includes tagline; horizontal white background |
| Main hero technician / AC | `348, 55, 357, 353` | Includes right red curved framing and diagnosis badge; bottom white diagonal belongs to artwork |
| CTA technician / van | `433, 1265, 239, 179` | Includes raised cap area above panel; preserve full head and vehicle edge |
| Footer logo | `44, 1468, 101, 32` | Alternative logo sample, slightly smaller |
| Brand logos row | `47, 1028, 615, 26` | May be separated into logo windows for mobile wrapping; retains branded original marks |
| Faint skyline | `144, 786, 554, 92` | Contains nearby content at upper edge; avoid indiscriminate rectangle reuse |

Migrated local images should retain their existing alt text and intrinsic dimensions and be chosen for relevance. Article images use their actual aspect ratio or a shared landscape crop on listing cards. Internal hero images can use approximately **4:3** or **1:1.05** containers without stretching source imagery. The supplied hero artwork region itself is almost square (**357:353**); the CTA artwork is wider (**239:179**).

## Responsive rules: inferred from the desktop design

Only one desktop composition exists. Preserve its section order, relative hierarchy, color system, imagery, and component language while making an accessible mobile layout.

- **1280–1920:** Keep the reference desktop structure with a capped content width. Allow the hero illustration/edge treatment to align with the outer page edge. Keep six promise items and the complete footer column group when space permits.
- **1024:** Use the desktop header only while links and phone capsule fit without squeezing. Metric and promise rows may wrap cleanly. Preserve card padding and readable type rather than shrinking all content proportionally.
- **768:** Switch navigation to an accessible disclosure as required by content width. Service cards form two columns, testimonials can use one or two visible cards, and footer columns wrap. Hero columns may stack before their copy becomes cramped.
- **320, 375, 390, 430:** Stack hero content and artwork, use a single-column service/article/project grid, wrap benefit badges, and use two metric columns when labels remain readable. CTA becomes copy then artwork. Footer columns stack or form two clear groups. Inputs stay full width. No content is clipped to hide overflow.
- Set grid/flex children to `min-width: 0`, wrap long titles/URLs, and put genuine wide data tables inside labeled horizontal-scroll regions. The document itself must never scroll horizontally.
- The mobile menu requires a labeled button, `aria-expanded`, correct focus behavior, usable nested service navigation, and Escape dismissal where supported by the menu interaction pattern. No mobile-menu visual state can be claimed as an exact source match.

## Validation checklist

- Compare the desktop implementation against the reference at a matching aspect ratio: header/hero balance, hero type size and line break, four-card services row, statistics alignment, red promise strip, brand row, three-card testimonials, CTA composition, and five-column footer.
- Inspect the screenshot at native resolution and a normalized desktop viewport; ensure the logo, faces, van, and AC artwork have not been changed.
- Preserve all **46 existing content routes**, including all existing articles, service detail pages, project pages, archive routes, legal/miscellaneous pages, and the 404 experience. Preserve the existing **30 redirects**.
- Check the existing title, description, canonical, H1, robots, sitemap, image alt text, article content, service content, project content, FAQ content, structured data, and internal links against the migration data.
- Verify all requested widths: **320, 375, 390, 430, 768, 1024, 1280, 1440, 1920 pixels**. Check header, cards, hero artwork, footer, forms, long article headings, inline imagery, and wide content; compare document scroll width to viewport width.
- Navigate global navigation, Services disclosure, mobile menu, FAQ accordions, project filtering, article pagination, forms, and all primary CTAs with keyboard and pointer input.
- Check broken internal links, broken/undecoded images, hydration/console errors, invalid nesting, duplicate H1s, missing labels, visible focus, color contrast, and reduced-motion behavior.
- Run `npm run lint` and `npm run build`, then exercise the production build. Check route metadata, sitemap, and robots output from the rendered application.
- Document any conflict between supplied image copy and existing business/SEO content, any inaccessible source treatment that required a minimal adjustment, and the exact practical limit of matching a flattened low-resolution reference.

This document records reference analysis and proposed shared tokens. Runtime implementation, validation results, and any confirmed content decisions should be recorded separately; the measurement tables are not a claim that every acceptance check has passed.

## Global header and footer implementation decisions

The global navigation follows the supplied Home, Services, About Us, Why Us, Blogs, and Contact Us sequence. Projects, Products, and FAQs remain discoverable in the Services disclosure; project/product links also appear in the footer. The previous upper utility bar is incorporated into compact footer group information so the white reference header is retained without losing the group websites.

Until the user confirms otherwise, phone/email/address/mobile/business hours/social destinations retain the migrated `lib/site.ts` facts and existing URLs. Full address, business hours, original company summary, and group links are retained in expandable footer details to preserve the reference's compact five-column composition. The supplied reference's social YouTube mark is replaced with the existing site's X destination; no unsupported social account is invented.

The source image depicts Privacy Policy and Terms & Conditions links, but the migration contains no corresponding legal pages. The implementation uses correctly labeled links to the existing FAQs and Contact Us pages in that small footer row rather than inventing legal content or sending misleadingly labeled links elsewhere. The newsletter field performs local email validation, then explicitly states that online signup is unavailable and that the address was neither sent nor saved; it offers the existing email contact. A real mailing-list connection remains necessary before subscription delivery can be enabled.

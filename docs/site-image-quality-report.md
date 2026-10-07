# Site-wide image quality update

The complete 46-page website was audited at desktop 1440px and mobile 390px, both at 2× device pixel density. The update targets image sources and delivery while preserving the page design, text, navigation, controls and SEO content.

## Applied assets

| Asset set | Selected files and exact prompts |
| --- | --- |
| AC Experts header and footer logo | `public/images/design/ac-experts-logo-hq.png` — 2169 × 725; [prompts](logo-quality-prompts.json) |
| Technician and service van | `public/images/design/cta-hq-v2.png` — 1448 × 1086; [prompts](cta-quality-prompt.json) |
| Dubai skyline, Samsung and Panasonic artwork | `public/images/design/skyline-hq.png`, `samsung-hq.png`, `panasonic-hq.png`; [prompts](reference-art-quality-prompts.json) |
| Ten product photographs | `public/images/quality/`, each 1484 × 1060; [selected paths and prompts](product-quality-prompts.json) |
| Eleven service, technician and gallery assets | `public/images/quality/`; [selected paths, dimensions and prompts](legacy-photo-quality-prompts.json) |
| Four blog illustrations | `public/images/quality/`; [selected paths and prompts](blog-quality-prompts.json) |
| Client logos, AC brand logos and author icon | `public/images/quality/`; [first set](brand-quality-prompts.json), [remaining set](brand-quality-prompts-remaining.json) |
| Final logo sizing and illustration lettering corrections | [Prompts](final-image-correction-prompts.json) |

The sharper homepage hero from the previous update remains in use. All restoration work used the built-in `image_gen` tool. Generated details are reconstructions from the supplied images, not recovered original pixels; small contour and photographic microdetail differences remain. Typography, recognizable branding, subject arrangement and original image boxes were reviewed before selection.

## Original-source and delivery improvements

- Larger matching originals replace WordPress thumbnail variants wherever available. [Source mapping and evidence](site-image-source-upgrades.json).
- The image-only replacement registry is [data/image-quality.json](../data/image-quality.json), regenerated with `node scripts/refresh-image-quality.mjs`. Original migration data, links and files are retained.
- Responsive image requests now account for large cards, logos and portrait crops. Quality is 90; optimized restorations use WebP. Compact original JPEGs are delivered directly after the browser audit found optimizer stalls on two legacy sources. Logo fitting preserves every letter in narrow mobile boxes.
- The intentionally faded About-page background retains its original appearance and is served directly. Existing high-resolution photography and code-based icons that were already clear remain in use.

## Validation

The baseline is [site-image-audit-before.json](site-image-audit-before.json). Final route coverage, image decoding, source stability, geometry, text, metadata and link comparisons are recorded in [site-image-audit-after.json](site-image-audit-after.json) and [site-image-audit-final-comparison.json](site-image-audit-final-comparison.json).

- `npm run lint`: passed without warnings.
- `npm run build`: passed, including TypeScript and 51 generated static pages.
- The final registry upgrades 72 legacy image paths, in addition to the shared reference artwork replacements.
- Final browser result: all 92 desktop/mobile states returned HTTP 200, with no JavaScript errors, failed image responses, broken images or overflow. The audit decoded 169 image responses.
- Text, metadata, links, controls and alternative text match exactly. Across 7,684 measured rectangles, the maximum difference is 0.21 CSS pixels from intrinsic image rounding; document height differs by at most 1 pixel.
- A restart of only the AC Experts development server cleared stale in-flight optimizer requests; the final successful checks ran after that restart.

Independent visual reviews cover the [products, AC logo and CTA](visible-image-review-summary.json), and [integrated brand logos](brand-integrated-validation.json). Original image hashes were checked: all 118 files present in the baseline remain unchanged.

The [remaining brand-logo check](remaining-brand-integrated-validation.json) verifies 26 occurrences at 390px and 768px: all letters and symbols remain visible, with the same outer image boxes as before.

Preview: http://localhost:3001/. The separate Switchgear server on port 3000 remains running.

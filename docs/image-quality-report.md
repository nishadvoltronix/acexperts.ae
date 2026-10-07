# Image clarity update

This earlier hero-only update has been superseded by the [site-wide image quality update](site-image-quality-report.md), which also restores the logo, van artwork and other low-resolution assets.

The homepage hero now uses `public/images/design/hero-hq-clean.png` (1278 × 1230), enhanced from the 357 × 343 hero crop in the supplied reference. The built-in `image_gen` tool restored photographic detail; this is an AI-enhanced asset, not a recovered high-resolution original. The original source image remains unchanged.

The hero's crop viewport and all page CSS, text, navigation, controls, metadata and business information are unchanged. Next.js serves responsive versions of the enhanced hero at quality 90. The existing HTML diagnostics badge is unchanged; its baked-in duplicate was removed from the enhanced photograph to prevent a visible edge behind the overlay.

The exact prompts and selected asset are recorded in [image-quality-prompt.json](image-quality-prompt.json). The first enhanced hero is retained as `public/images/design/hero-hq.png` for comparison.

## Remaining source limitation

The supplied full-page reference is only 705 × 1600. Its logo crop is 105 × 32 and its technician/van crop is 239 × 179. No matching higher-resolution originals were found among the audited local assets. Generated alternatives altered logo proportions or van branding and were rejected. Those images and all other artwork therefore remain unchanged. Original high-resolution logo and technician/van file paths have been requested so they can be replaced faithfully.

## Validation

- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and 51 generated static pages.
- Desktop and mobile comparisons against the pre-change baseline are recorded in [image-quality-validation.json](image-quality-validation.json).

Preview: http://localhost:3001/. The unrelated Switchgear server on port 3000 remains running.

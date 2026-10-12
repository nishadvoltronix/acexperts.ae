# AC Experts local performance review

12 October 2026, Asia/Dubai. **Local laboratory measurement is available; hosted staging, production and field performance remain NOT VERIFIED.** These results do not establish a production speed guarantee or a full Core Web Vitals pass.

All measurements target an isolated local production build at `http://127.0.0.1:3112`. Provider settings were deliberately disabled; no email delivery is involved. The [production readiness report](acexperts-production-readiness-report.md) records the exact candidate and final release decision.

## Measurement methods and limits

The [browser measurement script](../scripts/redesign-performance.mjs) collects three samples for each of three routes at two viewport sizes. Each sample uses a new browser context with browser network cache disabled. Samples run sequentially; server, image-optimizer and operating-system caches can remain warm. The 1440×1000 context uses desktop Chromium at device scale 1 without CPU/network throttling. The 390×844 context uses the same desktop Chromium at device scale 2, 4× CPU slowdown, configured 100 ms network latency, 200,000 bytes/second download and 93,750 bytes/second upload.

The script does **not** set `isMobile`, a mobile user agent or touch emulation. Its artifact label `390 mobile / throttled` therefore means a **mobile-sized desktop browser with throttling**, not a real handset or complete mobile-device emulation. Its TTFB field is Navigation Timing's `responseStart - startTime`: elapsed navigation time to the first response byte, not isolated application/server processing time. The latency and throughput values above are configured CDP settings; the script does not independently verify that every request receives exactly that delay. Local TTFB does not represent public DNS, TLS, regional network or hosted database latency.

LCP is the last observed Largest Contentful Paint entry before the scripted menu interaction. CLS uses the largest session window, excluding shifts attributed to recent input. The script clicks the responsive menu twice after navigation and reports the largest recorded Event Timing duration from those sampled interactions. This is **not field INP or a complete-visit INP assessment**. With Event Timing support, a null interaction value means no eligible event met the 16 ms reporting threshold, not zero latency; an unsupported API also provides no measured value. The limited post-load window cannot establish full-session layout stability.

Lighthouse **13.5.0** is a separate local audit. Its mobile run uses the Lighthouse mobile profile (412×823, scale 1.75, mobile user agent and simulated mobile throttling); desktop uses its desktop preset. These settings differ from the custom 390px script. Do not combine the two as one dataset or treat a Lighthouse score as field data. Single Lighthouse audits and three custom samples are too small and environmentally sensitive to establish that an individual CSS or dependency change caused a speed improvement.

## Baseline and candidate observations

The corrected [baseline browser samples](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/performance-baseline.json), [intermediate candidate samples](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/performance-final.json) and [final release samples](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/performance-release.json) are preserved. The final run contains all 18 samples from Chromium 154.0.8037.98 after the navigation target-size adjustment. The intermediate file must not be mistaken for the release artifact simply because its historical filename contains `final`.

| Route | Viewport profile | Baseline median LCP | Release median LCP | Release sample range |
| --- | --- | ---: | ---: | ---: |
| Homepage | 1440px desktop | 520 ms | 552 ms | 540–856 ms |
| AC installation | 1440px desktop | 332 ms | 384 ms | 304–388 ms |
| First maintenance-contract article | 1440px desktop | 396 ms | 356 ms | 344–360 ms |
| Homepage | 390px throttled | 3,032 ms | 2,660 ms | 2,412–2,788 ms |
| AC installation | 390px throttled | 1,708 ms | 1,720 ms | 1,620–2,256 ms |
| First maintenance-contract article | 390px throttled | 2,356 ms | 2,256 ms | 2,004–2,292 ms |

These raw changes include both increases and decreases and are not evidence of a causal improvement. The intermediate homepage desktop samples span **512–2,716 ms**, illustrating why the median alone is insufficient. Across final release cases, observed maximum CLS was **0.0001**; the largest sampled menu interaction was **152 ms** on the 390px installation route. The earlier intermediate run reached 256 ms on the 390px homepage. This variation is an optimization signal, not a field INP claim. No external resource requests were observed in the sampled routes; this does not cover future hosted scripts or account configuration.

Every final sample reported **160,378 bytes** of script transfer. Total observed homepage transfer at 390px ranged from **344,989 to 608,061 bytes**; preserve detailed resource traces when investigating that variability. Transfer metrics are browser-reported request bytes during this window and are distinct from an inventory of all emitted static files.

The [supplemental release check](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/supplemental-check.json), recorded at 09:53:40 UTC, inventories all 16 files under `.next/static`:

| Emitted file type | Files | File bytes | Sum of individually gzipped bytes |
| --- | ---: | ---: | ---: |
| JavaScript | 13 | 654,151 | 201,758 |
| CSS | 2 | 75,359 | 15,399 |
| WOFF2 font | 1 | 43,136 | 43,169 |
| Total | 16 | 772,646 | 260,326 |

The gzip column is calculated offline with Node's `gzipSync`; it is neither observed HTTP compression nor the amount downloaded on an initial page visit. WOFF2 is already compressed, and gzipping this font increases its size. The inventory also confirms that the synthetic server-secret marker is absent from these emitted files; this is a bounded build check, not proof that every possible secret is absent.

The same check received HTTP 200 and these actual local response headers:

| Sampled resource | `Cache-Control` |
| --- | --- |
| Homepage HTML | `private, no-store, max-age=0` |
| One build-specific `/_next/static/.../_buildManifest.js` | `public, max-age=31536000, immutable` |
| `/robots.txt` and `/sitemap.xml` | `public, max-age=0, must-revalidate` |

Only one static JavaScript response was sampled for cache headers; optimized-image caching and hosted CDN behavior are not established by this check. These local responses had no `X-Robots-Tag`; this is not verification of the required authenticated staging proxy or staging noindex rules.

## Final-release Lighthouse observations

The latest homepage audits after the final navigation target-size adjustment are [release mobile](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/lighthouse-release-mobile.json) and [release desktop](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/lighthouse-release-desktop.json). The [baseline mobile audit](../artifacts/production-readiness-2026-10-12T09-25-27-738Z/lighthouse-baseline-mobile.json) remains available for inspection.

| Audit | Performance | Accessibility | Best practices | SEO | LCP | CLS | Total blocking time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline mobile | 90 | 97 | 100 | 100 | 3,473 ms | 0 | 70.5 ms |
| Release mobile | 92 | 100 | 100 | 100 | 3,272 ms | 0 | 61.5 ms |
| Release desktop | 97 | 100 | 100 | 100 | 813 ms | 0 | 0 ms |

Scores are out of 100. The release audits have no failing weighted accessibility audit. This candidate corrected a visible/accessibility-name mismatch, increased the testimonial control target to 44px, and increased the Services dropdown target to 24px. Lighthouse's automated homepage accessibility result does not replace keyboard, screen-reader, route-wide or real-device verification. Desktop has no equivalent baseline Lighthouse audit in this run; do not claim a desktop before/after Lighthouse improvement.

## Optimization signals and intentional security behavior

- **Mobile-sized LCP remains a follow-up.** The homepage H1 was the LCP element in the custom 390px samples; desktop LCP was an image. Investigate text paint/font readiness, animation timing and main-thread work under a controlled real mobile profile before choosing another change. Both the custom 390px homepage median (2.66 seconds) and release mobile Lighthouse LCP (about 3.27 seconds) exceed 2.5 seconds; neither establishes a Core Web Vitals pass. The supplemental check confirms a 0.42-second homepage H1 animation with no delay at 390px, a 0.65-second animation with a 0.2-second delay at 1440px, and no animation under the sampled reduced-motion preference. Those computed styles establish behavior, not its causal effect on LCP. Preserve approved content and motion/reduced-motion behavior while profiling.
- **JavaScript warrants targeted coverage analysis.** Release Lighthouse estimates about 26 KiB of unused JavaScript on the homepage. This is one route and observation window: shared navigation, forms and interactive features may be needed later. Use module/coverage evidence before altering client boundaries; do not remove functional code merely to satisfy an unused-code estimate.
- **Cache security is intentional.** `proxy.ts` generates per-request CSP nonces and sends private/no-store HTML. The release Lighthouse bfcache audit reports two no-store-related reasons that prevent restoration in that run. Do not remove the nonce or no-store policy to improve a score. Cache public, immutable assets independently, preserving authenticated staging access and safe header behavior. A browser's observed bfcache eligibility is not a universal browser guarantee.
- **Measure the selected hosting path.** Recheck image-optimizer cold starts, asset cache behavior, TLS and regional latency, worker limits and database latency on the approved host. Keep personalized API/HTML responses private; hosted traffic and field measurements remain absent.

The installed [Next production checklist](../node_modules/next/dist/docs/01-app/02-guides/production-checklist.md) recommends production-build measurement, image/font optimization and intentional client boundaries. This app already uses Next image rendering and local-font loading; confirm their actual resource and cache behavior rather than assuming an optimization label proves a measured outcome.

## Reproduce without overwriting evidence

First start the isolated production build using the [deployment runbook](acexperts-deployment-runbook.md#build-and-verify-the-candidate-locally-or-in-isolated-ci), with deliberate provider-disable settings. Keep browser suites and other substantial local workloads stopped while measuring. Use a fresh directory in PowerShell:

```powershell
$measurementDirectory = Join-Path 'artifacts' ('performance-' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ss-fffZ'))
New-Item -ItemType Directory -Path $measurementDirectory -ErrorAction Stop | Out-Null
$env:BASE_URL = 'http://127.0.0.1:3112'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:PERFORMANCE_SAMPLES = '3'
$env:PERFORMANCE_RUN_LABEL = 'reviewed-local-candidate'
$env:PERFORMANCE_OUTPUT = Join-Path $measurementDirectory 'viewport-performance.json'
node scripts/redesign-performance.mjs
if ($LASTEXITCODE -ne 0) { throw 'Browser performance measurement failed' }
```

Record the actual candidate/build identifier with the results. The script permits 1–5 samples per case; compare equivalent profiles and sample counts. Never overwrite a prior baseline to make a result appear improved.

Lighthouse is optional tooling fetched into npm's execution cache at a pinned version, not a new application dependency. With the same isolated server and fresh directory:

```powershell
npm exec --yes --package=lighthouse@13.5.0 -- lighthouse http://127.0.0.1:3112/ --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$measurementDirectory/lighthouse-mobile.json" --chrome-flags="--headless=new" --quiet
if ($LASTEXITCODE -ne 0) { throw 'Mobile Lighthouse failed' }
npm exec --yes --package=lighthouse@13.5.0 -- lighthouse http://127.0.0.1:3112/ --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$measurementDirectory/lighthouse-desktop.json" --chrome-flags="--headless=new" --quiet
if ($LASTEXITCODE -ne 0) { throw 'Desktop Lighthouse failed' }
```

No command above deploys, sends email or verifies a hosted environment. The custom script rejects non-loopback targets. Hosted measurement requires the selected, explicitly authorized environment and its staging access controls; do not disable those controls for an audit.

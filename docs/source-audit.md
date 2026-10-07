# Public website source audit

Observed on 5 October 2026 (Asia/Dubai) using direct public HTTP reads and a headless Chrome browser. No live forms were submitted, and no administrative resources were accessed. Public generated page styles were inspected for visual values and asset URLs; no WordPress theme or plugin implementation is included in the rebuild.

This report supplements the complete machine-generated crawl and inventory. Browser screenshots are stored in [screenshots/source](screenshots/source/).

## Visual reference

The source brand is **VOLTRONIX**, with a black/white wordmark and red symbol. The principal color is `#E00800`, with charcoal `#313131`, body text `#222222`, white, and dark navy. The footer is approximately `#0B1A37`; dark feature areas use `#001541` through `#000C26`. The utility bar uses a pale blue-gray background (`#EDF5F8`).

Body text, navigation, and most headings use Roboto. The homepage hero and blog-card titles use Zilla Slab; some secondary typography uses Open Sans or Roboto Slab. Desktop major page headings are usually 40px, the homepage hero is approximately 48px, and section headings range from 28px to 36px.

At 1440px, the header has a roughly 30px utility bar, then a white navigation row with the logo approximately 240px wide. The main navigation uses uppercase text; the active item has a thin red underline. The page content is broadly full-width with small outer gutters. At 390px the utility bar disappears, the logo and hamburger share a compact row, and the hero image appears above centered text.

The homepage starts with a white split hero, a transparent technician image on the right, large slab-serif heading, italic phone text, and a rectangular red CTA. It has three slides. A navy four-column numbered-benefits band follows. Subsequent sections include the about introduction, trust CTA, four services, counters, service-response copy, a project feature, testimonials, blog cards, and FAQs.

Service details use a small left sidebar of related services and a dark contact panel. The main column has a hero image beside introductory text, a red grid of service applications, long SEO content, and accordion FAQs. Preserve these different content structures rather than forcing every page into a short generic service template.

The blog index has a red full-width title band and three columns of bordered, lightly rounded cards on desktop. Cards contain a large illustration, author/date/category links, and a serif title. An article uses a wide content column with a large featured image and a narrower pale-peach “Book A Call Today!” sidebar. Author biography and related articles follow the article.

The project listing has a red filter panel (All, Civil, MEP) and one project card. The project detail uses a large image with its title at the bottom, four fact boxes, a short description, four gallery images, and a contact CTA.

## Screenshots

| Reference | File |
| --- | --- |
| Homepage desktop | [home.png](screenshots/source/home.png) |
| Homepage at 390px | [mobile.png](screenshots/source/mobile.png) |
| Installation detail | [ac-installation-service.png](screenshots/source/ac-installation-service.png) |
| Projects listing, full page | [projects.png](screenshots/source/projects.png) |
| Luxury villa project, full page | [project-portfolio-luxury-villa-ac-installation.png](screenshots/source/project-portfolio-luxury-villa-ac-installation.png) |
| Article | [article.png](screenshots/source/article.png) |
| Blog index | [blog.png](screenshots/source/blog.png) |
| Contact | [contact-us.png](screenshots/source/contact-us.png) |
| FAQ | [faq.png](screenshots/source/faq.png) |

Some source animations cause header text to appear faint in the full-page project screenshots. That is a capture artifact of the live site's animation, not a target visual treatment.

## Navigation and URLs

The main navigation is Home `/`, About `/about/`, Services `/services/`, Projects `/projects/`, Products `/products/`, Blog `/blog/`, and Contact `/contact-us/`.

The Services dropdown contains:

- `/ac-installation-service/`
- `/preventive-ac-maintenance-service/`
- `/ac-repair-services/`
- `/emergency-ac-maintenance-service/`

The footer additionally links to `/faq/`. Its AC Repair label currently points to `/`, while the main dropdown points to `/ac-repair-services/`. Homepage Emergency AC Maintenance also incorrectly shares an AC Repair link. These are source-link defects to document when correcting navigation.

The group bar deliberately links to the related external businesses `https://voltronix.ae/`, `https://dewaapprovals.ae/`, and `https://switchgear.ae/`; these are not internal migration routes.

Do not move articles under `/blog/[slug]/`: the existing articles use root-level slugs. The project detail is `/project-portfolio/luxury-villa-ac-installation/`. The source blog has pagination such as `/blog/page/2/`. Article cards also expose author, category, and day archive routes, including `/author/talk2maries/`, `/category/acrepairing/`, `/category/uncategorized/repairing/`, `/category/uncategorized/`, `/category/acexpertdubai/`, `/category/acservices/`, and `/2026/09/17/`. These archive families require crawling beyond the main navigation.

The products page contains ten offerings: Central Air Conditioning, Split Air Conditioning, Window Air Conditioning, Portable Air Conditioning, Chiller System, Fresh Air System, Ventilation System, DX System, Dehumidifier, and Car parking exhaust system. They are content blocks, not a discovered ecommerce checkout.

## Contact, forms, and project facts

The consistent public contact details from the header, footer, and contact page are:

- VOLTRONIX; the contact page names VOLTRONIX CONTRACTING LLC and VOLTRONIX SWITCHGEAR LLC.
- Shed 06, Aber Warehouse, Dubai Investment Park 02, PO Box 414345, Dubai, United Arab Emirates.
- Landline `+971 4 8240002`.
- Mobile `+971 50 2420957`.
- Email `info@voltronix.ae`.
- Fax `+971 4 8241852` on the contact page.
- Monday–Saturday, 8:00 AM–6:00 PM.

The contact form is **dynamically injected into a public Zoho Forms iframe** (`forms.zohopublic.com`, frame title “AcRepair contact us”). It is absent from the parent HTML's form count. The visible fields are First Name, Last Name, Email ID, Company Name, Phone Number, Mobile Number, Services Looking for?, and Message. Service choices are Installation, Replacements, Upgrades, Repairs, Solutions, and Other, with a text field for Other. The source form displays UAE `+971` phone prefixes and a Submit button. No form values, hidden form fields, submission endpoint, or private information were collected. Recreate the frontend and isolate any future sending integration.

The public embedded Google map uses the label “Nathan Star Technical Services LLC، مجمع دبي للإستثمار 2 - Dubai”. This disagrees with the visible business name and should remain a documented source discrepancy, not an inferred verified VOLTRONIX map pin.

Only one project appeared in the inspected project listing. Its facts are Client: Private Villa Owner; Size: 5-Bedroom Luxury Villa; Sector: Residential; Scope: Complete AC installation, ducting, and system balancing. Its public category classes include Civil and MEP. Its description concerns high-performance installation, energy efficiency, silent cooling, and seamless ductwork for a Dubai villa.

## Assets that ordinary image-tag extraction can miss

| Exact public URL | Use |
| --- | --- |
| `https://acexperts.ae/wp-content/uploads/2023/02/banneer01.jpg` | Homepage/background and service contact-panel background |
| `https://acexperts.ae/wp-content/uploads/2023/10/worker-acexperts.webp` | Homepage background image |
| `https://acexperts.ae/wp-content/uploads/2025/02/banner-side.webp` | Homepage background image |
| `https://acexperts.ae/wp-content/uploads/2023/02/ac-installation1.jpg` | Installation introduction image rendered as a background |
| `https://acexperts.ae/wp-content/uploads/2023/02/ac-cool.jpg` | Project card and project-detail hero background |
| `https://acexperts.ae/wp-content/uploads/2024/08/AC-Repair-Mechanic-1.jpg` | Project gallery background |
| `https://acexperts.ae/wp-content/uploads/2024/08/Professional-AC-Repair-1.webp` | Project gallery background |
| `https://acexperts.ae/wp-content/uploads/2024/08/Professional-AC-Repair-in-Dubai-1.webp` | Project gallery background |
| `https://acexperts.ae/wp-content/uploads/2024/08/AC-Maintenance-and-Repair-2.webp` | Project gallery background |
| `https://acexperts.ae/wp-content/uploads/2023/06/voltronix-R.png` | Main header logo |
| `https://acexperts.ae/wp-content/uploads/2023/12/voltronix-R-white-logo.png` | White footer logo |
| `https://acexperts.ae/wp-content/uploads/2022/12/fevicon-e1672396977395.png` | Site favicon |

Public font references are available in `/wp-content/uploads/elementor/google-fonts/css/roboto.css`, `zillaslab.css`, `opensans.css`, and `robotoslab.css`. Download only the appropriate referenced font assets; these stylesheets do not need to be included as WordPress runtime dependencies.

The FAQ sidebar “Brochure” Download button points to `#`, not a public document. No real PDF was found in the independently inspected pages. The complete crawler's document count is authoritative for the whole site.

## Extraction and SEO notes

Standard static pages use `main#content` containing `[data-elementor-type="wp-page"]`. The installation page's content ID is 4748; the projects page's is 4831. Individual articles and the project detail **do not use a main element**: select `.elementor-location-single[data-elementor-type="single-post"]`. The article template's content ID is 5078, and the project template's is 4843. The common header and footer have content IDs 5085 and 5088. These selectors are extraction guidance only; source builder markup is not needed in the rebuilt architecture.

Within article templates, `.elementor-widget-theme-post-content` identifies the actual long article body. Related-article carousels are nested `.e-loop-item` elements and acquire `.swiper-slide-duplicate` instances in the browser. Do not duplicate those related snippets into the article body or strip the author's biography accidentally.

The inspected pages have self-referencing trailing-slash canonicals and index/follow robots metadata. Preserve source page titles and descriptions rather than creating the same generic title for every service. Examples of quirks worth retaining or explicitly documenting:

- The homepage H1 is “Best AC service company Dubai”; the larger initial hero text is not the H1.
- `/services/` has the H1 “AC Installation”, despite being the overall service listing. Improve hierarchy only while preserving the heading text/content and recording the source issue.
- The FAQ page contains 12 questions; the homepage contains 8; the services overview contains another 5. Individual service pages have additional FAQs. Do not treat the dedicated FAQ page as the only FAQ source.
- The source includes FAQPage JSON-LD on the homepage and FAQ page, and Article metadata for posts. Rebuilt FAQ structured data must match the visible migrated questions and answers.
- Author display name is “Maries”; the biography uses “Maris”. Preserve the visible source wording rather than silently choosing a new identity.
- Homepage counters render initially as zero in static extraction. Read their configured end values before creating final numbers.
- The FAQ sidebar contains obvious construction-template content: an incoherent brochure sentence, a California address, an Indian phone number, `info@example.com`, and dead `#` buttons. These are not verified business contact information and are suitable for documented cleanup.
- The installation sidebar visibly shows `info@switchgear.com`, inconsistent with the site-wide `info@voltronix.ae`; treat this as a source discrepancy.
- Source content includes punctuation and spelling mistakes, such as “Maintanence”. Avoid broad rewriting during migration.

This inspection did not modify the live website, submit forms, or invoke the live chat widgets.

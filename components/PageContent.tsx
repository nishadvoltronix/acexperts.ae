import { QualityImage as Image } from "./QualityImage";
import Link from "next/link";
import { headers } from "next/headers";
import { getAsset, getPage, localLink } from "@/lib/content";
import { site } from "@/lib/site";
import type { ContentSection, FAQItem, PageData } from "@/lib/types";
import { RichContent } from "./RichContent";
import { ContentCard, formatDate } from "./Cards";
import { ContactForm } from "./ContactForm";
import { configuredPrivacyNotice } from "@/lib/privacy-notice";
import { HomePage } from "./HomePage";
import { BrandGrid } from "./BrandGrid";
import { PageHero, getPageHeroImage } from "./PageHero";
import { SharedCTA } from "./SharedCTA";
import { LegacyHomeContent, LegacyHomeFAQs } from "./LegacyHomeContent";
import { ProjectFilters, type FilterableProject } from "./ProjectFilters";
import { getServiceContent, withServiceContent } from "@/lib/service-content";
import { ServiceContent } from "./ServiceContent";

/** Repair documented source heading skips without changing valid article hierarchies. */
const articleHeadingRepairs: Record<string, Record<string, "h2" | "h3">> = {
  "/7-clear-signs-you-need-ac-repair-service/": {
    "a. Incorrect AC Size": "h3",
    "b. Clogged Drain Line": "h3",
    "c. Frozen Evaporator Coils": "h3",
    "d. Dirty Filters and Coils": "h3",
  },
  "/benefits-of-installing-a-vrf-ac-systems/": {
    "First, What exactly is a VRF AC System?": "h2",
  },
  "/emergency-ac-repair-in-dubai-the-ultimate-solution-for-immediate-cooling-relief/": {
    Conclusion: "h2",
  },
};

export async function StructuredData({
  page,
  additionalFaqs = [],
}: {
  page: PageData;
  additionalFaqs?: FAQItem[];
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const graph: object[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.origin },
        ...(page.route === "/"
          ? []
          : [
              {
                "@type": "ListItem",
                position: 2,
                name: page.h1,
                item: site.origin + page.route,
              },
            ]),
      ],
    },
  ];
  if (page.article)
    graph.push({
      "@type": "BlogPosting",
      headline: page.h1,
      description: page.description,
      datePublished: page.article.published || undefined,
      dateModified: page.article.modified || undefined,
      author: { "@type": "Person", name: page.article.author },
      publisher: { "@type": "Organization", name: site.name, url: site.origin },
      mainEntityOfPage: site.origin + page.route,
      image: getAsset(page.heroImage)
        ? site.origin + getAsset(page.heroImage)!.localPath
        : undefined,
    });
  const faqs = [...page.faqs, ...additionalFaqs];
  if (faqs.length)
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answerHtml },
      })),
    });
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }).replaceAll("<", "\\u003c"),
      }}
    />
  );
}

/** H1-only legacy intro wrappers are replaced by the shared internal hero. */
function isHeadingOnlyIntro(section: ContentSection) {
  if (section.kind !== "intro") return false;
  const remaining = section.html
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/<img\b[^>]*class="section-background"[^>]*>/gi, "")
    .replace(/<\/?(?:section|div)\b[^>]*>/gi, "")
    .trim();
  return !remaining;
}

function ContactContent({ page }: { page: PageData }) {
  const sections = page.sections || [];
  return (
    <>
      <div className="contact-main container">
        <div className="contact-information internal-content">
          {sections.filter((section) => section.kind === "intro").map((section) => (
            <RichContent key={section.id} html={section.html} omitH1 normalizeHeadings />
          ))}
          <section className="location-panel contact-location" aria-labelledby="contact-location-title">
            <h2 id="contact-location-title">Find us</h2>
            <iframe
              className="contact-location-map"
              title="Voltronix Contracting LLC on Google Maps"
              src="https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s2645270074494771790"
              width="100%"
              height="200"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
            <a
              href="https://www.google.com/maps/place/Voltronix+Contracting+LLC/@24.9746049,55.1865564,293m/data=!3m1!1e3!4m6!3m5!1s0x3e5f4289acafffff:0x24b5e31e153b624e!8m2!3d24.9751353!4d55.1866505!16s%2Fg%2F11dxkkr0jw"
              className="text-link contact-location-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps <span aria-hidden="true">↗</span>
            </a>
            <p className="contact-location-hours"><strong>Visiting hours</strong><br />{site.hours}</p>
          </section>
        </div>
        <ContactForm privacyNoticeUrl={configuredPrivacyNotice()?.url} />
      </div>
      <div className="migrated-content internal-content contact-clients">
        {sections.filter((section) => section.kind !== "intro").map((section) => (
          <RichContent key={section.id} html={section.html} omitH1 normalizeHeadings brandGrid={<BrandGrid />} />
        ))}
      </div>
    </>
  );
}

export function PageContent({ page }: { page: PageData }) {
  if (page.type === "home")
    return (
      <>
        <StructuredData page={page} />
        <HomePage page={page} />
      </>
    );

  const serviceContent = getServiceContent(page.route);
  if (serviceContent) {
    const servicePage = withServiceContent(page);
    return (
      <>
        <StructuredData page={servicePage} />
        <div className="page internal-page page-service page-service-story">
          <PageHero page={servicePage} description={serviceContent.intro[0]} />
          <ServiceContent page={servicePage} content={serviceContent} />
          <SharedCTA />
        </div>
      </>
    );
  }

  const heroImage = getPageHeroImage(page)?.url;
  const authorImage = getAsset(page.article?.authorImage);
  const projectCards: FilterableProject[] = page.type === "projects" ? (page.cards || []).map((card) => {
    const project = getPage(card.route);
    const asset = getAsset(card.image || project?.heroImage);
    return {
      route: card.route,
      title: card.title,
      excerpt: card.excerpt || project?.description,
      image: asset ? {
        src: asset.localPath,
        alt: asset.alt || card.title,
        width: asset.width || 1200,
        height: asset.height || 800,
      } : undefined,
    };
  }) : [];
  return (
    <>
      <StructuredData
        page={page}
        additionalFaqs={page.route === "/faq/" ? getPage("/")?.faqs : undefined}
      />
      <div className={`page internal-page page-${page.type}`}>
        <PageHero page={page} description={page.article ? "" : page.description}>
          {page.article && (
            <p className="article-meta">
              <span>{page.article.author}</span>
              <span aria-hidden="true"> · </span>
              <time dateTime={page.article.published}>
                {formatDate(page.article.published)}
              </time>
              {page.article.categories.map((category) => (
                <span key={category.route}>
                  <span aria-hidden="true"> · </span>
                  <Link href={localLink(category.route)}>{category.name}</Link>
                </span>
              ))}
            </p>
          )}
        </PageHero>

        {page.type === "article" ? (
          <>
            <div className="article-layout container">
              <article className="prose article-body">
                <RichContent html={page.contentHtml} omitH1 omitImageSrc={heroImage} headingOverrides={articleHeadingRepairs[page.route]} />
                {page.article?.authorBio && (
                  <aside className="author-box" aria-label="About the author">
                    {authorImage && (
                      <Image
                        src={authorImage.localPath === "/icons/fevicon-d71d1fce.png" ? site.icon : authorImage.localPath}
                        alt=""
                        width={72}
                        height={72}
                        sizes="72px"
                        className="author-image"
                      />
                    )}
                    <h2>{page.article.author}</h2>
                    <RichContent html={page.article.authorBio} />
                  </aside>
                )}
              </article>
              <aside className="article-sidebar">
                {page.sidebarHtml ? (
                  <RichContent html={page.sidebarHtml} />
                ) : (
                  <>
                    <p className="eyebrow">Here to help</p>
                    <h2>Book A Call Today!</h2>
                    <p>Schedule a call today to discuss your needs and goals!</p>
                    <Link className="button" href="/contact-us/">Book A Call</Link>
                  </>
                )}
              </aside>
            </div>
            {!!page.cards?.length && (
              <section className="container related-posts">
                <div className="section-heading" data-reveal="up">
                  <p className="eyebrow">More expert advice</p>
                  <h2>You may also like</h2>
                </div>
                <div className="card-grid">
                  {page.cards
                    .filter((card) => card.route !== page.route)
                    .map((card) => <ContentCard key={card.route} card={card} />)}
                </div>
              </section>
            )}
          </>
        ) : page.type === "contact" ? (
          <ContactContent page={page} />
        ) : page.type === "projects" ? (
          <section className="container completion-projects" aria-label="AC project portfolio">
            <ProjectFilters projects={projectCards} />
          </section>
        ) : (
          <>
            <div className={`migrated-content internal-content${page.route === "/about/" ? " about-content" : ""}`}>
              {page.sections?.length ? (
                page.sections
                  .filter((section) => !isHeadingOnlyIntro(section))
                  .map((section, index) => (
                    <RichContent
                      key={`${section.id}-${index}`}
                      // Restore two missing word separators in the migrated About cards.
                      // Keep the source archive and its preservation hashes unchanged.
                      html={page.route === "/about/"
                        ? section.html.replaceAll(">InitiallyVoltronix", ">Initially Voltronix")
                          .replaceAll(">ProfitablyVoltronix", ">Profitably Voltronix")
                        : section.html}
                      omitH1
                      omitImageSrc={page.type === "products" ? undefined : heroImage}
                      normalizeHeadings
                      brandGrid={page.route === "/about/" ? <BrandGrid /> : undefined}
                    />
                  ))
              ) : (
                <RichContent html={page.contentHtml} omitH1 omitImageSrc={heroImage} normalizeHeadings />
              )}
            </div>
          </>
        )}
        {page.route === "/about/" && <LegacyHomeContent />}
        {page.route === "/faq/" && <LegacyHomeFAQs />}
        {page.route === "/emergency-ac-maintenance-service/" && (
          <aside className="service-trust-strip container" aria-label="Emergency AC service">
            <ul>
              <li>Experienced Technicians</li>
              <li>Rapid Response</li>
              <li>ISO Certified</li>
              <li>Dubai Coverage</li>
            </ul>
          </aside>
        )}
        <SharedCTA />
      </div>
    </>
  );
}

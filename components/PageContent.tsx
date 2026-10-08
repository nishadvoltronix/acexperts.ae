import { QualityImage as Image } from "./QualityImage";
import Link from "next/link";
import { headers } from "next/headers";
import { getAsset, getPage, localLink } from "@/lib/content";
import { site } from "@/lib/site";
import type { ContentSection, FAQItem, PageData } from "@/lib/types";
import { RichContent } from "./RichContent";
import { ContentCard, formatDate } from "./Cards";
import { ContactForm } from "./ContactForm";
import { HomePage } from "./HomePage";
import { BrandGrid } from "./BrandGrid";
import { PageHero, getPageHeroImage } from "./PageHero";
import { SharedCTA } from "./SharedCTA";
import { LegacyHomeContent, LegacyHomeFAQs } from "./LegacyHomeContent";

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
  const faqs = page.type === "home" ? [] : [...page.faqs, ...additionalFaqs];
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
          <section className="location-panel">
            <h2>Visiting hours</h2>
            <p>{site.hours}</p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Aber+Warehouse+Dubai+Investment+Park+2+Dubai"
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              Find this address on Google Maps <span aria-hidden="true">↗</span>
            </a>
          </section>
        </div>
        <ContactForm />
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

  const heroImage = getPageHeroImage(page)?.url;
  const authorImage = getAsset(page.article?.authorImage);
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
        ) : (
          <>
            <div className={`migrated-content internal-content${page.route === "/about/" ? " about-content" : ""}`}>
              {page.sections?.length ? (
                page.sections
                  .filter((section) => !isHeadingOnlyIntro(section))
                  .map((section, index) => (
                    <RichContent
                      key={`${section.id}-${index}`}
                      html={section.html}
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
        <SharedCTA />
      </div>
    </>
  );
}

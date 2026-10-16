import Link from "next/link";
import type { PageData } from "@/lib/types";
import type { ServicePageContent, ServiceSection } from "@/lib/service-content";
import { RichContent } from "./RichContent";
import { QualityImage } from "./QualityImage";

type SectionKind = "offerings" | "why" | "signs" | "process" | "benefits" | "cta" | "details";

function sectionKind(title: string): SectionKind {
  if (/^Our .*Services/i.test(title) || /^Our AC (?:Installation|Maintenance|Repair)/i.test(title)) return "offerings";
  if (/^Why Choose/i.test(title)) return "why";
  if (/^Signs/i.test(title)) return "signs";
  if (/\bProcess\b/i.test(title)) return "process";
  if (/^Benefits/i.test(title)) return "benefits";
  if (/^(Book|Contact AC Experts)/i.test(title)) return "cta";
  return "details";
}

function cleanTitle(title: string) {
  return title.replace(/^\d+\.\s*/, "").replace(/^Step \d+:\s*/, "");
}

function labelledPoint(paragraph: string) {
  const match = paragraph.match(/^([^:]{5,70}):\s+(.+)$/);
  return match ? { title: match[1], text: match[2] } : undefined;
}

function ServiceSectionView({ section, index }: { section: ServiceSection; index: number }) {
  const kind = sectionKind(section.title);
  const revealOnColor = kind === "signs" || kind === "cta" ? undefined : "up";
  const points = section.paragraphs.map(labelledPoint);
  const usePoints = (kind === "why" || kind === "signs") && points.some(Boolean);
  const cards = usePoints
    ? [
        ...points.filter((point) => point !== undefined).map((point) => ({ title: point.title, paragraphs: [point.text] })),
        ...section.items,
      ]
    : section.items;
  const paragraphs = usePoints ? section.paragraphs.filter((_, pointIndex) => !points[pointIndex]) : section.paragraphs;
  const id = `service-section-${index + 1}`;

  return (
    <section id={id} className={`service-story-section service-story-${kind}`} aria-labelledby={`${id}-title`}>
      <div className="container">
        <div className="service-story-heading" data-reveal={revealOnColor}>
          <span className="service-story-index">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="eyebrow">{kind === "offerings" ? "What we do" : kind === "process" ? "How we work" : kind === "signs" ? "When to call" : kind === "cta" ? "Get started" : "The details"}</p>
            <h2 id={`${id}-title`}>{section.title}</h2>
          </div>
        </div>
        {!!paragraphs.length && (
          <div className="service-story-copy" data-reveal={revealOnColor}>
            {paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          </div>
        )}
        {!!cards.length && (
          <div className={`service-story-grid service-story-grid-${kind}`}>
            {cards.map((card, cardIndex) => (
              <article className="service-story-card" key={`${card.title}-${cardIndex}`} data-reveal={revealOnColor} data-reveal-delay={(cardIndex % 3) * 70}>
                <span className="service-story-card-number" aria-hidden="true">{String(cardIndex + 1).padStart(2, "0")}</span>
                <h3>{cleanTitle(card.title)}</h3>
                {card.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
              </article>
            ))}
          </div>
        )}
        {kind === "cta" && <Link className="button service-story-button" href="/contact-us/">Request a service visit <span aria-hidden="true">→</span></Link>}
      </div>
    </section>
  );
}

export function ServiceContent({ page, content }: { page: PageData; content: ServicePageContent }) {
  const offerings = content.sections.findIndex((section) => sectionKind(section.title) === "offerings");
  const process = content.sections.findIndex((section) => sectionKind(section.title) === "process");
  return (
    <div className="service-story">
      <div className="service-story-intro container">
        <div className="service-story-intro-copy" data-reveal="up">
          <p className="eyebrow">AC Experts service guide</p>
          <h2>Comfort starts with the right service</h2>
          {content.intro.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <nav className="service-story-jump" aria-label="On this page" data-reveal="up">
          <span>Explore this service</span>
          {offerings >= 0 && <a href={`#service-section-${offerings + 1}`}>Services <span aria-hidden="true">↗</span></a>}
          {process >= 0 && <a href={`#service-section-${process + 1}`}>Our process <span aria-hidden="true">↗</span></a>}
          {!!page.faqs.length && <a href="#service-questions">Questions <span aria-hidden="true">↗</span></a>}
        </nav>
      </div>
      <section className="service-story-gallery" aria-labelledby="service-gallery-title">
        <div className="container">
          <div className="service-story-gallery-heading" data-reveal="up">
            <div>
              <p className="eyebrow">Service gallery</p>
              <h2 id="service-gallery-title">Professional AC care in action</h2>
            </div>
          </div>
          <div className="service-story-photo-grid">
            {content.photos.map((photo, index) => (
              <figure className={`service-story-photo service-story-photo-${index + 1}`} key={photo.src} data-reveal="up" data-reveal-delay={(index % 3) * 70}>
                <QualityImage
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes={index === 0 ? "(max-width: 767px) 100vw, 58vw" : "(max-width: 767px) 50vw, 24vw"}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>
      {content.sections.map((section, index) => <ServiceSectionView section={section} index={index} key={`${section.title}-${index}`} />)}
      {!!page.faqs.length && (
        <section className="service-story-faq" id="service-questions" aria-labelledby="service-questions-title">
          <div className="container">
            <div className="service-story-heading" data-reveal="up">
              <span className="service-story-index">?</span>
              <div>
                <p className="eyebrow">Good to know</p>
                <h2 id="service-questions-title">Frequently asked questions</h2>
              </div>
            </div>
            <div className="faq-list">
              {page.faqs.map((faq) => (
                <details className="faq-item" key={faq.question}>
                  <summary>{faq.question}</summary>
                  <div className="faq-answer"><RichContent html={faq.answerHtml} /></div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

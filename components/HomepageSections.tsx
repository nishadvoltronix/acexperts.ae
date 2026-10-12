import { articles, getAsset, getPage, pages } from "@/lib/content";
import type { FAQItem } from "@/lib/types";
import { ContentCard } from "./Cards";
import { QualityImage } from "./QualityImage";
import { RichContent } from "./RichContent";
import { Button, Container, SectionHeading } from "./ui";

export function HomepagePortfolio() {
  const project = pages.find((page) => page.type === "project");
  if (!project) return null;
  const asset = getAsset(project.heroImage);

  return (
    <section className="home-portfolio home-completion-section" id="home-portfolio" aria-label="Our AC projects">
      <Container>
        <SectionHeading eyebrow="Our portfolio">AC Projects <span>in Dubai</span></SectionHeading>
        <article className="home-project-card" data-reveal="up">
          {asset && <QualityImage src={asset.localPath} alt={asset.alt || project.h1} width={asset.width || 768} height={asset.height || 512} sizes="(max-width: 767px) calc(100vw - 40px), 50vw" />}
          <div className="home-project-copy">
            <span className="eyebrow">Residential · AC Installation</span>
            <h3>{project.h1}</h3>
            <p>{project.description}</p>
            <Button href={project.route}>View Project</Button>
          </div>
        </article>
        <div className="home-section-actions"><Button href="/projects/" secondary>Explore Our Portfolio</Button></div>
      </Container>
    </section>
  );
}

export function HomepageBlog() {
  const latestArticles = [...articles]
    .sort((left, right) => Date.parse(right.article?.published || "1970-01-01") - Date.parse(left.article?.published || "1970-01-01"))
    .slice(0, 3);

  return (
    <section className="home-blog home-completion-section container" id="home-blog" aria-label="Latest AC advice">
      <SectionHeading eyebrow="Blog & news">Latest <span>AC Advice</span></SectionHeading>
      <div className="card-grid">
        {latestArticles.map((article) => <ContentCard key={article.route} card={{route: article.route, title: article.h1, image: article.heroImage, excerpt: article.description}} />)}
      </div>
      <div className="home-section-actions"><Button href="/blog/" secondary>Read All Articles</Button></div>
    </section>
  );
}

export function HomepageFAQs({ items = getPage("/")?.faqs || [] }: { items?: FAQItem[] }) {
  if (!items.length) return null;
  return (
    <section className="home-faq home-completion-section" id="home-faq" aria-label="AC service frequently asked questions">
      <Container>
        <SectionHeading eyebrow="Find your answer">Your AC Questions, <span>Answered</span></SectionHeading>
        <div className="home-faq-list">
          {items.map((item) => <details className="faq-item" key={item.question}>
            <summary>{item.question}</summary>
            <div className="faq-answer"><RichContent html={item.answerHtml} /></div>
          </details>)}
        </div>
        <div className="home-section-actions"><Button href="/faq/" secondary>More AC FAQs</Button></div>
      </Container>
    </section>
  );
}

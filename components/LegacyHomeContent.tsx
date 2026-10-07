import { getPage } from "@/lib/content";
import { RichContent } from "./RichContent";

/** Keep the original homepage copy available without adding sections to its new design. */
export function LegacyHomeContent() {
  const home = getPage("/");
  const sections = home?.sections?.filter((section) => section.kind !== "faq");
  if (!sections?.length) return null;

  return (
    <details className="legacy-home-details container">
      <summary>More about our AC services</summary>
      <div className="legacy-home-content migrated-content internal-content">
        {sections.map((section) => (
          <RichContent
            key={section.id}
            html={section.html
              .replace(/<(\/?)(h1)\b/gi, "<$1h2")
              .replace(/<h4(\s+class="card-title"[^>]*)>([\s\S]*?)<\/h4>/gi, "<h3$1>$2</h3>")
              .replace(/\bhero-track\b/g, "legacy-home-slides")
              .replace(/\bhero-slide\b/g, "legacy-home-slide")}
          />
        ))}
      </div>
    </details>
  );
}

/** The original section includes its introduction, all eight answers, and its local image. */
export function LegacyHomeFAQs() {
  const sections = getPage("/")?.sections?.filter((section) => section.kind === "faq");
  if (!sections?.length) return null;

  return (
    <div className="legacy-home-faqs migrated-content internal-content">
      {sections.map((section) => (
        <RichContent
          key={section.id}
          html={section.html.replace(/<h3>FIND YOUR ANSWER<\/h3>/g, '<p class="eyebrow">FIND YOUR ANSWER</p>')}
          omitH1
        />
      ))}
    </div>
  );
}

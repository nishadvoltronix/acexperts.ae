import Link from "next/link";
import { QualityImage as Image } from "./QualityImage";
import { getAsset, getPage, localLink } from "@/lib/content";
import type { PageCard } from "@/lib/types";
export function ContentCard({ card }: { card: PageCard }) {
  const page = getPage(card.route);
  const asset = getAsset(card.image || page?.heroImage);
  return (
    <article className="content-card">
      <Link href={localLink(card.route)}>
        {asset && (
          <Image
            src={asset.localPath}
            alt={asset.alt || card.title}
            width={asset.width || 768}
            height={asset.height || 512}
            sizes="(max-width: 767px) 100vw, 1310px"
          />
        )}
        <div className="card-copy">
          {page?.article && (
            <p className="article-meta">
              {page.article.author} · {formatDate(page.article.published)}
            </p>
          )}
          <h3>{card.title}</h3>
          {card.excerpt && <p>{card.excerpt}</p>}
          <span className="text-link">
            Read more <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Dubai",
      }).format(date);
}

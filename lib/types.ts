export interface Asset {
  url: string;
  localPath: string;
  width?: number;
  height?: number;
  type?: string;
  alt?: string;
  status?: number | string;
}
export interface FAQItem {
  question: string;
  answerHtml: string;
}
export interface ContentSection {
  id: string;
  kind: string;
  html: string;
}
export interface PageCard {
  route: string;
  title: string;
  image?: string;
  excerpt?: string;
}
export interface PageData {
  route: string;
  type: string;
  title: string;
  h1: string;
  description: string;
  canonical: string;
  robots: string;
  heroImage?: string;
  contentHtml: string;
  faqs: FAQItem[];
  sections?: ContentSection[];
  cards?: PageCard[];
  article?: {
    author: string;
    published: string;
    modified: string;
    categories: { name: string; route: string }[];
    authorBio?: string;
    authorImage?: string;
  };
  sourceUrl: string;
  migrationNotes?: (string | { reason: string; label?: string; value?: string })[];
  slides?: { html: string; image: string; title: string }[];
  sidebarHtml?: string;
}

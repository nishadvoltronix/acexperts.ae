import content from "@/data/service-content.json";
import type { FAQItem, PageData } from "./types";

export interface ServiceSection {
  title: string;
  paragraphs: string[];
  items: { title: string; paragraphs: string[] }[];
}

export interface ServicePhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ServicePageContent {
  route: string;
  h1: string;
  intro: string[];
  photos: ServicePhoto[];
  sections: ServiceSection[];
  documentFaqs: { question: string; answer: string }[];
}

const serviceContent = content as Record<string, ServicePageContent>;

export function getServiceContent(route: string) {
  return serviceContent[route];
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Existing FAQ entries take priority. New questions are used only on pages that had none. */
export function withServiceContent(page: PageData): PageData {
  const service = getServiceContent(page.route);
  if (!service) return page;
  const faqs: FAQItem[] = page.faqs.length ? page.faqs : service.documentFaqs.map(({ question, answer }) => ({
    question,
    answerHtml: `<p>${escapeHtml(answer)}</p>`,
  }));
  return {
    ...page,
    h1: service.h1,
    faqs,
  };
}

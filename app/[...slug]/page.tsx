import { notFound } from "next/navigation";
import { getPage, pages } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PageContent } from "@/components/PageContent";
import { withServiceContent } from "@/lib/service-content";
export const dynamicParams = false;
export function generateStaticParams() {
  return pages
    .filter((p) => p.route !== "/")
    .map((p) => ({ slug: p.route.split("/").filter(Boolean) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = getPage(`/${slug.join("/")}/`);
  if (!page) notFound();
  return pageMetadata(withServiceContent(page));
}
export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = getPage(`/${slug.join("/")}/`);
  if (!page) notFound();
  return <PageContent page={page} />;
}
